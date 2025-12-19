from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from pathlib import Path

from botocore.exceptions import ClientError

from baytrader.massive_flatfiles import FlatFileFormat, MassiveFlatFilesClient, MassiveS3Config


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

    if dest_path.exists() and dest_path.stat().st_size > 0:
        return dest_path

    stream = client.get_object_stream(key)
    with dest_path.open("wb") as f:
        while True:
            chunk = stream.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)

    try:
        stream.close()
    except Exception:
        pass

    return dest_path


def run_download(*, args: DownloadArgs, s3_client=None) -> int:
    args.data_path.mkdir(parents=True, exist_ok=True)

    client = MassiveFlatFilesClient(MassiveS3Config.from_env(), s3_client=s3_client)

    days = _daterange(args.start, args.end)
    print(f"Downloading {len(days)} day(s) into {args.data_path}...")

    downloaded = 0
    missing = 0

    for day in days:
        day_ok = False
        for key in _candidate_keys(dataset=args.dataset, day=day, file_format=args.file_format):
            try:
                download_object_to(client=client, key=key, dest_root=args.data_path)
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
                print(f"[ok] {key}")
                downloaded += 1
                day_ok = True
                break

        if not day_ok:
            missing += 1
            print(f"[missing] {day.isoformat()} (no accessible file found)")

    if missing:
        print(f"Done. Downloaded: {downloaded}. Missing: {missing}.")
    else:
        print(f"Done. Downloaded: {downloaded}.")

    return 0 if downloaded > 0 else 1
