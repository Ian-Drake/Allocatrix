import datetime as dt

import pandas as pd

from baytrader.cache import build_nbbo_event_stream, write_symbol_day_nbbo_parquet


def test_build_nbbo_event_stream_multi_venue_quotes() -> None:
    # Two venues (X, Y) update their top-of-book over time.
    # Ensure stable sorting by (sip_timestamp, sequence_number) and that all events are kept.
    t0 = pd.Timestamp("2025-12-18T14:30:00Z")
    t1 = pd.Timestamp("2025-12-18T14:30:01Z")

    quotes = pd.DataFrame(
        {
            "Ticker": ["MSFT", "MSFT", "MSFT", "MSFT"],
            "sip_timestamp": [t0, t0, t1, t1],
            "sequence_number": [1, 2, 1, 2],
            "bid_exchange": ["X", "Y", "X", "Y"],
            "bid_price": [100.00, 99.00, 100.20, 100.10],
            "bid_size": [10, 5, 11, 6],
            "ask_exchange": ["X", "Y", "X", "Y"],
            "ask_price": [101.00, 100.50, 101.20, 101.50],
            "ask_size": [12, 7, 13, 8],
            "conditions": [None, None, None, None],
            "indicators": [None, None, None, None],
            "participant_timestamp": [t0, t0, t1, t1],
            "tape": ["A", "A", "A", "A"],
            "trf_timestamp": [pd.NaT, pd.NaT, pd.NaT, pd.NaT],
        }
    )

    out = build_nbbo_event_stream(quotes)

    # Keep all events.
    assert out.shape[0] == quotes.shape[0]

    # Deterministic order: stable sort by (sip_timestamp, sequence_number).
    assert list(out["sip_timestamp"]) == [t0, t0, t1, t1]
    assert list(out["sequence_number"].astype(int)) == [1, 2, 1, 2]

    # NBBO evolution:
    # e1: X 100 / 101 -> best_bid=100(X), best_ask=101(X)
    # e2: Y 99 / 100.5 -> best_bid=100(X), best_ask=100.5(Y)
    # e3: X 100.2 / 101.2 -> best_bid=100.2(X), best_ask=100.5(Y)
    # e4: Y 100.1 / 101.5 -> best_bid=100.2(X), best_ask=101.2(X)
    assert out["best_bid_price"].tolist() == [100.0, 100.0, 100.2, 100.2]
    assert out["best_ask_price"].tolist() == [101.0, 100.5, 100.5, 101.2]

    assert out["best_bid_exchange"].tolist() == ["X", "X", "X", "X"]
    assert out["best_ask_exchange"].tolist() == ["X", "Y", "Y", "X"]


def test_build_nbbo_event_stream_tiebreak_exchange_name() -> None:
    # Tie on best bid and best ask prices: exchange name should break ties deterministically.
    t0 = pd.Timestamp("2025-12-18T14:30:00Z")

    quotes = pd.DataFrame(
        {
            "Ticker": ["MSFT", "MSFT"],
            "sip_timestamp": [t0, t0],
            "sequence_number": [1, 2],
            "bid_exchange": ["B", "A"],
            "bid_price": [100.00, 100.00],
            "bid_size": [10, 10],
            "ask_exchange": ["B", "A"],
            "ask_price": [100.20, 100.20],
            "ask_size": [12, 12],
            "conditions": [None, None],
            "indicators": [None, None],
            "participant_timestamp": [t0, t0],
            "tape": ["A", "A"],
            "trf_timestamp": [pd.NaT, pd.NaT],
        }
    )

    out = build_nbbo_event_stream(quotes)

    assert out.loc[1, "best_bid_price"] == 100.00
    assert out.loc[1, "best_bid_exchange"] == "A"  # "A" < "B"
    assert out.loc[1, "best_ask_price"] == 100.20
    assert out.loc[1, "best_ask_exchange"] == "A"


def test_write_symbol_day_nbbo_parquet_roundtrip(tmp_path) -> None:
    t0 = pd.Timestamp("2025-12-18T14:30:00Z")
    quotes = pd.DataFrame(
        {
            "Ticker": ["MSFT"],
            "sip_timestamp": [t0],
            "sequence_number": [1],
            "bid_exchange": ["X"],
            "bid_price": [100.00],
            "bid_size": [10],
            "ask_exchange": ["X"],
            "ask_price": [101.00],
            "ask_size": [12],
            "conditions": [None],
            "indicators": [None],
            "participant_timestamp": [t0],
            "tape": ["A"],
            "trf_timestamp": [pd.NaT],
        }
    )
    nbbo = build_nbbo_event_stream(quotes)

    out_path = write_symbol_day_nbbo_parquet(
        base_dir=tmp_path,
        symbol="MSFT",
        day=dt.date(2025, 12, 18),
        nbbo=nbbo,
    )
    assert out_path.exists()

    loaded = pd.read_parquet(out_path)
    assert loaded.shape[0] == 1
    assert float(loaded.loc[0, "best_bid_price"]) == 100.00
