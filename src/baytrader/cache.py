from __future__ import annotations

import datetime as dt
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import pandas as pd


@dataclass(frozen=True)
class BarSchema:
    # Canonical columns for raw 1-minute bars.
    symbol: str = "symbol"
    timestamp: str = "timestamp"  # UTC datetime64[ns, UTC]
    open: str = "open"
    high: str = "high"
    low: str = "low"
    close: str = "close"
    volume: str = "volume"
    vwap: str = "vwap"
    trades: str = "trades"


_CANONICAL_ORDER = [
    "symbol",
    "timestamp",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "vwap",
    "trades",
]


def _to_utc_timestamp(series: pd.Series) -> pd.Series:
    # Polygon/Massive flatfiles often use epoch milliseconds in 'window_start'.
    # Accept epoch ms, epoch ns, or ISO-like strings.
    if pd.api.types.is_integer_dtype(series) or pd.api.types.is_float_dtype(series):
        # Heuristic: ms vs ns.
        values = series.astype("int64")
        # if values are ~1e12 it's ms; ~1e18 it's ns.
        unit = "ms" if values.abs().median() < 10**15 else "ns"
        return pd.to_datetime(values, unit=unit, utc=True)

    return pd.to_datetime(series, utc=True)


def normalize_flatfiles_chunk(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize a Massive/Polygon flatfiles chunk to the canonical bar schema."""
    cols_lower = {c.lower(): c for c in df.columns}

    ticker_col = cols_lower.get("ticker") or cols_lower.get("symbol")
    ts_col = (
        cols_lower.get("window_start")
        or cols_lower.get("timestamp")
        or cols_lower.get("t")
        or cols_lower.get("time")
    )

    open_col = cols_lower.get("open") or cols_lower.get("o")
    high_col = cols_lower.get("high") or cols_lower.get("h")
    low_col = cols_lower.get("low") or cols_lower.get("l")
    close_col = cols_lower.get("close") or cols_lower.get("c")
    vol_col = cols_lower.get("volume") or cols_lower.get("v")
    vwap_col = cols_lower.get("vwap")
    trades_col = cols_lower.get("transactions") or cols_lower.get("trades") or cols_lower.get("n")

    missing = [name for name, col in [("ticker", ticker_col), ("timestamp", ts_col)] if col is None]
    if missing:
        raise ValueError(f"Missing required columns {missing}. Columns: {list(df.columns)}")

    out = pd.DataFrame()
    out["symbol"] = df[ticker_col].astype(str).str.upper()
    out["timestamp"] = _to_utc_timestamp(df[ts_col])

    # Numeric columns are optional in some datasets; but for MVP we expect OHLC at least.
    for canonical, col in [
        ("open", open_col),
        ("high", high_col),
        ("low", low_col),
        ("close", close_col),
        ("volume", vol_col),
        ("vwap", vwap_col),
        ("trades", trades_col),
    ]:
        if col is None:
            out[canonical] = pd.NA
        else:
            out[canonical] = pd.to_numeric(df[col], errors="coerce")

    out = out[_CANONICAL_ORDER]
    out = out.dropna(subset=["symbol", "timestamp"])  # keep NaNs allowed for vwap/trades
    out = out.sort_values(["symbol", "timestamp"], kind="stable")
    out = out.drop_duplicates(subset=["symbol", "timestamp"], keep="last")

    return out


def cache_partition_path(base_dir: Path, symbol: str, day: dt.date) -> Path:
    return (
        base_dir
        / f"symbol={symbol.upper()}"
        / f"year={day.year:04d}"
        / f"month={day.month:02d}"
        / f"day={day.day:02d}"
    )


def write_symbol_day_parquet(
    *,
    base_dir: Path,
    symbol: str,
    day: dt.date,
    bars: pd.DataFrame,
) -> Path:
    part_dir = cache_partition_path(base_dir, symbol, day)
    part_dir.mkdir(parents=True, exist_ok=True)

    # Single deterministic file; overwrite to guarantee no duplicates across re-runs.
    out_path = part_dir / "part-0000.parquet"

    # Filter exactly this symbol and day.
    sym = symbol.upper()
    bars = bars[bars["symbol"] == sym].copy()

    start = pd.Timestamp(day, tz="UTC")
    end = start + pd.Timedelta(days=1)
    bars = bars[(bars["timestamp"] >= start) & (bars["timestamp"] < end)]

    # Ensure consistent dtypes.
    bars["symbol"] = bars["symbol"].astype("string")
    bars["timestamp"] = pd.to_datetime(bars["timestamp"], utc=True)
    for c in ["open", "high", "low", "close", "volume", "vwap", "trades"]:
        bars[c] = pd.to_numeric(bars[c], errors="coerce")

    bars.to_parquet(out_path, index=False)
    return out_path


def write_many_symbol_day(
    *,
    base_dir: Path,
    day: dt.date,
    normalized_chunks: Iterable[pd.DataFrame],
    symbols: list[str],
) -> list[Path]:
    acc: list[pd.DataFrame] = []
    for chunk in normalized_chunks:
        acc.append(chunk)

    if not acc:
        return []

    all_bars = pd.concat(acc, ignore_index=True)
    paths: list[Path] = []

    for sym in symbols:
        paths.append(
            write_symbol_day_parquet(base_dir=base_dir, symbol=sym, day=day, bars=all_bars)
        )

    return paths
