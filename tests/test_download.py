from __future__ import annotations

import datetime as dt
import io

from botocore.exceptions import ClientError

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

    day = dt.date(2025, 12, 18)
    key = f"us_stocks_sip/minute_aggs_v1/{day.year}/{day.month:02d}/{day:%Y-%m-%d}.csv.gz"
    fake.add_object(key, b"hello")

    args = DownloadArgs(
        start=day,
        end=day,
        data_path=tmp_path,
        dataset="us_stocks_sip/minute_aggs_v1",
        file_format="csv.gz",
    )

    rc = run_download(args=args, s3_client=fake)
    assert rc == 0

    out = tmp_path / key
    assert out.exists()
    assert out.read_bytes() == b"hello"
