from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass
from pathlib import Path

from baytrader.cache import normalize_flatfiles_chunk, write_many_symbol_day
from baytrader.massive_flatfiles import MassiveFlatFilesClient, MassiveS3Config
from baytrader.polygon_client import PolygonClient, PolygonFlatFilesSettings


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
class FetchArgs:
    symbols: list[str]
    start: dt.date
    end: dt.date
    cache_dir: Path
    dataset: str
    file_format: str
    object_keys: list[str]
    list_prefix: str
    list_max: int


_DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


def _infer_day_from_key(key: str) -> dt.date | None:
    m = _DATE_RE.search(key)
    if not m:
        return None
    try:
        return dt.date.fromisoformat(m.group(1))
    except ValueError:
        return None


def run_fetch(*, args: FetchArgs) -> int:
    cache_dir = Path(args.cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    settings = PolygonFlatFilesSettings(dataset=args.dataset, file_format=args.file_format)  # type: ignore[arg-type]
    client = PolygonClient(settings=settings)
    massive = MassiveFlatFilesClient(MassiveS3Config.from_env())

    symbols = [s.strip().upper() for s in args.symbols if s.strip()]

    if args.list_prefix:
        try:
            keys = massive.list_keys(prefix=args.list_prefix)
        except Exception as e:
            # Most commonly: botocore.exceptions.ClientError with 403 Forbidden
            print(
                "Could not list keys (often Forbidden on limited tiers). "
                "Use the Massive File Browser to copy a specific object key and pass it via "
                "--object-keys."
            )
            print(f"Error: {type(e).__name__}: {e}")
            return 1

        shown = keys[: max(0, int(args.list_max))]
        for k in shown:
            print(k)
        if len(keys) > len(shown):
            print(f"... ({len(keys) - len(shown)} more)")
        return 0

    if args.object_keys:
        print(
            f"Fetching {len(symbols)} symbols from {len(args.object_keys)} object key(s) "
            f"into {cache_dir}..."
        )

        ok = 0
        for key in args.object_keys:
            day = _infer_day_from_key(key)
            if day is None:
                raise ValueError(
                    "Could not infer YYYY-MM-DD from --object-keys entry: "
                    f"{key}. Provide keys that include the trading day."
                )

            try:
                raw_chunks = list(
                    massive.iter_object_minute_aggs(
                        key=key,
                        symbols=symbols,
                        file_format=args.file_format,  # type: ignore[arg-type]
                    )
                )
            except PermissionError as e:
                print(f"[forbidden] {key} ({e})")
                return 1
            normalized = [normalize_flatfiles_chunk(c) for c in raw_chunks]
            out_paths = write_many_symbol_day(
                base_dir=cache_dir,
                day=day,
                normalized_chunks=normalized,
                symbols=symbols,
            )
            ok += len(out_paths)
            print(f"[ok] {key} -> {len(out_paths)} parquet file(s)")

        return 0 if ok > 0 else 1

    days = _daterange(args.start, args.end)
    print(f"Fetching {len(symbols)} symbols for {len(days)} day(s) into {cache_dir}...")

    missing_days = 0
    written = 0

    for day in days:
        try:
            raw_chunks = client.iter_minute_aggs(day=day, symbols=symbols)
        except PermissionError as e:
            print(f"[forbidden] {day.isoformat()} ({e})")
            return 1
        except FileNotFoundError:
            missing_days += 1
            print(f"[missing] {day.isoformat()} (no flat-file found)")
            continue

        normalized = [normalize_flatfiles_chunk(c) for c in raw_chunks]
        out_paths = write_many_symbol_day(
            base_dir=cache_dir,
            day=day,
            normalized_chunks=normalized,
            symbols=symbols,
        )
        written += len(out_paths)
        print(f"[ok] {day.isoformat()} -> {len(out_paths)} parquet file(s)")

    if missing_days:
        print(f"Done. Missing days: {missing_days}")
    else:
        print("Done.")

    return 0 if written > 0 else 1
