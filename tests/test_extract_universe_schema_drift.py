from __future__ import annotations

from pathlib import Path

import pandas as pd

from baytrader.extract_universe import extract_daily_file_to_parquet


def test_extract_csv_to_parquet_handles_indicators_schema_drift(tmp_path: Path) -> None:
    # Construct a CSV where the first chunk has numeric indicators
    # and a later chunk has string indicators, which previously caused
    # ParquetWriter schema mismatches during chunked ingestion.
    raw_path = tmp_path / "quotes.csv"
    out_path = tmp_path / "quotes.parquet"

    df = pd.DataFrame(
        {
            "ticker": ["SPY", "SPY", "SPY", "SPY"],
            "ask_exchange": [1, 1, 1, 1],
            "ask_price": [100.0, 100.1, 100.2, 100.3],
            "ask_size": [10, 11, 12, 13],
            "bid_exchange": [2, 2, 2, 2],
            "bid_price": [99.9, 100.0, 100.1, 100.2],
            "bid_size": [9, 10, 11, 12],
            "conditions": ["", "", "", ""],
            "indicators": [1, 2, "A", "B"],
            "participant_timestamp": [1, 2, 3, 4],
            "sequence_number": [1, 2, 3, 4],
            "sip_timestamp": [1, 2, 3, 4],
            "tape": [1, 1, 1, 1],
            "trf_timestamp": [0, 0, 0, 0],
        }
    )

    df.to_csv(raw_path, index=False)

    rows = extract_daily_file_to_parquet(
        raw_path=raw_path,
        out_path=out_path,
        universe=frozenset({"SPY"}),
        chunk_rows=2,
    )

    assert rows == 4
    assert out_path.exists() and out_path.stat().st_size > 0

    import pyarrow as pa
    import pyarrow.parquet as pq

    schema = pq.read_schema(out_path)
    ind = schema.field("indicators").type
    assert ind == pa.string() or ind == pa.large_string()
