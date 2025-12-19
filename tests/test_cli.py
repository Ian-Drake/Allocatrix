from __future__ import annotations

import subprocess
import sys


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "baytrader.cli", *args],
        check=False,
        capture_output=True,
        text=True,
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
