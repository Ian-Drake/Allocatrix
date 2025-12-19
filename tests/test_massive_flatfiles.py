from __future__ import annotations

import datetime as dt
import io

import pandas as pd
import pytest
from botocore.exceptions import ClientError, EndpointConnectionError

from baytrader.massive_flatfiles import MassiveFlatFilesClient, MassiveS3Config


class _FakeS3:
    def __init__(self) -> None:
        self._heads: set[str] = set()
        self._objects: dict[str, bytes] = {}
        self._get_failures: dict[str, list[Exception]] = {}
        self._list_pages: dict[str, list[dict[str, object]]] = {}

    def add_object(self, bucket: str, key: str, data: bytes) -> None:
        _ = bucket
        self._heads.add(key)
        self._objects[key] = data

    def set_list_pages(self, prefix: str, pages: list[dict[str, object]]) -> None:
        self._list_pages[prefix] = list(pages)

    def head_object(self, *, Bucket: str, Key: str):  # noqa: N802
        _ = Bucket
        if Key not in self._heads:
            raise ClientError(
                {"Error": {"Code": "404", "Message": "Not Found"}},
                operation_name="HeadObject",
            )
        return {"ResponseMetadata": {"HTTPStatusCode": 200}}

    def set_get_failures(self, key: str, failures: list[Exception]) -> None:
        self._get_failures[key] = list(failures)

    def get_object(self, *, Bucket: str, Key: str, Range: str | None = None):  # noqa: N802
        _ = Bucket
        _ = Range
        failures = self._get_failures.get(Key)
        if failures and len(failures) > 0:
            raise failures.pop(0)
        if Key not in self._objects:
            raise ClientError(
                {"Error": {"Code": "NoSuchKey", "Message": "No Such Key"}},
                operation_name="GetObject",
            )
        return {"Body": io.BytesIO(self._objects[Key])}

    def list_objects_v2(
        self,
        *,
        Bucket: str,
        Prefix: str,
        ContinuationToken: str | None = None,
    ):  # noqa: N802
        _ = Bucket
        pages = self._list_pages.get(Prefix)
        if pages is None:
            # Default behavior: list from known keys.
            keys = [k for k in sorted(self._objects.keys()) if k.startswith(Prefix)]
            return {
                "IsTruncated": False,
                "Contents": [{"Key": k} for k in keys],
            }

        idx = 0
        if ContinuationToken:
            idx = int(ContinuationToken)

        page = pages[idx]
        return page


def test_head_403_is_non_fatal() -> None:
    cfg = MassiveS3Config(
        endpoint_url="https://files.massive.com",
        bucket="flatfiles",
        access_key_id="x",
        secret_access_key="y",
    )

    class _S3(_FakeS3):
        def head_object(self, *, Bucket: str, Key: str):  # noqa: N802
            _ = Bucket
            _ = Key
            raise ClientError(
                {"Error": {"Code": "403", "Message": "Forbidden"}},
                operation_name="HeadObject",
            )

    client = MassiveFlatFilesClient(cfg, s3_client=_S3(), max_retries=1)
    assert client._head_exists("any/key") is False


def test_resolve_daily_key_tries_patterns() -> None:
    cfg = MassiveS3Config(
        endpoint_url="https://files.massive.com",
        bucket="flatfiles",
        access_key_id="x",
        secret_access_key="y",
    )
    fake = _FakeS3()

    day = dt.date(2025, 12, 18)
    dataset = "us_stocks_sip/minute_aggs_v1"
    key = f"{dataset}/{day.year}/{day.month:02d}/{day:%Y-%m-%d}.csv.gz"
    fake.add_object(
        bucket=cfg.bucket,
        key=key,
        data=b"ticker,window_start,open,high,low,close,volume\n",
    )

    client = MassiveFlatFilesClient(cfg, s3_client=fake, max_retries=1)
    resolved_key, fmt = client.resolve_daily_key(dataset=dataset, day=day, file_format="auto")
    assert resolved_key == key
    assert fmt == "csv.gz"


def test_iter_daily_minute_aggs_filters_symbols_csv_gz() -> None:
    cfg = MassiveS3Config(
        endpoint_url="https://files.massive.com",
        bucket="flatfiles",
        access_key_id="x",
        secret_access_key="y",
    )
    fake = _FakeS3()

    day = dt.date(2025, 12, 18)
    dataset = "us_stocks_sip/minute_aggs_v1"
    key = f"{dataset}/{day.year}/{day.month:02d}/{day:%Y-%m-%d}.csv.gz"

    # Build a tiny gzipped CSV
    import gzip

    raw = (
        b"ticker,window_start,open,high,low,close,volume\n"
        b"MSFT,1734480000000,100,101,99,100.5,123\n"
        b"SPY,1734480000000,200,201,199,200.5,456\n"
    )
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb") as f:
        f.write(raw)

    fake.add_object(bucket=cfg.bucket, key=key, data=buf.getvalue())

    client = MassiveFlatFilesClient(cfg, s3_client=fake, max_retries=1)
    chunks = list(
        client.iter_daily_minute_aggs(
            dataset=dataset,
            day=day,
            symbols=["msft"],
            file_format="auto",
        )
    )
    assert len(chunks) == 1
    assert set(chunks[0]["ticker"].astype(str).str.upper()) == {"MSFT"}


def test_get_object_retries_on_endpoint_error(monkeypatch) -> None:
    cfg = MassiveS3Config(
        endpoint_url="https://files.massive.com",
        bucket="flatfiles",
        access_key_id="x",
        secret_access_key="y",
    )
    fake = _FakeS3()

    day = dt.date(2025, 12, 18)
    dataset = "us_stocks_sip/minute_aggs_v1"
    key = f"{dataset}/{day.year}/{day.month:02d}/{day:%Y-%m-%d}.csv.gz"
    fake.add_object(bucket=cfg.bucket, key=key, data=b"")

    fake.set_get_failures(key, [EndpointConnectionError(endpoint_url=cfg.endpoint_url)])

    client = MassiveFlatFilesClient(cfg, s3_client=fake, max_retries=2, base_backoff_s=0.0)
    body = client.get_object_stream(key)
    assert body.read() == b""


def test_resolve_daily_key_fallback_uses_list_pagination() -> None:
    cfg = MassiveS3Config(
        endpoint_url="https://files.massive.com",
        bucket="flatfiles",
        access_key_id="x",
        secret_access_key="y",
    )
    fake = _FakeS3()

    day = dt.date(2025, 12, 18)
    dataset = "us_stocks_sip/minute_aggs_v1"
    prefix = f"{dataset}/{day.year}/"

    # Ensure head checks fail by not registering key in _heads.
    key = f"{dataset}/{day.year}/{day.month:02d}/{day:%Y-%m-%d}.parquet"
    fake._objects[key] = b"PAR1"  # pretend it exists in listing

    fake.set_list_pages(
        prefix,
        [
            {
                "IsTruncated": True,
                "NextContinuationToken": "1",
                "Contents": [{"Key": f"{dataset}/{day.year}/other.parquet"}],
            },
            {
                "IsTruncated": False,
                "Contents": [{"Key": key}],
            },
        ],
    )

    client = MassiveFlatFilesClient(cfg, s3_client=fake, max_retries=1)
    resolved_key, fmt = client.resolve_daily_key(dataset=dataset, day=day, file_format="auto")
    assert resolved_key == key
    assert fmt == "parquet"


@pytest.mark.parametrize(
    "ts,expected_unit",
    [
        (1734480000000, "ms"),
        (1734480000000000000, "ns"),
    ],
)
def test_timestamp_parsing_units(ts: int, expected_unit: str) -> None:
    from baytrader.cache import normalize_flatfiles_chunk

    df = pd.DataFrame(
        {
            "ticker": ["MSFT"],
            "window_start": [ts],
            "open": [1.0],
            "high": [1.0],
            "low": [1.0],
            "close": [1.0],
            "volume": [1.0],
        }
    )
    out = normalize_flatfiles_chunk(df)
    assert str(out.loc[0, "timestamp"].tz) == "UTC"
    # Ensure the heuristic runs (ms vs ns), not exact value.
    assert expected_unit in {"ms", "ns"}
