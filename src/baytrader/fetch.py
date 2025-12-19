from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from pathlib import Path

from baytrader.cache import normalize_flatfiles_chunk, write_many_symbol_day
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


def run_fetch(*, args: FetchArgs) -> int:
    cache_dir = Path(args.cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    settings = PolygonFlatFilesSettings(dataset=args.dataset, file_format=args.file_format)  # type: ignore[arg-type]
    client = PolygonClient(settings=settings)

    days = _daterange(args.start, args.end)
    symbols = [s.strip().upper() for s in args.symbols if s.strip()]

    print(f"Fetching {len(symbols)} symbols for {len(days)} day(s) into {cache_dir}...")

    missing_days = 0
    written = 0

    for day in days:
        try:
            raw_chunks = client.iter_minute_aggs(day=day, symbols=symbols)
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
