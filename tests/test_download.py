from __future__ import annotations

import datetime as dt
import io

from botocore.exceptions import ClientError
import pyarrow.parquet as pq

from baytrader.download import DownloadArgs, run_download


class _FakeS3:
    def __init__(self) -> None:
        self._objects: dict[str, bytes] = {}

    def add_object(self, key: str, data: bytes) -> None:
        self._objects[key] = data

    def get_object(self, *, Bucket: str, Key: str):  # noqa: N802
        _ = Bucket
        if Key not in self._objects:
            raise ClientError(
                {"Error": {"Code": "NoSuchKey", "Message": "No Such Key"}},
                operation_name="GetObject",
            )
        return {"Body": io.BytesIO(self._objects[Key])}


def test_download_writes_to_data_path(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MASSIVE_ACCESS_KEY_ID", "x")
    monkeypatch.setenv("MASSIVE_SECRET_ACCESS_KEY", "y")
    monkeypatch.setenv("MASSIVE_S3_ENDPOINT", "https://files.massive.com")
    monkeypatch.setenv("MASSIVE_S3_BUCKET", "flatfiles")

    fake = _FakeS3()

    monkeypatch.setenv("BAYTRADER_TEMP_PATH", str(tmp_path / "localtmp"))
    monkeypatch.setenv("BAYTRADER_EXTRACT_ASYNC", "0")

    day = dt.date(2025, 12, 18)
    key = f"us_stocks_sip/minute_aggs_v1/{day.year}/{day.month:02d}/{day:%Y-%m-%d}.csv"
    fake.add_object(key, b"ticker,price\nMSFT,1.25\nAAPL,2.00\n")

    (tmp_path / "Universe.CSV").write_text("Ticker\nMSFT\n", encoding="utf-8")

    args = DownloadArgs(
        start=day,
        end=day,
        data_path=tmp_path,
        dataset="us_stocks_sip/minute_aggs_v1",
        file_format="csv",
        universe=frozenset({"MSFT"}),
    )

    rc = run_download(args=args, s3_client=fake)
    assert rc == 0

    raw = tmp_path / key
    assert not raw.exists(), "Raw should not exist under DATA_PATH in this mode"

    out_parquet = (tmp_path / key).with_suffix(".parquet")
    assert out_parquet.exists()
    assert pq.read_metadata(out_parquet).num_rows == 1


def test_download_cleans_leftover_temp_file(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MASSIVE_ACCESS_KEY_ID", "x")
    monkeypatch.setenv("MASSIVE_SECRET_ACCESS_KEY", "y")
    monkeypatch.setenv("MASSIVE_S3_ENDPOINT", "https://files.massive.com")
    monkeypatch.setenv("MASSIVE_S3_BUCKET", "flatfiles")

    fake = _FakeS3()

    monkeypatch.setenv("BAYTRADER_TEMP_PATH", str(tmp_path / "localtmp"))
    monkeypatch.setenv("BAYTRADER_EXTRACT_ASYNC", "0")

    day = dt.date(2025, 12, 18)
    key = f"us_stocks_sip/minute_aggs_v1/{day.year}/{day.month:02d}/{day:%Y-%m-%d}.csv"
    fake.add_object(key, b"ticker,price\nMSFT,1.25\n")

    (tmp_path / "Universe.CSV").write_text("Ticker\nMSFT\n", encoding="utf-8")

    raw_path = (tmp_path / "localtmp") / key
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = raw_path.with_name(f"temp-{raw_path.name}")
    temp_path.write_text("partial", encoding="utf-8")

    args = DownloadArgs(
        start=day,
        end=day,
        data_path=tmp_path,
        dataset="us_stocks_sip/minute_aggs_v1",
        file_format="csv",
        universe=frozenset({"MSFT"}),
    )

    rc = run_download(args=args, s3_client=fake)
    assert rc == 0
    assert not temp_path.exists()
