import numpy as np
import pandas as pd

from baytrader.dataset_builder import (
    align_inner_join_ohlcv,
    contiguous_window_end_mask,
    filter_rth_only,
    stable_dedup_keep_last,
)


def _ohlcv_df(symbol: str, timestamps: list[pd.Timestamp]) -> pd.DataFrame:
    n = len(timestamps)
    return pd.DataFrame(
        {
            "symbol": [symbol] * n,
            "timestamp": timestamps,
            "open": np.arange(n, dtype=float) + 1.0,
            "high": np.arange(n, dtype=float) + 2.0,
            "low": np.arange(n, dtype=float) + 0.5,
            "close": np.arange(n, dtype=float) + 1.5,
            "volume": np.arange(n, dtype=float) + 10.0,
        }
    )


def test_filter_rth_only_uses_et_clock_standard_time() -> None:
    # 2025-01-02 is a weekday during EST (UTC-5).
    ts = [
        pd.Timestamp("2025-01-02T14:29:00Z"),  # 09:29 ET (exclude)
        pd.Timestamp("2025-01-02T14:30:00Z"),  # 09:30 ET (include)
        pd.Timestamp("2025-01-02T20:59:00Z"),  # 15:59 ET (include)
        pd.Timestamp("2025-01-02T21:00:00Z"),  # 16:00 ET (exclude)
    ]
    df = _ohlcv_df("MSFT", ts)
    out = filter_rth_only(df)
    assert list(out["timestamp"]) == [ts[1], ts[2]]


def test_filter_rth_only_handles_dst() -> None:
    # 2025-07-01 is a weekday during EDT (UTC-4).
    ts = [
        pd.Timestamp("2025-07-01T13:29:00Z"),  # 09:29 ET (exclude)
        pd.Timestamp("2025-07-01T13:30:00Z"),  # 09:30 ET (include)
    ]
    df = _ohlcv_df("MSFT", ts)
    out = filter_rth_only(df)
    assert list(out["timestamp"]) == [ts[1]]


def test_stable_dedup_keep_last_keeps_last_row() -> None:
    t = pd.Timestamp("2025-01-02T14:30:00Z")
    df = pd.DataFrame(
        {
            "timestamp": [t, t],
            "close": [100.0, 101.0],
        }
    )
    out = stable_dedup_keep_last(df, subset=["timestamp"])
    assert out.shape[0] == 1
    assert float(out.iloc[0]["close"]) == 101.0


def test_align_inner_join_and_dropna() -> None:
    t0 = pd.Timestamp("2025-01-02T14:30:00Z")
    t1 = pd.Timestamp("2025-01-02T14:31:00Z")

    msft = _ohlcv_df("MSFT", [t0, t1])
    spy = _ohlcv_df("SPY", [t0, t1])
    spy.loc[1, "volume"] = np.nan  # should be dropped

    aligned = align_inner_join_ohlcv(
        master_timestamps=pd.Series([t0, t1]),
        per_symbol={"MSFT": msft, "SPY": spy},
        required_symbols=["MSFT", "SPY"],
    )

    assert list(aligned["timestamp"]) == [t0]
    assert aligned.isna().sum().sum() == 0
    assert "MSFT_close" in aligned.columns
    assert "SPY_close" in aligned.columns


def test_contiguous_window_end_mask_drops_gaps() -> None:
    # timestamps: 0,1,2,4,5,6 minutes (gap between 2 and 4)
    base = pd.Timestamp("2025-01-02T14:30:00Z")
    ts = pd.to_datetime(
        [
            base + pd.Timedelta(minutes=0),
            base + pd.Timedelta(minutes=1),
            base + pd.Timedelta(minutes=2),
            base + pd.Timedelta(minutes=4),
            base + pd.Timedelta(minutes=5),
            base + pd.Timedelta(minutes=6),
        ],
        utc=True,
    )

    # With lookback=2,horizon=1, eligible ends in a contiguous run of length 3 are indices 1..1.
    mask = contiguous_window_end_mask(ts, lookback=2, horizon=1)
    assert mask.tolist() == [False, True, False, False, True, False]
