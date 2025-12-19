from __future__ import annotations

import datetime as dt
import gzip
import io
import os
import time
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import IO, Literal

import pandas as pd

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError, EndpointConnectionError
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "Missing optional dependency for Massive flat files. Install 'boto3'."
    ) from e


FlatFileFormat = Literal["auto", "csv", "csv.gz", "parquet"]


@dataclass(frozen=True)
class MassiveS3Config:
    endpoint_url: str
    bucket: str
    access_key_id: str
    secret_access_key: str
    region_name: str = "us-east-1"

    @staticmethod
    def from_env() -> MassiveS3Config:
        endpoint_url = os.environ.get("MASSIVE_S3_ENDPOINT", "https://files.massive.com").strip()
        bucket = os.environ.get("MASSIVE_S3_BUCKET", "flatfiles").strip()

        access_key_id = (
            os.environ.get("MASSIVE_ACCESS_KEY_ID")
            or os.environ.get("MASSIVE_S3_ACCESS_KEY_ID")
            or os.environ.get("AWS_ACCESS_KEY_ID")
            or ""
        ).strip()
        secret_access_key = (
            os.environ.get("MASSIVE_SECRET_ACCESS_KEY")
            or os.environ.get("MASSIVE_S3_SECRET_ACCESS_KEY")
            or os.environ.get("AWS_SECRET_ACCESS_KEY")
            or ""
        ).strip()

        if not access_key_id or not secret_access_key:
            raise RuntimeError(
                "Missing Massive S3 credentials. Set MASSIVE_ACCESS_KEY_ID and "
                "MASSIVE_SECRET_ACCESS_KEY (or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY)."
            )

        return MassiveS3Config(
            endpoint_url=endpoint_url,
            bucket=bucket,
            access_key_id=access_key_id,
            secret_access_key=secret_access_key,
        )


class MassiveFlatFilesClient:
    """Massive.com (Polygon successor) S3 flat-files client.

    This downloads daily aggregates files from an S3-compatible endpoint and filters
    to the requested symbols.

    Notes:
    - The exact object key layout can differ by dataset/version. This client tries a
      small set of common key patterns and selects the first one that exists.
    """

    def __init__(
        self,
        cfg: MassiveS3Config,
        *,
        s3_client=None,
        max_retries: int = 5,
        base_backoff_s: float = 0.75,
    ) -> None:
        self._cfg = cfg
        self._max_retries = int(max_retries)
        self._base_backoff_s = float(base_backoff_s)

        if s3_client is None:
            # S3-compatible endpoints often prefer path-style addressing.
            s3_client = boto3.client(
                "s3",
                endpoint_url=cfg.endpoint_url,
                aws_access_key_id=cfg.access_key_id,
                aws_secret_access_key=cfg.secret_access_key,
                region_name=cfg.region_name,
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},
                    retries={"max_attempts": 1, "mode": "standard"},
                ),
            )

        self._s3 = s3_client
        self._saw_forbidden = False

    @property
    def bucket(self) -> str:
        return self._cfg.bucket

    def _sleep_backoff(self, attempt: int) -> None:
        # Deterministic exponential backoff.
        time.sleep(self._base_backoff_s * (2**attempt))

    def _call_with_retries(self, fn, *, retriable_error_codes: set[str]) -> object:
        last_exc: Exception | None = None
        for attempt in range(self._max_retries):
            try:
                return fn()
            except EndpointConnectionError as e:
                last_exc = e
            except ClientError as e:
                code = str(e.response.get("Error", {}).get("Code", ""))
                if code in retriable_error_codes:
                    last_exc = e
                else:
                    raise

            if attempt < self._max_retries - 1:
                self._sleep_backoff(attempt)

        assert last_exc is not None
        raise last_exc

    def _head_exists(self, key: str) -> bool:
        def _head():
            return self._s3.head_object(Bucket=self.bucket, Key=key)

        try:
            self._call_with_retries(
                _head,
                retriable_error_codes={"SlowDown", "Throttling", "RequestTimeout"},
            )
            return True
        except ClientError as e:
            code = str(e.response.get("Error", {}).get("Code", ""))
            # Some S3-compatible gateways return 403 for missing keys or disallow HEAD.
            # Treat these as "does not exist" so we can fall back to listing or GET probing.
            if code in {"404", "NoSuchKey", "NotFound", "403", "AccessDenied", "Forbidden"}:
                if code in {"403", "AccessDenied", "Forbidden"}:
                    self._saw_forbidden = True
                return False
            raise

    def _get_range_exists(self, key: str) -> bool:
        """Probe object existence with a 1-byte ranged GET.

        This is a fallback for endpoints that disallow HEAD or return 403 for missing keys.
        """

        def _get():
            return self._s3.get_object(Bucket=self.bucket, Key=key, Range="bytes=0-0")

        try:
            resp = self._call_with_retries(
                _get,
                retriable_error_codes={"SlowDown", "Throttling", "RequestTimeout"},
            )
            body = resp.get("Body")
            if body is not None:
                try:
                    body.close()
                except Exception:  # pragma: no cover
                    pass
            return True
        except ClientError as e:
            code = str(e.response.get("Error", {}).get("Code", ""))
            if code in {"404", "NoSuchKey", "NotFound", "403", "AccessDenied", "Forbidden"}:
                if code in {"403", "AccessDenied", "Forbidden"}:
                    self._saw_forbidden = True
                return False
            raise

    def list_keys(self, *, prefix: str) -> list[str]:
        """List object keys under a prefix, handling pagination and throttling."""
        prefix = prefix.lstrip("/")
        keys: list[str] = []
        token: str | None = None

        while True:
            def _list(_token: str | None = token):
                params: dict[str, object] = {"Bucket": self.bucket, "Prefix": prefix}
                if _token:
                    params["ContinuationToken"] = _token
                return self._s3.list_objects_v2(**params)

            resp = self._call_with_retries(
                _list,
                retriable_error_codes={"SlowDown", "Throttling", "RequestTimeout"},
            )
            contents = resp.get("Contents") or []
            for item in contents:
                key = item.get("Key")
                if isinstance(key, str):
                    keys.append(key)

            if resp.get("IsTruncated"):
                token = resp.get("NextContinuationToken")
                if not isinstance(token, str) or not token:
                    break
            else:
                break

        return keys

    def resolve_daily_key(
        self,
        *,
        dataset: str,
        day: dt.date,
        file_format: FlatFileFormat = "auto",
    ) -> tuple[str, FlatFileFormat]:
        dataset = dataset.strip().strip("/")
        yyyy = day.year
        mm = day.month
        dd = day.day
        day_str = day.strftime("%Y-%m-%d")

        # Candidates are ordered by common Polygon flat-files conventions.
        candidates: list[tuple[str, FlatFileFormat]] = []

        def _add(fmt: FlatFileFormat, *paths: str) -> None:
            for p in paths:
                candidates.append((f"{dataset}/{p}", fmt))

        if file_format in {"auto", "csv.gz"}:
            _add(
                "csv.gz",
                f"{yyyy}/{mm:02d}/{day_str}.csv.gz",
                f"{yyyy}/{day_str}.csv.gz",
                f"{day_str}.csv.gz",
                f"{yyyy}/{mm:02d}/{dd:02d}.csv.gz",
            )
        if file_format in {"auto", "csv"}:
            _add(
                "csv",
                f"{yyyy}/{mm:02d}/{day_str}.csv",
                f"{yyyy}/{day_str}.csv",
                f"{day_str}.csv",
            )
        if file_format in {"auto", "parquet"}:
            _add(
                "parquet",
                f"{yyyy}/{mm:02d}/{day_str}.parquet",
                f"{yyyy}/{day_str}.parquet",
                f"{day_str}.parquet",
            )

        for key, fmt in candidates:
            if self._head_exists(key):
                return key, fmt

        # If HEAD is blocked, attempt a lightweight ranged GET probe.
        for key, fmt in candidates:
            if self._get_range_exists(key):
                return key, fmt

        # Fallback: list and search (handles dataset layouts we didn't guess).
        # This also satisfies the "pagination" requirement for flat-file access.
        search_prefixes = [
            f"{dataset}/{yyyy}/{mm:02d}/",
            f"{dataset}/{yyyy}/",
            f"{dataset}/",
        ]

        suffixes = [
            f"/{day_str}.csv.gz",
            f"/{day_str}.csv",
            f"/{day_str}.parquet",
            f"/{mm:02d}/{day_str}.csv.gz",
            f"/{mm:02d}/{day_str}.csv",
            f"/{mm:02d}/{day_str}.parquet",
        ]

        for prefix in search_prefixes:
            try:
                keys = self.list_keys(prefix=prefix)
            except ClientError as e:
                code = str(e.response.get("Error", {}).get("Code", ""))
                if code in {"403", "AccessDenied", "Forbidden"}:
                    self._saw_forbidden = True
                continue

            matches = [k for k in keys if any(k.endswith(sfx) for sfx in suffixes)]
            if not matches:
                continue

            key = sorted(matches)[0]
            if key.endswith(".csv.gz"):
                return key, "csv.gz"
            if key.endswith(".csv"):
                return key, "csv"
            if key.endswith(".parquet"):
                return key, "parquet"

        if self._saw_forbidden:
            raise PermissionError(
                "Massive S3 returned Forbidden (403) during key discovery. "
                "This usually means your subscription doesn't include this dataset/prefix, "
                "or the endpoint disallows HEAD/LIST for your plan. "
                "Use the Massive File Browser to find a key you can access, then run fetch with "
                "--object-keys <key>, or run `fetch --list-prefix us_stocks_sip/` to explore."
            )

        raise FileNotFoundError(
            f"No flat-file found for {day_str} in dataset '{dataset}'. "
            f"Tried {len(candidates)} key patterns." 
        )

    def get_object_stream(self, key: str) -> IO[bytes]:
        def _get():
            return self._s3.get_object(Bucket=self.bucket, Key=key)

        try:
            resp = self._call_with_retries(
                _get,
                retriable_error_codes={"SlowDown", "Throttling", "RequestTimeout"},
            )
        except ClientError as e:
            code = str(e.response.get("Error", {}).get("Code", ""))
            if code in {"403", "AccessDenied", "Forbidden"}:
                raise PermissionError(
                    "Massive S3 returned Forbidden (403) for GetObject. "
                    "This usually means your plan/tier doesn't include access to this flat file, "
                    "or the object key/prefix is outside your subscription. "
                    "Confirm you have Flat Files access, then copy an accessible object key from "
                    "the Massive File Browser and pass it via --object-keys."
                ) from e
            raise
        body = resp["Body"]
        return body

    def iter_object_minute_aggs(
        self,
        *,
        key: str,
        symbols: Sequence[str],
        file_format: FlatFileFormat = "auto",
        chunksize: int = 500_000,
    ) -> Iterable[pd.DataFrame]:
        """Iterate aggregate rows from a specific object key.

        Massive's quickstart examples commonly download by explicit object key,
        e.g. `us_stocks_sip/trades_v1/2025/11/2025-11-05.csv.gz`.
        """

        key_lower = key.lower()
        resolved_fmt: FlatFileFormat
        if file_format != "auto":
            resolved_fmt = file_format
        elif key_lower.endswith(".csv.gz"):
            resolved_fmt = "csv.gz"
        elif key_lower.endswith(".csv"):
            resolved_fmt = "csv"
        elif key_lower.endswith(".parquet"):
            resolved_fmt = "parquet"
        else:
            # Default to gzip CSV as per Massive docs.
            resolved_fmt = "csv.gz"

        stream = self.get_object_stream(key)
        yield from self._iter_stream_minute_aggs(
            stream=stream,
            resolved_fmt=resolved_fmt,
            symbols=symbols,
            chunksize=chunksize,
        )

    def _iter_stream_minute_aggs(
        self,
        *,
        stream: IO[bytes],
        resolved_fmt: FlatFileFormat,
        symbols: Sequence[str],
        chunksize: int,
    ) -> Iterable[pd.DataFrame]:
        sym_set = {s.strip().upper() for s in symbols if s.strip()}
        if not sym_set:
            return

        if resolved_fmt in {"csv", "csv.gz"}:
            if resolved_fmt == "csv.gz":
                fileobj: IO[bytes] = gzip.GzipFile(fileobj=stream)  # type: ignore[arg-type]
            else:
                fileobj = stream

            for chunk in pd.read_csv(fileobj, chunksize=int(chunksize)):
                cols_lower = {c.lower(): c for c in chunk.columns}
                ticker_col = cols_lower.get("ticker") or cols_lower.get("symbol")
                if ticker_col is None:
                    raise ValueError(
                        "CSV schema missing 'ticker'/'symbol' column. "
                        f"Columns: {list(chunk.columns)}"
                    )
                filtered = chunk[chunk[ticker_col].astype(str).str.upper().isin(sym_set)]
                if len(filtered) > 0:
                    yield filtered
            return

        if resolved_fmt == "parquet":
            data = stream.read()
            buf = io.BytesIO(data)
            df = pd.read_parquet(buf)
            cols_lower = {c.lower(): c for c in df.columns}
            ticker_col = cols_lower.get("ticker") or cols_lower.get("symbol")
            if ticker_col is None:
                raise ValueError(
                    "Parquet schema missing 'ticker'/'symbol' column. "
                    f"Columns: {list(df.columns)}"
                )
            filtered = df[df[ticker_col].astype(str).str.upper().isin(sym_set)]
            if len(filtered) > 0:
                yield filtered
            return

        raise ValueError(f"Unsupported resolved format: {resolved_fmt}")

    def iter_daily_minute_aggs(
        self,
        *,
        dataset: str,
        day: dt.date,
        symbols: Sequence[str],
        file_format: FlatFileFormat = "auto",
        chunksize: int = 500_000,
    ) -> Iterable[pd.DataFrame]:
        key, resolved_fmt = self.resolve_daily_key(
            dataset=dataset, day=day, file_format=file_format
        )
        stream = self.get_object_stream(key)
        yield from self._iter_stream_minute_aggs(
            stream=stream,
            resolved_fmt=resolved_fmt,
            symbols=symbols,
            chunksize=chunksize,
        )
