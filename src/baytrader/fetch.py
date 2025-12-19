from __future__ import annotations

import datetime as dt
import gzip
import os
import re
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from baytrader.cache import normalize_flatfiles_chunk, write_many_symbol_day
from baytrader.massive_flatfiles import FlatFileFormat


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


def _data_path_from_env() -> Path:
    p = os.environ.get("DATA_PATH", "").strip()
    if not p:
        raise RuntimeError("DATA_PATH is not set. Add DATA_PATH=<folder> to your .env file.")
    return Path(p).expanduser().resolve()


def _resolve_local_daily_file(
    *,
    data_path: Path,
    dataset: str,
    day: dt.date,
    file_format: FlatFileFormat,
) -> tuple[Path, FlatFileFormat]:
    dataset = dataset.strip().strip("/")
    yyyy = day.year
    mm = day.month
    day_str = day.strftime("%Y-%m-%d")

    candidates: list[tuple[Path, FlatFileFormat]] = []
    if file_format in {"auto", "csv.gz"}:
        candidates.append(
            (data_path / dataset / f"{yyyy}" / f"{mm:02d}" / f"{day_str}.csv.gz", "csv.gz")
        )
    if file_format in {"auto", "csv"}:
        candidates.append(
            (data_path / dataset / f"{yyyy}" / f"{mm:02d}" / f"{day_str}.csv", "csv")
        )
    if file_format in {"auto", "parquet"}:
        candidates.append(
            (data_path / dataset / f"{yyyy}" / f"{mm:02d}" / f"{day_str}.parquet", "parquet")
        )

    for path, fmt in candidates:
        if path.exists():
            return path, fmt

    raise FileNotFoundError(str(candidates[0][0]) if candidates else day_str)


def _iter_local_file_minute_aggs(
    *,
    path: Path,
    resolved_fmt: FlatFileFormat,
    symbols: list[str],
    chunksize: int = 500_000,
):
    sym_set = {s.strip().upper() for s in symbols if s.strip()}
    if not sym_set:
        return

    if resolved_fmt in {"csv", "csv.gz"}:
        if resolved_fmt == "csv.gz":
            with gzip.open(path, "rb") as f:
                for chunk in pd.read_csv(f, chunksize=int(chunksize)):
                    cols_lower = {c.lower(): c for c in chunk.columns}
                    ticker_col = cols_lower.get("ticker") or cols_lower.get("symbol")
                    if ticker_col is None:
                        raise ValueError(
                            "CSV schema missing 'ticker'/'symbol' column. "
                            f"Columns: {list(chunk.columns)}"
                        )
                    filtered = chunk[chunk[ticker_col].astype(str).str.upper().isin(sym_set)]
                    if len(filtered) > 0:
                        yield filtered
        else:
            for chunk in pd.read_csv(path, chunksize=int(chunksize)):
                cols_lower = {c.lower(): c for c in chunk.columns}
                ticker_col = cols_lower.get("ticker") or cols_lower.get("symbol")
                if ticker_col is None:
                    raise ValueError(
                        "CSV schema missing 'ticker'/'symbol' column. "
                        f"Columns: {list(chunk.columns)}"
                    )
                filtered = chunk[chunk[ticker_col].astype(str).str.upper().isin(sym_set)]
                if len(filtered) > 0:
                    yield filtered
        return

    if resolved_fmt == "parquet":
        df = pd.read_parquet(path)
        cols_lower = {c.lower(): c for c in df.columns}
        ticker_col = cols_lower.get("ticker") or cols_lower.get("symbol")
        if ticker_col is None:
            raise ValueError(
                "Parquet schema missing 'ticker'/'symbol' column. "
                f"Columns: {list(df.columns)}"
            )
        filtered = df[df[ticker_col].astype(str).str.upper().isin(sym_set)]
        if len(filtered) > 0:
            yield filtered
        return

    raise ValueError(f"Unsupported resolved format: {resolved_fmt}")


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

    data_path = _data_path_from_env()

    symbols = [s.strip().upper() for s in args.symbols if s.strip()]

    if args.list_prefix:
        root = data_path / args.list_prefix
        if not root.exists():
            print(f"No such prefix under DATA_PATH: {root}")
            return 1
        files = sorted([p for p in root.rglob("*") if p.is_file()])
        shown = files[: max(0, int(args.list_max))]
        for p in shown:
            rel = p.relative_to(data_path)
            print(str(rel).replace("\\", "/"))
        if len(files) > len(shown):
            print(f"... ({len(files) - len(shown)} more)")
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

            local_path = data_path / key
            if not local_path.exists():
                print(f"[missing] {key} (not found under DATA_PATH)")
                continue

            resolved_fmt: FlatFileFormat
            key_lower = key.lower()
            if str(args.file_format) != "auto":
                resolved_fmt = str(args.file_format)  # type: ignore[assignment]
            elif key_lower.endswith(".csv.gz"):
                resolved_fmt = "csv.gz"
            elif key_lower.endswith(".csv"):
                resolved_fmt = "csv"
            elif key_lower.endswith(".parquet"):
                resolved_fmt = "parquet"
            else:
                resolved_fmt = "csv.gz"

            raw_chunks = list(
                _iter_local_file_minute_aggs(
                    path=local_path,
                    resolved_fmt=resolved_fmt,
                    symbols=symbols,
                )
            )
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
            local_path, resolved_fmt = _resolve_local_daily_file(
                data_path=data_path,
                dataset=args.dataset,
                day=day,
                file_format=str(args.file_format),  # type: ignore[arg-type]
            )
        except FileNotFoundError:
            missing_days += 1
            print(f"[missing] {day.isoformat()} (no flat-file found)")
            continue

        raw_chunks = list(
            _iter_local_file_minute_aggs(
                path=local_path,
                resolved_fmt=resolved_fmt,
                symbols=symbols,
            )
        )

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
