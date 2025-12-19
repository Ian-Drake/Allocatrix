from __future__ import annotations

import subprocess
import sys
import os
from typing import Mapping


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "baytrader.cli", *args],
        check=False,
        capture_output=True,
        text=True,
    )


def _run_env(env: Mapping[str, str], *args: str) -> subprocess.CompletedProcess[str]:
    # Preserve the current process environment unless explicitly overridden.
    merged = {**os.environ, **dict(env)}
    return subprocess.run(
        [sys.executable, "-m", "baytrader.cli", *args],
        check=False,
        capture_output=True,
        text=True,
        env=merged,
    )


def test_cli_help_exits_zero() -> None:
    proc = _run("--help")
    assert proc.returncode == 0
    assert "usage:" in proc.stdout.lower()


def test_cli_subcommands_stub_messages() -> None:
    commands = [
        "build-dataset",
        "train-tcn",
        "train-diffusion",
        "predict",
        "walkforward-eval",
        "gpu-check",
    ]

    for cmd in commands:
        proc = _run("--seed", "123", cmd)
        assert proc.returncode == 0
        assert f"[stub] {cmd} (seed=123)" in proc.stdout


def test_fetch_help_exists() -> None:
    proc = _run("fetch", "--help")
    assert proc.returncode == 0
    assert "--symbols" in proc.stdout
    assert "--object-keys" in proc.stdout
    assert "--list-prefix" in proc.stdout


def test_download_help_exists() -> None:
    proc = _run("download", "--help")
    assert proc.returncode == 0
    assert "--start" in proc.stdout
    assert "--end" in proc.stdout


def test_download_requires_universe_csv(tmp_path) -> None:
    proc = _run_env(
        {"DATA_PATH": str(tmp_path)},
        "download",
        "--start",
        "2025-12-18",
        "--end",
        "2025-12-18",
        "--dataset",
        "us_stocks_sip/trades_v1",
        "--format",
        "csv.gz",
    )
    assert proc.returncode != 0
    assert "Universe.CSV" in (proc.stderr + proc.stdout)


def test_download_requires_universe_nonempty(tmp_path) -> None:
    (tmp_path / "Universe.CSV").write_text("Ticker\n", encoding="utf-8")

    proc = _run_env(
        {"DATA_PATH": str(tmp_path)},
        "download",
        "--start",
        "2025-12-18",
        "--end",
        "2025-12-18",
        "--dataset",
        "us_stocks_sip/trades_v1",
        "--format",
        "csv.gz",
    )
    assert proc.returncode != 0
    assert "Universe.CSV" in (proc.stderr + proc.stdout)
