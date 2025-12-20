from __future__ import annotations

import datetime as dt
import math
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


def quotes_daily_parquet_path(*, data_path: Path, day: dt.date) -> Path:
    """Return the expected location for daily multi-ticker quotes parquet.

    Task 1.1 requirement:
    DATA_PATH/us_stocks_sip/quotes_v1/YYYY/MM/YYYY-MM-DD.parquet
    """

    return (
        data_path
        / "us_stocks_sip"
        / "quotes_v1"
        / f"{day.year:04d}"
        / f"{day.month:02d}"
        / f"{day:%Y-%m-%d}.parquet"
    )


_QUOTES_REQUIRED_COLS = [
    "Ticker",
    "ask_exchange",
    "ask_price",
    "ask_size",
    "bid_exchange",
    "bid_price",
    "bid_size",
    "conditions",
    "indicators",
    "participant_timestamp",
    "sequence_number",
    "sip_timestamp",
    "tape",
    "trf_timestamp",
]


def normalize_quotes_for_nbbo(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize a daily quotes DataFrame to a canonical schema for NBBO.

    Input schema includes `Ticker` (note case). Output uses lower_snake_case and
    `symbol` (uppercased).
    """

    missing = [c for c in _QUOTES_REQUIRED_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"Quotes missing required columns: {missing}. Columns: {list(df.columns)}")

    out = pd.DataFrame()
    out["symbol"] = df["Ticker"].astype(str).str.upper()

    for c in [
        "ask_exchange",
        "ask_price",
        "ask_size",
        "bid_exchange",
        "bid_price",
        "bid_size",
        "conditions",
        "indicators",
        "participant_timestamp",
        "sequence_number",
        "sip_timestamp",
        "tape",
        "trf_timestamp",
    ]:
        out[c] = df[c]

    out["sip_timestamp"] = pd.to_datetime(out["sip_timestamp"], utc=True, errors="coerce")
    out["participant_timestamp"] = pd.to_datetime(
        out["participant_timestamp"], utc=True, errors="coerce"
    )
    out["trf_timestamp"] = pd.to_datetime(out["trf_timestamp"], utc=True, errors="coerce")

    out["sequence_number"] = pd.to_numeric(out["sequence_number"], errors="coerce").astype(
        "Int64"
    )

    for c in ["bid_price", "ask_price", "bid_size", "ask_size"]:
        out[c] = pd.to_numeric(out[c], errors="coerce")

    out["bid_exchange"] = out["bid_exchange"].astype("string")
    out["ask_exchange"] = out["ask_exchange"].astype("string")
    out["tape"] = out["tape"].astype("string")

    return out


def _is_nan(x: object) -> bool:
    return x is None or (isinstance(x, float) and math.isnan(x))


def _recompute_best_bid(bids: dict[str, tuple[float, float]]) -> tuple[float, str, float]:
    best_price = float("nan")
    best_exch = ""
    best_size = float("nan")
    for exch, (price, size) in bids.items():
        if _is_nan(price):
            continue
        if _is_nan(best_price) or price > best_price or (price == best_price and exch < best_exch):
            best_price = float(price)
            best_exch = exch
            best_size = float(size) if not _is_nan(size) else float("nan")
    return best_price, best_exch, best_size


def _recompute_best_ask(asks: dict[str, tuple[float, float]]) -> tuple[float, str, float]:
    best_price = float("nan")
    best_exch = ""
    best_size = float("nan")
    for exch, (price, size) in asks.items():
        if _is_nan(price):
            continue
        if _is_nan(best_price) or price < best_price or (price == best_price and exch < best_exch):
            best_price = float(price)
            best_exch = exch
            best_size = float(size) if not _is_nan(size) else float("nan")
    return best_price, best_exch, best_size


def build_nbbo_event_stream(quotes: pd.DataFrame) -> pd.DataFrame:
    """Build a deterministic NBBO event stream from multi-venue quotes.

    - stable-sort by (sip_timestamp, sequence_number)
    - maintain per-venue top-of-book state (bid/ask per exchange)
        - at each event compute best_bid=max(bid_price across venues),
            best_ask=min(ask_price across venues)
    - keep all events (no dedup)

    Output uses lower_snake_case.
    """

    if quotes.empty:
        return pd.DataFrame(
            columns=[
                "symbol",
                "sip_timestamp",
                "sequence_number",
                "best_bid_price",
                "best_bid_exchange",
                "best_bid_size",
                "best_ask_price",
                "best_ask_exchange",
                "best_ask_size",
            ]
        )

    q = normalize_quotes_for_nbbo(quotes)
    q = q.sort_values(["sip_timestamp", "sequence_number"], kind="stable")

    bid_state: dict[str, tuple[float, float]] = {}
    ask_state: dict[str, tuple[float, float]] = {}

    best_bid_price = float("nan")
    best_bid_exch = ""
    best_bid_size = float("nan")
    best_ask_price = float("nan")
    best_ask_exch = ""
    best_ask_size = float("nan")

    out_best_bid_price: list[float] = []
    out_best_bid_exch: list[str] = []
    out_best_bid_size: list[float] = []
    out_best_ask_price: list[float] = []
    out_best_ask_exch: list[str] = []
    out_best_ask_size: list[float] = []

    for row in q.itertuples(index=False):
        be = row.bid_exchange
        ae = row.ask_exchange
        bp = row.bid_price
        ap = row.ask_price
        bs = row.bid_size
        a_s = row.ask_size

        if isinstance(be, str) and be:
            bid_state[be] = (
                float(bp) if not _is_nan(bp) else float("nan"),
                float(bs) if not _is_nan(bs) else float("nan"),
            )

            if be == best_bid_exch:
                # If the best venue worsens (or clears), we must rescan.
                if _is_nan(bp) or (_is_nan(best_bid_price) is False and float(bp) < best_bid_price):
                    best_bid_price, best_bid_exch, best_bid_size = _recompute_best_bid(bid_state)
                else:
                    # Improved or unchanged.
                    if _is_nan(best_bid_price) or float(bp) > best_bid_price:
                        best_bid_price = float(bp)
                        best_bid_size = float(bs) if not _is_nan(bs) else float("nan")
                    elif float(bp) == best_bid_price:
                        best_bid_size = float(bs) if not _is_nan(bs) else best_bid_size
            else:
                if _is_nan(best_bid_price) or (
                    not _is_nan(bp)
                    and (
                        float(bp) > best_bid_price
                        or (float(bp) == best_bid_price and be < best_bid_exch)
                    )
                ):
                    best_bid_price = float(bp)
                    best_bid_exch = be
                    best_bid_size = float(bs) if not _is_nan(bs) else float("nan")

        if isinstance(ae, str) and ae:
            ask_state[ae] = (
                float(ap) if not _is_nan(ap) else float("nan"),
                float(a_s) if not _is_nan(a_s) else float("nan"),
            )

            if ae == best_ask_exch:
                # If the best venue worsens (or clears), we must rescan.
                if _is_nan(ap) or (_is_nan(best_ask_price) is False and float(ap) > best_ask_price):
                    best_ask_price, best_ask_exch, best_ask_size = _recompute_best_ask(ask_state)
                else:
                    # Improved or unchanged.
                    if _is_nan(best_ask_price) or float(ap) < best_ask_price:
                        best_ask_price = float(ap)
                        best_ask_size = float(a_s) if not _is_nan(a_s) else float("nan")
                    elif float(ap) == best_ask_price:
                        best_ask_size = float(a_s) if not _is_nan(a_s) else best_ask_size
            else:
                if _is_nan(best_ask_price) or (
                    not _is_nan(ap)
                    and (
                        float(ap) < best_ask_price
                        or (float(ap) == best_ask_price and ae < best_ask_exch)
                    )
                ):
                    best_ask_price = float(ap)
                    best_ask_exch = ae
                    best_ask_size = float(a_s) if not _is_nan(a_s) else float("nan")

        out_best_bid_price.append(best_bid_price)
        out_best_bid_exch.append(best_bid_exch)
        out_best_bid_size.append(best_bid_size)
        out_best_ask_price.append(best_ask_price)
        out_best_ask_exch.append(best_ask_exch)
        out_best_ask_size.append(best_ask_size)

    out = q.copy()
    out["best_bid_price"] = out_best_bid_price
    out["best_bid_exchange"] = pd.Series(out_best_bid_exch, dtype="string")
    out["best_bid_size"] = out_best_bid_size
    out["best_ask_price"] = out_best_ask_price
    out["best_ask_exchange"] = pd.Series(out_best_ask_exch, dtype="string")
    out["best_ask_size"] = out_best_ask_size

    return out.reset_index(drop=True)


def write_symbol_day_nbbo_parquet(
    *,
    base_dir: Path,
    symbol: str,
    day: dt.date,
    nbbo: pd.DataFrame,
) -> Path:
    """Write NBBO events partitioned by symbol/year/month/day.

    Uses the same partition directory convention as bars.
    """

    part_dir = cache_partition_path(base_dir, symbol, day)
    part_dir.mkdir(parents=True, exist_ok=True)

    out_path = part_dir / "part-0000.parquet"

    sym = symbol.upper()
    nbbo = nbbo[nbbo["symbol"].astype(str).str.upper() == sym].copy()

    start = pd.Timestamp(day, tz="UTC")
    end = start + pd.Timedelta(days=1)
    nbbo["sip_timestamp"] = pd.to_datetime(nbbo["sip_timestamp"], utc=True, errors="coerce")
    nbbo = nbbo[(nbbo["sip_timestamp"] >= start) & (nbbo["sip_timestamp"] < end)]

    nbbo.to_parquet(out_path, index=False)
    return out_path


def build_and_write_nbbo_cache_for_day(
    *,
    data_path: Path,
    cache_dir: Path,
    day: dt.date,
    symbols: list[str],
) -> list[Path]:
    """Build and write NBBO caches for `symbols` on `day`.

    Reads the daily multi-ticker quotes parquet under DATA_PATH and writes
    per-symbol partitions to `cache_dir/nbbo/`.
    """

    sym_set = {s.strip().upper() for s in symbols if s.strip()}
    if not sym_set:
        return []

    quotes_path = quotes_daily_parquet_path(data_path=data_path, day=day)
    quotes = pd.read_parquet(quotes_path)
    if quotes.empty:
        return []

    if "Ticker" not in quotes.columns:
        raise ValueError(
            "Quotes parquet missing required 'Ticker' column. "
            f"Columns: {list(quotes.columns)}"
        )

    quotes = quotes[quotes["Ticker"].astype(str).str.upper().isin(sym_set)].copy()
    if quotes.empty:
        return []

    nbbo = build_nbbo_event_stream(quotes)

    out_base = Path(cache_dir) / "nbbo"
    paths: list[Path] = []
    for sym in sorted(sym_set):
        paths.append(
            write_symbol_day_nbbo_parquet(base_dir=out_base, symbol=sym, day=day, nbbo=nbbo)
        )

    return paths
