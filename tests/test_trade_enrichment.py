from __future__ import annotations

import datetime as dt

import pandas as pd

from baytrader.config import TradeCleaningConfig
from baytrader.trade_enrichment import (
    apply_trade_cleaning_contract,
    build_bars_1m_from_trades,
    enrich_trades_with_asof_nbbo,
)


def _nbbo_fixture() -> pd.DataFrame:
    # 2025-12-18 is EST (UTC-5): 09:30 ET == 14:30Z.
    t_pre = pd.Timestamp("2025-12-18T14:29:00Z")
    t0 = pd.Timestamp("2025-12-18T14:30:00Z")
    t1 = pd.Timestamp("2025-12-18T14:30:02Z")
    return pd.DataFrame(
        {
            "symbol": ["MSFT", "MSFT", "MSFT"],
            "sip_timestamp": [t_pre, t0, t1],
            "sequence_number": [1, 2, 3],
            "best_bid_price": [100.00, 100.00, 100.00],
            "best_ask_price": [100.20, 100.20, 100.20],
        }
    )


def _base_trade_row(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "ticker": "MSFT",
        "conditions": "A",
        "correction": 0,
        "exchange": "X",
        "id": "t1",
        "participant_timestamp": pd.Timestamp("2025-12-18T14:30:01Z"),
        "price": 100.10,
        "sequence_number": 10,
        "sip_timestamp": pd.Timestamp("2025-12-18T14:30:01Z"),
        "size": 10,
        "tape": "A",
        "trf_id": "",
        "trf_timestamp": pd.NaT,
    }
    base.update(overrides)
    return base


def test_trade_cleaning_filters_enforced() -> None:
    nbbo = _nbbo_fixture()

    trades = pd.DataFrame(
        [
            _base_trade_row(id="keep"),
            # Outside RTH: 09:29 ET (has NBBO snapshot available)
            _base_trade_row(id="rth_drop", sip_timestamp=pd.Timestamp("2025-12-18T14:29:00Z")),
            # Correction drop
            _base_trade_row(id="corr_drop", correction=1),
            # Conditions drop (not subset of allowlist)
            _base_trade_row(id="cond_drop", conditions="X"),
            # Stale quote drop (latest NBBO at 14:30:02Z, trade at 14:30:10Z => 8s)
            _base_trade_row(id="stale_drop", sip_timestamp=pd.Timestamp("2025-12-18T14:30:10Z")),
            # Off-NBBO drop (far below bid)
            _base_trade_row(id="off_nbbo_drop", price=99.00),
        ]
    )

    enriched = enrich_trades_with_asof_nbbo(trades=trades, nbbo=nbbo)

    cfg = TradeCleaningConfig(
        market_tz="America/New_York",
        rth_start=dt.time(9, 30),
        rth_end=dt.time(16, 0),
        stale_quote_ns=2_000_000_000,
        off_nbbo_abs_tol_usd=0.01,
        off_nbbo_spread_mult=0.5,
        trade_correction_allowlist=frozenset({0}),
        trade_conditions_allowlist=frozenset({"A", "B"}),
    )

    cleaned = apply_trade_cleaning_contract(enriched_trades=enriched, cfg=cfg)

    assert cleaned["id"].tolist() == ["keep"]


def test_build_bars_1m_known_minute_ohlcv_vwap() -> None:
    # Two trades in the same minute; one in the next minute.
    trades = pd.DataFrame(
        [
            {
                "symbol": "MSFT",
                "id": "a",
                "sip_timestamp": pd.Timestamp("2025-12-18T14:30:01Z"),
                "sequence_number": 1,
                "price": 100.00,
                "size": 10,
            },
            {
                "symbol": "MSFT",
                "id": "b",
                "sip_timestamp": pd.Timestamp("2025-12-18T14:30:40Z"),
                "sequence_number": 2,
                "price": 101.00,
                "size": 20,
            },
            {
                "symbol": "MSFT",
                "id": "c",
                "sip_timestamp": pd.Timestamp("2025-12-18T14:31:00Z"),
                "sequence_number": 3,
                "price": 99.00,
                "size": 5,
            },
        ]
    )

    bars = build_bars_1m_from_trades(trades=trades)
    assert bars.shape[0] == 2

    first = bars.iloc[0]
    assert first["timestamp"] == pd.Timestamp("2025-12-18T14:30:00Z")
    assert float(first["open"]) == 100.00
    assert float(first["high"]) == 101.00
    assert float(first["low"]) == 100.00
    assert float(first["close"]) == 101.00
    assert float(first["volume"]) == 30
    assert abs(float(first["vwap"]) - ((100 * 10 + 101 * 20) / 30)) < 1e-12
    assert int(first["trades"]) == 2

    second = bars.iloc[1]
    assert second["timestamp"] == pd.Timestamp("2025-12-18T14:31:00Z")
    assert float(second["open"]) == 99.00
    assert float(second["close"]) == 99.00
    assert float(second["volume"]) == 5
    assert int(second["trades"]) == 1
