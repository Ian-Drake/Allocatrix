from __future__ import annotations

import datetime as dt
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

from baytrader.cache import BarSchema, cache_partition_path


@dataclass(frozen=True)
class AlignmentConfig:
    cache_dir: Path
    symbols: tuple[str, ...] = ("MSFT", "VGT", "SPY", "TLT", "VIX")
    master_symbol: str = "MSFT"
    require_ohlcv: bool = True
    rth_only: bool = True


def iter_days(start: dt.date, end: dt.date) -> Iterable[dt.date]:
    if end < start:
        raise ValueError("end must be >= start")
    day = start
    while day <= end:
        yield day
        day += dt.timedelta(days=1)


def ensure_utc_timestamp(series: pd.Series) -> pd.Series:
    ts = pd.to_datetime(series, utc=True)
    # pandas will return tz-aware UTC when utc=True; keep as-is.
    return ts


def stable_dedup_keep_last(df: pd.DataFrame, *, subset: list[str]) -> pd.DataFrame:
    df = df.sort_values(subset, kind="stable")
    return df.drop_duplicates(subset=subset, keep="last")


def load_cached_bars(
    *,
    cache_dir: Path,
    symbol: str,
    start: dt.date,
    end: dt.date,
) -> pd.DataFrame:
    """Load cached 1m bars for a symbol from the partitioned parquet cache.

    Assumes partitions written by `baytrader.cache.write_symbol_day_parquet`.
    Missing days are tolerated (returns empty for those days).
    """

    sym = symbol.upper()
    schema = BarSchema()

    parts: list[pd.DataFrame] = []
    for day in iter_days(start, end):
        part_dir = cache_partition_path(cache_dir, sym, day)
        if not part_dir.exists():
            continue
        parquet_files = sorted(part_dir.glob("*.parquet"))
        if not parquet_files:
            continue
        for p in parquet_files:
            parts.append(pd.read_parquet(p))

    if not parts:
        return pd.DataFrame(
            columns=[
                schema.symbol,
                schema.timestamp,
                schema.open,
                schema.high,
                schema.low,
                schema.close,
                schema.volume,
            ]
        )

    df = pd.concat(parts, ignore_index=True)

    # Enforce required columns (drop extras later by selection).
    required = [
        schema.timestamp,
        schema.open,
        schema.high,
        schema.low,
        schema.close,
        schema.volume,
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Cache data for {sym} missing columns: {missing}")

    if schema.symbol not in df.columns:
        df[schema.symbol] = sym

    df[schema.symbol] = df[schema.symbol].astype(str).str.upper()
    df[schema.timestamp] = ensure_utc_timestamp(df[schema.timestamp])

    for c in [schema.open, schema.high, schema.low, schema.close, schema.volume]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Defensive dedup (cache writer already does this, but we keep the policy explicit).
    df = df[df[schema.symbol] == sym].copy()
    df = df.sort_values([schema.timestamp], kind="stable")
    df = stable_dedup_keep_last(df, subset=[schema.timestamp])

    return df.reset_index(drop=True)


def filter_rth_only(df: pd.DataFrame, *, timestamp_col: str = "timestamp") -> pd.DataFrame:
    """Filter to regular trading hours using America/New_York clock.

    Keeps weekdays only and timestamps in [09:30, 16:00) ET.
    """

    if df.empty:
        return df

    ts = ensure_utc_timestamp(df[timestamp_col])
    et = ZoneInfo("America/New_York")
    ts_et = ts.dt.tz_convert(et)

    dow_ok = ts_et.dt.dayofweek < 5
    minutes = (ts_et.dt.hour * 60 + ts_et.dt.minute).astype(int)
    rth_ok = (minutes >= (9 * 60 + 30)) & (minutes < (16 * 60))

    return df.loc[dow_ok & rth_ok].copy()


def build_master_timeline_from_msft(msft_df: pd.DataFrame) -> pd.Series:
    """Master timeline derived from MSFT timestamps after RTH + dedup."""

    if msft_df.empty:
        return pd.Series([], dtype="datetime64[ns, UTC]")

    ts = ensure_utc_timestamp(msft_df["timestamp"])
    ts = ts.sort_values(kind="stable")
    ts = ts.drop_duplicates(keep="last")
    return ts.reset_index(drop=True)


def align_inner_join_ohlcv(
    *,
    master_timestamps: pd.Series,
    per_symbol: dict[str, pd.DataFrame],
    required_symbols: Iterable[str],
) -> pd.DataFrame:
    """Inner-join symbols on timestamp using master timestamps.

    Output columns are `timestamp` plus prefixed OHLCV columns per symbol.
    """

    schema = BarSchema()
    required_cols = [
        schema.timestamp,
        schema.open,
        schema.high,
        schema.low,
        schema.close,
        schema.volume,
    ]

    aligned = pd.DataFrame({schema.timestamp: ensure_utc_timestamp(master_timestamps)})

    for sym in required_symbols:
        s = sym.upper()
        if s not in per_symbol:
            raise ValueError(f"Missing data for symbol {s}")
        df = per_symbol[s]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Data for {s} missing columns: {missing}")

        keep = df[required_cols].copy()
        keep[schema.timestamp] = ensure_utc_timestamp(keep[schema.timestamp])
        keep = keep.sort_values(schema.timestamp, kind="stable")
        keep = stable_dedup_keep_last(keep, subset=[schema.timestamp])

        rename = {
            schema.open: f"{s}_open",
            schema.high: f"{s}_high",
            schema.low: f"{s}_low",
            schema.close: f"{s}_close",
            schema.volume: f"{s}_volume",
        }
        keep = keep.rename(columns=rename)

        aligned = aligned.merge(keep, how="inner", on=schema.timestamp, sort=False)

    aligned = aligned.sort_values(schema.timestamp, kind="stable").reset_index(drop=True)

    # Drop any remaining NaNs across OHLCV for all symbols.
    required_out_cols: list[str] = []
    for sym in required_symbols:
        s = sym.upper()
        required_out_cols.extend(
            [
                f"{s}_open",
                f"{s}_high",
                f"{s}_low",
                f"{s}_close",
                f"{s}_volume",
            ]
        )

    aligned = aligned.dropna(subset=required_out_cols)
    return aligned.reset_index(drop=True)


def contiguous_window_end_mask(
    timestamps: pd.Series | pd.DatetimeIndex,
    *,
    lookback: int,
    horizon: int,
) -> np.ndarray:
    """Return mask for eligible window endpoints over a minute grid.

    A window endpoint i is eligible if:
    - its lookback span [i-lookback+1 .. i] exists
    - its future span [i+1 .. i+horizon] exists
    - the entire span is contiguous minute-by-minute (no gaps)

    This is the core of "drop windows with missing bars" in a deterministic way.
    """

    if lookback <= 0:
        raise ValueError("lookback must be > 0")
    if horizon <= 0:
        raise ValueError("horizon must be > 0")

    ts = pd.to_datetime(timestamps, utc=True)
    n = int(ts.shape[0])
    if n == 0:
        return np.zeros((0,), dtype=bool)

    # Convert to integer minutes since epoch (UTC) to detect gaps.
    minutes = (ts.view("int64") // 60_000_000_000).astype(np.int64)
    diffs = np.diff(minutes)

    # Identify contiguous runs where diff == 1.
    run_starts = [0]
    for i, d in enumerate(diffs, start=1):
        if d != 1:
            run_starts.append(i)
    run_starts.append(n)

    mask = np.zeros((n,), dtype=bool)

    for a, b in zip(run_starts[:-1], run_starts[1:], strict=True):
        run_len = b - a
        if run_len < (lookback + horizon):
            continue
        first_end = a + (lookback - 1)
        last_end = b - 1 - horizon
        mask[first_end : last_end + 1] = True

    return mask


def build_aligned_ohlcv_frame(
    *,
    cache_dir: Path,
    symbols: Iterable[str],
    start: dt.date,
    end: dt.date,
    master_symbol: str = "MSFT",
    rth_only: bool = True,
) -> pd.DataFrame:
    """High-level Task 2.1 alignment: RTH-only, keep-last dedup, drop missing rows."""

    syms = [s.upper() for s in symbols]
    if master_symbol.upper() not in syms:
        raise ValueError("master_symbol must be included in symbols")

    per_symbol: dict[str, pd.DataFrame] = {}
    for sym in syms:
        df = load_cached_bars(cache_dir=cache_dir, symbol=sym, start=start, end=end)
        if rth_only:
            df = filter_rth_only(df)
        per_symbol[sym] = df

    master_df = per_symbol[master_symbol.upper()]
    master_ts = build_master_timeline_from_msft(master_df)

    return align_inner_join_ohlcv(
        master_timestamps=master_ts,
        per_symbol=per_symbol,
        required_symbols=syms,
    )
