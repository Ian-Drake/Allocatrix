from __future__ import annotations

import os
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import time


def _getenv_str(name: str, default: str) -> str:
    v = os.environ.get(name)
    if v is None:
        return default
    v = v.strip()
    return v if v != "" else default


def _parse_csv_set(raw: str) -> frozenset[str]:
    raw = (raw or "").strip()
    if raw == "":
        return frozenset()
    parts = [p.strip() for p in raw.split(",")]
    parts = [p for p in parts if p]
    return frozenset(parts)


def _parse_csv_int_set(raw: str) -> frozenset[int]:
    raw = (raw or "").strip()
    if raw == "":
        return frozenset()
    out: set[int] = set()
    for p in raw.split(","):
        p = p.strip()
        if not p:
            continue
        out.add(int(p))
    return frozenset(out)


def _parse_hhmm(raw: str) -> time:
    raw = raw.strip()
    hh, mm = raw.split(":")
    return time(hour=int(hh), minute=int(mm))


@dataclass(frozen=True)
class TradeCleaningConfig:
    market_tz: str = "America/New_York"
    rth_start: time = time(9, 30)
    rth_end: time = time(16, 0)

    stale_quote_ns: int = 2_000_000_000
    off_nbbo_abs_tol_usd: float = 0.01
    off_nbbo_spread_mult: float = 0.5

    trade_correction_allowlist: frozenset[int] = frozenset({0})
    trade_conditions_allowlist: frozenset[str] | None = None


def load_trade_cleaning_config_from_env() -> TradeCleaningConfig:
    market_tz = _getenv_str("BAYTRADER_MARKET_TZ", "America/New_York")
    rth_start = _parse_hhmm(_getenv_str("BAYTRADER_RTH_START", "09:30"))
    rth_end = _parse_hhmm(_getenv_str("BAYTRADER_RTH_END", "16:00"))

    stale_quote_ns = int(_getenv_str("BAYTRADER_STALE_QUOTE_NS", "2000000000"))
    off_nbbo_abs_tol_usd = float(_getenv_str("BAYTRADER_OFF_NBBO_ABS_TOL_USD", "0.01"))
    off_nbbo_spread_mult = float(_getenv_str("BAYTRADER_OFF_NBBO_SPREAD_MULT", "0.5"))

    corr_raw = _getenv_str("BAYTRADER_TRADE_CORRECTION_ALLOWLIST", "0")
    corr_allow = _parse_csv_int_set(corr_raw)
    if not corr_allow:
        corr_allow = frozenset({0})

    cond_raw = os.environ.get("BAYTRADER_TRADE_CONDITIONS_ALLOWLIST", "")
    cond_set = _parse_csv_set(cond_raw)
    cond_allow: frozenset[str] | None = None
    if cond_raw is not None and cond_raw.strip() != "":
        cond_allow = cond_set

    return TradeCleaningConfig(
        market_tz=market_tz,
        rth_start=rth_start,
        rth_end=rth_end,
        stale_quote_ns=stale_quote_ns,
        off_nbbo_abs_tol_usd=off_nbbo_abs_tol_usd,
        off_nbbo_spread_mult=off_nbbo_spread_mult,
        trade_correction_allowlist=corr_allow,
        trade_conditions_allowlist=cond_allow,
    )


def env_allowlist_or_none(*, name: str) -> frozenset[str] | None:
    raw = os.environ.get(name, "")
    if raw.strip() == "":
        return None
    return _parse_csv_set(raw)


def ensure_upper_symbols(symbols: Iterable[str]) -> list[str]:
    return [s.strip().upper() for s in symbols if s.strip()]
