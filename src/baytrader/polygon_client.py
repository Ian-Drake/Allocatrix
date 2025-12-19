"""Polygon client (Massive.com merger note).

Polygon's flat-files access appears to have moved under Massive.com. For this MVP,
we treat the "Polygon client" as a thin wrapper around Massive S3 flat files.

This module name is preserved to keep the SPEC/TASKS terminology stable.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import pandas as pd

from baytrader.massive_flatfiles import FlatFileFormat, MassiveFlatFilesClient, MassiveS3Config


@dataclass(frozen=True)
class PolygonFlatFilesSettings:
    dataset: str = "us_stocks_sip/minute_aggs_v1"
    file_format: FlatFileFormat = "auto"


class PolygonClient:
    def __init__(
        self,
        settings: PolygonFlatFilesSettings | None = None,
        *,
        cfg: MassiveS3Config | None = None,
        s3_client=None,
    ) -> None:
        self._settings = settings or PolygonFlatFilesSettings()
        self._cfg = cfg or MassiveS3Config.from_env()
        self._massive = MassiveFlatFilesClient(self._cfg, s3_client=s3_client)

    def iter_minute_aggs(
        self,
        *,
        day: dt.date,
        symbols: list[str],
    ) -> list[pd.DataFrame]:
        # Collect chunks for simplicity at this layer; cache layer will concatenate.
        chunks = list(
            self._massive.iter_daily_minute_aggs(
                dataset=self._settings.dataset,
                day=day,
                symbols=symbols,
                file_format=self._settings.file_format,
            )
        )
        return chunks
