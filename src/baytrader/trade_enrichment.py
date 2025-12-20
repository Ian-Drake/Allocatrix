from __future__ import annotations

import datetime as dt
import math
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd

from baytrader.cache import cache_partition_path, write_symbol_day_parquet
from baytrader.config import TradeCleaningConfig, load_trade_cleaning_config_from_env

_TRADES_REQUIRED_COLS = [
    "ticker",
    "conditions",
    "correction",
    "exchange",
    "id",
    "participant_timestamp",
    "price",
    "sequence_number",
    "sip_timestamp",
    "size",
    "tape",
    "trf_id",
    "trf_timestamp",
]


def trades_daily_parquet_path(*, data_path: Path, day: dt.date) -> Path:
    """Task 1.2 input layout:

    DATA_PATH/us_stocks_sip/trades_v1/YYYY/MM/YYYY-MM-DD.parquet
    """

    return (
        data_path
        / "us_stocks_sip"
        / "trades_v1"
        / f"{day.year:04d}"
        / f"{day.month:02d}"
        / f"{day:%Y-%m-%d}.parquet"
    )


def load_nbbo_partition(*, cache_dir: Path, symbol: str, day: dt.date) -> pd.DataFrame:
    part_dir = cache_partition_path(Path(cache_dir) / "nbbo", symbol.upper(), day)
    if not part_dir.exists():
        return pd.DataFrame()
    files = sorted(part_dir.glob("*.parquet"))
    if not files:
        return pd.DataFrame()
    dfs = [pd.read_parquet(p) for p in files]
    df = pd.concat(dfs, ignore_index=True) if len(dfs) > 1 else dfs[0]

    if df.empty:
        return df

    df = df.copy()
    df["symbol"] = df["symbol"].astype(str).str.upper()
    df["sip_timestamp"] = pd.to_datetime(df["sip_timestamp"], utc=True, errors="coerce")
    if "sequence_number" in df.columns:
        df["sequence_number"] = pd.to_numeric(df["sequence_number"], errors="coerce").astype(
            "Int64"
        )

    df = df.sort_values(["sip_timestamp", "sequence_number"], kind="stable")
    return df.reset_index(drop=True)


def normalize_trades_for_enrichment(trades: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in _TRADES_REQUIRED_COLS if c not in trades.columns]
    if missing:
        raise ValueError(
            f"Trades missing required columns: {missing}. Columns: {list(trades.columns)}"
        )

    out = trades.copy()
    out["symbol"] = out["ticker"].astype(str).str.upper()

    out["sip_timestamp"] = pd.to_datetime(out["sip_timestamp"], utc=True, errors="coerce")
    out["participant_timestamp"] = pd.to_datetime(
        out["participant_timestamp"], utc=True, errors="coerce"
    )
    out["trf_timestamp"] = pd.to_datetime(out["trf_timestamp"], utc=True, errors="coerce")

    out["sequence_number"] = pd.to_numeric(out["sequence_number"], errors="coerce").astype(
        "Int64"
    )
    out["correction"] = pd.to_numeric(out["correction"], errors="coerce").astype("Int64")
    out["price"] = pd.to_numeric(out["price"], errors="coerce")
    out["size"] = pd.to_numeric(out["size"], errors="coerce")

    # Keep original columns but ensure join keys exist.
    out = out.dropna(subset=["symbol", "sip_timestamp", "price", "size"])
    out = out.sort_values(["symbol", "sip_timestamp", "sequence_number", "id"], kind="stable")
    return out.reset_index(drop=True)


def _is_nan(x: object) -> bool:
    return x is None or (isinstance(x, float) and math.isnan(x))


def _parse_conditions(value: object) -> frozenset[str]:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return frozenset()
    if isinstance(value, (list, tuple, set, frozenset)):
        return frozenset(str(v).strip() for v in value if str(v).strip() != "")
    if isinstance(value, str):
        s = value.strip()
        if s == "":
            return frozenset()
        # Common encodings: "A,B", "['A', 'B']", "A|B".
        for sep in [",", "|", ";"]:
            if sep in s:
                parts = [p.strip().strip("[](){}\"' ") for p in s.split(sep)]
                parts = [p for p in parts if p]
                return frozenset(parts)
        # Single token.
        return frozenset({s.strip().strip("[](){}\"' ")})

    return frozenset({str(value).strip()})


def enrich_trades_with_asof_nbbo(*, trades: pd.DataFrame, nbbo: pd.DataFrame) -> pd.DataFrame:
    """Attach as-of NBBO snapshot (nbbo_ts <= trade_ts) and compute quote_age_ns."""

    if trades.empty:
        return trades.copy()

    t = normalize_trades_for_enrichment(trades)

    if nbbo is None or nbbo.empty:
        out = t.copy()
        out["best_bid_price"] = pd.NA
        out["best_ask_price"] = pd.NA
        out["nbbo_ts"] = pd.NaT
        out["quote_age_ns"] = pd.NA
        return out

    q = nbbo.copy()
    q["symbol"] = q["symbol"].astype(str).str.upper()
    q["sip_timestamp"] = pd.to_datetime(q["sip_timestamp"], utc=True, errors="coerce")
    q["nbbo_ts"] = q["sip_timestamp"]
    if "sequence_number" in q.columns:
        q["sequence_number"] = pd.to_numeric(q["sequence_number"], errors="coerce").astype(
            "Int64"
        )

    q = q.sort_values(["symbol", "sip_timestamp", "sequence_number"], kind="stable")

    t = t.sort_values(["symbol", "sip_timestamp", "sequence_number", "id"], kind="stable")

    merged = pd.merge_asof(
        t,
        q,
        by="symbol",
        on="sip_timestamp",
        direction="backward",
        allow_exact_matches=True,
        suffixes=("", "_nbbo"),
    )

    # quote_age_ns = trade_ts - nbbo_ts
    trade_ns = merged["sip_timestamp"].astype("int64")
    nbbo_ns = merged["nbbo_ts"].astype("int64")
    merged["quote_age_ns"] = trade_ns - nbbo_ns

    return merged


def _rth_mask(
    ts_utc: pd.Series,
    *,
    market_tz: str,
    rth_start: dt.time,
    rth_end: dt.time,
) -> pd.Series:
    ts = pd.to_datetime(ts_utc, utc=True)
    tz = ZoneInfo(market_tz)
    ts_local = ts.dt.tz_convert(tz)

    dow_ok = ts_local.dt.dayofweek < 5
    minutes = (ts_local.dt.hour * 60 + ts_local.dt.minute).astype(int)
    start_m = rth_start.hour * 60 + rth_start.minute
    end_m = rth_end.hour * 60 + rth_end.minute
    rth_ok = (minutes >= start_m) & (minutes < end_m)
    return dow_ok & rth_ok


def apply_trade_cleaning_contract(
    *,
    enriched_trades: pd.DataFrame,
    cfg: TradeCleaningConfig,
) -> pd.DataFrame:
    """Apply Task 1.2 filters to enriched trades."""

    if enriched_trades.empty:
        return enriched_trades.copy()

    df = enriched_trades.copy()

    df["sip_timestamp"] = pd.to_datetime(df["sip_timestamp"], utc=True, errors="coerce")

    mask = _rth_mask(
        df["sip_timestamp"],
        market_tz=cfg.market_tz,
        rth_start=cfg.rth_start,
        rth_end=cfg.rth_end,
    )

    # Corrections allowlist.
    corr = pd.to_numeric(df["correction"], errors="coerce").astype("Int64")
    mask &= corr.isin(list(cfg.trade_correction_allowlist))

    # Conditions allowlist (if configured).
    if cfg.trade_conditions_allowlist is not None:
        allow = set(cfg.trade_conditions_allowlist)

        def _ok(val: object) -> bool:
            conds = _parse_conditions(val)
            # subset-of allowlist
            return all(c in allow for c in conds)

        mask &= df["conditions"].map(_ok)

    # Must have NBBO snapshot.
    mask &= df["nbbo_ts"].notna()
    mask &= pd.to_numeric(df["best_bid_price"], errors="coerce").notna()
    mask &= pd.to_numeric(df["best_ask_price"], errors="coerce").notna()

    # Stale quotes.
    age = pd.to_numeric(df["quote_age_ns"], errors="coerce")
    mask &= age <= int(cfg.stale_quote_ns)
    mask &= age >= 0

    # Off-NBBO tolerance.
    price = pd.to_numeric(df["price"], errors="coerce")
    bid = pd.to_numeric(df["best_bid_price"], errors="coerce")
    ask = pd.to_numeric(df["best_ask_price"], errors="coerce")
    spread = ask - bid
    tol = spread * float(cfg.off_nbbo_spread_mult)
    tol = tol.where(tol.notna(), other=0.0)
    tol = tol.clip(lower=float(cfg.off_nbbo_abs_tol_usd))

    mask &= price >= (bid - tol)
    mask &= price <= (ask + tol)

    out = df.loc[mask].copy()

    # Deterministic ordering for downstream aggregation.
    out = out.sort_values(["symbol", "sip_timestamp", "sequence_number", "id"], kind="stable")
    return out.reset_index(drop=True)


def build_bars_1m_from_trades(*, trades: pd.DataFrame) -> pd.DataFrame:
    """Build trade-derived 1-minute OHLCV + VWAP + trade count.

    Minute timestamp is UTC minute start.
    Deterministic aggregation: stable sorting; open=first trade, close=last.
    """

    if trades.empty:
        return pd.DataFrame(
            columns=[
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
        )

    df = trades.copy()
    df["symbol"] = df["symbol"].astype(str).str.upper()
    df["sip_timestamp"] = pd.to_datetime(df["sip_timestamp"], utc=True, errors="coerce")
    df["sequence_number"] = pd.to_numeric(df.get("sequence_number"), errors="coerce").astype(
        "Int64"
    )
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["size"] = pd.to_numeric(df["size"], errors="coerce")

    df = df.dropna(subset=["symbol", "sip_timestamp", "price", "size"])
    df = df.sort_values(["symbol", "sip_timestamp", "sequence_number", "id"], kind="stable")

    df["timestamp"] = df["sip_timestamp"].dt.floor("min")
    df["dollar"] = df["price"] * df["size"]

    g = df.groupby(["symbol", "timestamp"], sort=False)

    out = pd.DataFrame(
        {
            "symbol": g["symbol"].first().astype("string"),
            "timestamp": g["timestamp"].first(),
            "open": g["price"].first(),
            "high": g["price"].max(),
            "low": g["price"].min(),
            "close": g["price"].last(),
            "volume": g["size"].sum(),
            "trades": g.size().astype(int),
            "_dollar": g["dollar"].sum(),
        }
    ).reset_index(drop=True)

    out["vwap"] = out["_dollar"] / out["volume"]
    out = out.drop(columns=["_dollar"])

    out["timestamp"] = pd.to_datetime(out["timestamp"], utc=True, errors="coerce")

    out = out.sort_values(["symbol", "timestamp"], kind="stable").reset_index(drop=True)
    return out


def write_symbol_day_trades_enriched_parquet(
    *,
    base_dir: Path,
    symbol: str,
    day: dt.date,
    trades: pd.DataFrame,
) -> Path:
    part_dir = cache_partition_path(base_dir, symbol.upper(), day)
    part_dir.mkdir(parents=True, exist_ok=True)
    out_path = part_dir / "part-0000.parquet"

    sym = symbol.upper()
    df = trades.copy()
    df["symbol"] = df["symbol"].astype(str).str.upper()
    df = df[df["symbol"] == sym]
    df["sip_timestamp"] = pd.to_datetime(df["sip_timestamp"], utc=True, errors="coerce")

    start = pd.Timestamp(day, tz="UTC")
    end = start + pd.Timedelta(days=1)
    df = df[(df["sip_timestamp"] >= start) & (df["sip_timestamp"] < end)]

    df = df.sort_values(["sip_timestamp", "sequence_number", "id"], kind="stable")
    df.to_parquet(out_path, index=False)
    return out_path


def build_and_write_trades_enriched_and_bars_1m_for_day(
    *,
    data_path: Path,
    cache_dir: Path,
    day: dt.date,
    symbols: list[str],
    cfg: TradeCleaningConfig | None = None,
) -> tuple[list[Path], list[Path]]:
    """End-to-end Task 1.2 for one day.

    Reads daily multi-ticker trades parquet from DATA_PATH.
    Joins to already-built NBBO cache under cache_dir/nbbo.
    Writes:
      - cache_dir/trades_enriched/...
      - cache_dir/bars_1m/...
    """

    if cfg is None:
        cfg = load_trade_cleaning_config_from_env()

    sym_set = {s.strip().upper() for s in symbols if s.strip()}
    if not sym_set:
        return ([], [])

    trades_path = trades_daily_parquet_path(data_path=data_path, day=day)
    trades_raw = pd.read_parquet(trades_path)
    trades_raw = trades_raw[trades_raw["ticker"].astype(str).str.upper().isin(sym_set)].copy()
    if trades_raw.empty:
        return ([], [])

    trades_norm = normalize_trades_for_enrichment(trades_raw)

    out_trades_paths: list[Path] = []
    out_bars_paths: list[Path] = []

    enriched_base = Path(cache_dir) / "trades_enriched"
    bars_base = Path(cache_dir) / "bars_1m"

    for sym in sorted(sym_set):
        sym_trades = trades_norm[trades_norm["symbol"] == sym].copy()
        if sym_trades.empty:
            continue

        nbbo = load_nbbo_partition(cache_dir=cache_dir, symbol=sym, day=day)
        enriched = enrich_trades_with_asof_nbbo(trades=sym_trades, nbbo=nbbo)
        filtered = apply_trade_cleaning_contract(enriched_trades=enriched, cfg=cfg)

        out_trades_paths.append(
            write_symbol_day_trades_enriched_parquet(
                base_dir=enriched_base, symbol=sym, day=day, trades=filtered
            )
        )

        bars = build_bars_1m_from_trades(trades=filtered)
        out_bars_paths.append(
            write_symbol_day_parquet(base_dir=bars_base, symbol=sym, day=day, bars=bars)
        )

    return (out_trades_paths, out_bars_paths)
