from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class UniverseConfig:
    tickers: frozenset[str]


def load_universe_csv(*, data_path: Path) -> UniverseConfig:
    """Load DATA_PATH/Universe.CSV.

    Universe.CSV must exist at the root of DATA_PATH and contain a single column
    named 'Ticker'. Values are stripped and uppercased.

    Raises:
        ValueError: if the file is missing, malformed, or contains zero tickers.
    """

    universe_path = data_path / "Universe.CSV"
    if not universe_path.exists():
        raise ValueError(
            f"Universe.CSV not found at {universe_path}. Create {universe_path} with a 'Ticker' column."
        )

    import pandas as pd

    try:
        df = pd.read_csv(universe_path)
    except Exception as e:  # pragma: no cover
        raise ValueError(f"Failed to read Universe.CSV at {universe_path}: {e}") from e

    if "Ticker" not in df.columns:
        raise ValueError(
            f"Universe.CSV at {universe_path} must contain a 'Ticker' column. Found: {list(df.columns)}"
        )

    tickers = (
        df["Ticker"]
        .astype("string")
        .str.strip()
        .str.upper()
        .dropna()
        .tolist()
    )
    tickers = [t for t in tickers if t]

    if not tickers:
        raise ValueError(
            f"Universe.CSV at {universe_path} is empty. Add at least one row under the 'Ticker' column."
        )

    return UniverseConfig(tickers=frozenset(tickers))


def detect_ticker_column(columns: Iterable[str]) -> str:
    """Return the ticker column name in the source file.

    Supports common Massive/Polygon flat-file headers:
    - ticker
    - symbol

    Raises:
        ValueError: if no suitable column is found.
    """

    cols = list(columns)
    lowered = {c.lower(): c for c in cols}

    for candidate in ("ticker", "symbol"):
        if candidate in lowered:
            return lowered[candidate]

    raise ValueError(
        "No ticker column found. Expected one of: ticker, symbol. "
        f"Found columns: {cols}"
    )


def daily_parquet_path_for_raw(*, raw_path: Path) -> Path:
    name = raw_path.name
    if name.endswith(".csv.gz"):
        base = name[: -len(".csv.gz")]
    elif name.endswith(".csv"):
        base = name[: -len(".csv")]
    elif name.endswith(".parquet"):
        base = name[: -len(".parquet")]
    else:
        base = raw_path.stem
    return raw_path.with_name(f"{base}.parquet")


def parquet_num_rows(path: Path) -> int:
    import pyarrow.parquet as pq

    md = pq.read_metadata(path)
    return int(md.num_rows)


def is_nonempty_parquet(path: Path) -> bool:
    if not path.exists() or path.stat().st_size == 0:
        return False
    try:
        return parquet_num_rows(path) > 0
    except Exception:
        return False


def extract_daily_file_to_parquet(
    *,
    raw_path: Path,
    out_path: Path,
    universe: frozenset[str],
    chunk_rows: int = 500_000,
) -> int:
    """Filter a daily flat file to Universe tickers and write a single parquet.

    - Input: .csv, .csv.gz, or .parquet
    - Output: parquet next to the raw file
    - Keeps ALL input columns and column names (no renaming)
    - Preserves exact integer values by using pandas' pyarrow dtype backend.

    Returns:
        rows_written: number of filtered rows written to parquet.

    Raises:
        ValueError: if the input cannot be read or lacks a ticker column.
    """

    if raw_path.suffix.lower() == ".parquet":
        return _extract_parquet_to_parquet(raw_path=raw_path, out_path=out_path, universe=universe)

    return _extract_csv_to_parquet(
        raw_path=raw_path,
        out_path=out_path,
        universe=universe,
        chunk_rows=chunk_rows,
    )


def _extract_csv_to_parquet(
    *,
    raw_path: Path,
    out_path: Path,
    universe: frozenset[str],
    chunk_rows: int,
) -> int:
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq

    compression = "gzip" if raw_path.name.lower().endswith(".gz") else None

    # If an empty/stale parquet exists, overwrite it.
    if out_path.exists() and not is_nonempty_parquet(out_path):
        try:
            out_path.unlink()
        except Exception:
            pass

    writer: pq.ParquetWriter | None = None
    ticker_col: str | None = None
    rows_written = 0

    # Avoid pandas DtypeWarning for known mixed-type columns (e.g., trades 'conditions').
    # We keep these as strings to preserve exact values.
    try:
        header = pd.read_csv(
            raw_path,
            nrows=0,
            compression=compression,
            dtype_backend="pyarrow",
            low_memory=False,
        )
        dtype_overrides: dict[str, str] = {}
        for c in header.columns:
            lc = str(c).lower()
            # 'indicators' and 'conditions' are frequently mixed-type across rows/files.
            # Force them to strings so chunked reads don't infer different dtypes per chunk.
            if lc in {"ticker", "symbol", "conditions", "indicators"}:
                dtype_overrides[str(c)] = "string[pyarrow]"
    except Exception:
        dtype_overrides = {}

    try:
        import warnings

        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=pd.errors.DtypeWarning)

            for chunk in pd.read_csv(
                raw_path,
                chunksize=chunk_rows,
                compression=compression,
                dtype_backend="pyarrow",
                dtype=dtype_overrides or None,
                low_memory=False,
            ):
                if ticker_col is None:
                    ticker_col = detect_ticker_column(chunk.columns)

                tick = chunk[ticker_col].astype("string[pyarrow]").str.upper()
                filtered = chunk.loc[tick.isin(universe)]
                if filtered.empty:
                    continue

                table = pa.Table.from_pandas(filtered, preserve_index=False)
                if writer is None:
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    writer = pq.ParquetWriter(out_path, table.schema, compression="zstd")

                writer.write_table(table)
                rows_written += int(filtered.shape[0])
    finally:
        if writer is not None:
            writer.close()

    return rows_written


def _extract_parquet_to_parquet(*, raw_path: Path, out_path: Path, universe: frozenset[str]) -> int:
    import pyarrow as pa
    import pyarrow.dataset as ds
    import pyarrow.parquet as pq

    dataset = ds.dataset(raw_path)
    ticker_col = detect_ticker_column(dataset.schema.names)

    # For parquet inputs, assume tickers are already normalized (typically uppercase).
    expr = ds.field(ticker_col).isin(list(universe))
    scanner = dataset.scanner(filter=expr)

    # If an empty/stale parquet exists, overwrite it.
    if out_path.exists() and not is_nonempty_parquet(out_path):
        try:
            out_path.unlink()
        except Exception:
            pass

    writer: pq.ParquetWriter | None = None
    rows_written = 0

    try:
        for batch in scanner.to_batches():
            if batch.num_rows == 0:
                continue
            table = pa.Table.from_batches([batch])
            if writer is None:
                out_path.parent.mkdir(parents=True, exist_ok=True)
                writer = pq.ParquetWriter(out_path, table.schema, compression="zstd")
            writer.write_table(table)
            rows_written += int(batch.num_rows)
    finally:
        if writer is not None:
            writer.close()

    return rows_written
