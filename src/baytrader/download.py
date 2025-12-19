from __future__ import annotations

import datetime as dt
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from botocore.exceptions import ClientError

from baytrader.massive_flatfiles import FlatFileFormat, MassiveFlatFilesClient, MassiveS3Config
from baytrader.extract_universe import daily_parquet_path_for_raw, extract_daily_file_to_parquet, is_nonempty_parquet


def _parse_date(s: str) -> dt.date:
    return dt.date.fromisoformat(s)


def _daterange(start: dt.date, end: dt.date) -> list[dt.date]:
    if end < start:
        raise ValueError("--end must be >= --start")
    days: list[dt.date] = []
    cur = start
    while cur <= end:
        days.append(cur)
        cur = cur + dt.timedelta(days=1)
    return days


@dataclass(frozen=True)
class DownloadArgs:
    start: dt.date
    end: dt.date
    data_path: Path
    dataset: str
    file_format: FlatFileFormat
    universe: frozenset[str]


def _candidate_keys(*, dataset: str, day: dt.date, file_format: FlatFileFormat) -> list[str]:
    dataset = dataset.strip().strip("/")
    yyyy = day.year
    mm = day.month
    day_str = day.strftime("%Y-%m-%d")

    keys: list[str] = []
    if file_format in {"auto", "csv.gz"}:
        keys.append(f"{dataset}/{yyyy}/{mm:02d}/{day_str}.csv.gz")
    if file_format in {"auto", "csv"}:
        keys.append(f"{dataset}/{yyyy}/{mm:02d}/{day_str}.csv")
    if file_format in {"auto", "parquet"}:
        keys.append(f"{dataset}/{yyyy}/{mm:02d}/{day_str}.parquet")
    return keys


def download_object_to(
    *,
    client: MassiveFlatFilesClient,
    key: str,
    dest_root: Path,
) -> Path:
    dest_path = dest_root / key
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    temp_path = dest_path.with_name(f"temp-{dest_path.name}")

    if dest_path.exists() and dest_path.stat().st_size > 0:
        return dest_path

    # If a previous run was interrupted, restart cleanly.
    if temp_path.exists():
        try:
            temp_path.unlink()
        except Exception:
            pass

    stream = client.get_object_stream(key)
    try:
        with temp_path.open("wb") as f:
            while True:
                chunk = stream.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
        # Atomic-ish replace on Windows. Keeps final filenames identical to existing downloads.
        temp_path.replace(dest_path)
    except Exception:
        try:
            if temp_path.exists():
                temp_path.unlink()
        except Exception:
            pass
        raise

    try:
        stream.close()
    except Exception:
        pass

    return dest_path


def _local_temp_root() -> Path:
    override = os.environ.get("BAYTRADER_TEMP_PATH", "").strip()
    if override:
        root = Path(override).expanduser().resolve()
    else:
        root = Path(tempfile.gettempdir()).resolve() / "baytrader" / "downloads"
    root.mkdir(parents=True, exist_ok=True)
    return root


def run_download(*, args: DownloadArgs, s3_client=None) -> int:
    args.data_path.mkdir(parents=True, exist_ok=True)

    client = MassiveFlatFilesClient(MassiveS3Config.from_env(), s3_client=s3_client)

    local_root = _local_temp_root()

    days = list(reversed(_daterange(args.start, args.end)))
    print(f"Downloading {len(days)} day(s) into {args.data_path}...")

    accessible = 0
    missing = 0
    parquet_written = 0
    parquet_skipped = 0
    raw_deleted = 0

    def _extract_one(
        *, key: str, raw_source: Path, out_path: Path, out_rel: str
    ) -> tuple[str, str, int, bool]:
        """Return (key, status, rows, deleted)."""

        try:
            rows = extract_daily_file_to_parquet(
                raw_path=raw_source,
                out_path=out_path,
                universe=args.universe,
            )
        except ValueError as e:
            raise ValueError(f"{key} ({e})") from e

        if rows > 0 and is_nonempty_parquet(out_path):
            try:
                raw_source.unlink()
                return (out_rel, "ok", rows, True)
            except Exception:
                return (out_rel, "ok", rows, False)

        return (out_rel, "empty", rows, False)

    # Extra credit: overlap extraction with downloading via a single background worker.
    # Use small backpressure so we don't accumulate huge temp raw files.
    async_extract = os.environ.get("BAYTRADER_EXTRACT_ASYNC", "1").strip() not in {
        "0",
        "false",
        "False",
    }

    try:
        extract_workers = int(os.environ.get("BAYTRADER_EXTRACT_WORKERS", "1").strip() or "1")
    except ValueError:
        extract_workers = 1
    extract_workers = max(1, extract_workers)

    max_inflight = max(2, extract_workers * 2)

    if async_extract:
        from concurrent.futures import Future, ThreadPoolExecutor

        executor: ThreadPoolExecutor | None = ThreadPoolExecutor(max_workers=extract_workers)
        inflight: list[Future[tuple[str, str, int, bool]]] = []

        def _drain_one() -> bool:
            nonlocal parquet_written, raw_deleted
            if not inflight:
                return True
            fut = inflight.pop(0)
            try:
                out_rel, status, rows, deleted = fut.result()
            except Exception as e:
                print(f"[error] {e}")
                return False
            if status == "ok":
                parquet_written += 1
                if deleted:
                    raw_deleted += 1
                print(f"[ok] {out_rel} (rows={rows})")
            else:
                print(f"[empty] {out_rel} (no universe rows; raw kept)")
            return True
    else:
        executor = None
        inflight = []

    for day in days:
        day_ok = False
        for key in _candidate_keys(dataset=args.dataset, day=day, file_format=args.file_format):
            try:
                data_raw_path = args.data_path / key
                out_path = daily_parquet_path_for_raw(raw_path=data_raw_path)

                # If output parquet already exists and is non-empty, we can delete any raw file under DATA_PATH.
                if is_nonempty_parquet(out_path):
                    parquet_skipped += 1
                    if data_raw_path.exists() and data_raw_path.stat().st_size > 0:
                        try:
                            data_raw_path.unlink()
                            raw_deleted += 1
                        except Exception:
                            pass
                    print(f"[ok] {key} -> {out_path.relative_to(args.data_path)} (already parquet)")
                    accessible += 1
                    day_ok = True
                    break

                # Prefer raw file under DATA_PATH (mapped drive) if it exists.
                if data_raw_path.exists() and data_raw_path.stat().st_size > 0:
                    raw_source = data_raw_path
                else:
                    # Download to local temp for speed, keeping the original key layout.
                    raw_source = download_object_to(client=client, key=key, dest_root=local_root)
            except FileNotFoundError:
                continue
            except PermissionError as e:
                print(f"[forbidden] {key} ({e})")
                return 1
            except ClientError as e:
                # Unexpected; surface and stop.
                print(f"[error] {key} ({e})")
                return 1
            else:
                # Extract from DATA_PATH raw if present, else local temp raw.
                if executor is None:
                    try:
                        out_rel = str(out_path.relative_to(args.data_path))
                        out_rel, status, rows, deleted = _extract_one(
                            key=key,
                            raw_source=raw_source,
                            out_path=out_path,
                            out_rel=out_rel,
                        )
                    except ValueError as e:
                        print(f"[error] {e}")
                        return 1

                    if status == "ok":
                        parquet_written += 1
                        if deleted:
                            raw_deleted += 1
                        print(f"[ok] {key} -> {out_rel} (rows={rows})")
                    else:
                        print(f"[empty] {key} (no universe rows; raw kept)")
                else:
                    # Queue extraction; keep output path in DATA_PATH.
                    out_rel = str(out_path.relative_to(args.data_path))
                    fut = executor.submit(
                        _extract_one,
                        key=key,
                        raw_source=raw_source,
                        out_path=out_path,
                        out_rel=out_rel,
                    )
                    inflight.append(fut)
                    print(f"[queued] {key} -> {out_rel}")
                    if len(inflight) >= max_inflight:
                        if not _drain_one():
                            executor.shutdown(cancel_futures=True)
                            return 1

                accessible += 1
                day_ok = True
                break

        if not day_ok:
            missing += 1
            print(f"[missing] {day.isoformat()} (no accessible file found)")

    if missing:
        print(
            f"Done. Accessible: {accessible}. Missing: {missing}. "
            f"Parquet written: {parquet_written}. Parquet skipped: {parquet_skipped}. Raw deleted: {raw_deleted}."
        )
    else:
        print(
            f"Done. Accessible: {accessible}. "
            f"Parquet written: {parquet_written}. Parquet skipped: {parquet_skipped}. Raw deleted: {raw_deleted}."
        )

    if executor is not None:
        ok = True
        while inflight:
            if not _drain_one():
                ok = False
                break
        executor.shutdown(cancel_futures=not ok)
        if not ok:
            return 1

    return 0 if accessible > 0 else 1
