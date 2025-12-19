from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from baytrader.fetch import FetchArgs, run_fetch


def _maybe_load_dotenv() -> None:
    """Load repo-local .env into process env (dev ergonomics).

    Python does not automatically read .env files. We load `.env` if present.
    """

    try:
        from dotenv import load_dotenv
    except ImportError:
        return

    env_path = Path(".env")
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)


@dataclass(frozen=True)
class GlobalArgs:
    seed: int


def _add_global_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--seed",
        type=int,
        default=0,
        help="Random seed for deterministic runs (default: 0).",
    )


def _handle_stub(command: str, g: GlobalArgs, args: argparse.Namespace) -> int:
    _ = args
    print(f"[stub] {command} (seed={g.seed})")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="baytrader")
    _add_global_args(parser)

    sub = parser.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser("fetch", help="Fetch and cache 1m bars via Massive flat files.")
    p_fetch.add_argument(
        "--symbols",
        required=True,
        help="Comma-separated symbols, e.g. MSFT,VGT,SPY,TLT,VIX",
    )
    p_fetch.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    p_fetch.add_argument("--end", required=True, help="End date (YYYY-MM-DD)")
    p_fetch.add_argument(
        "--cache-dir",
        default="data_cache",
        help="Cache directory for partitioned parquet output (default: data_cache)",
    )
    p_fetch.add_argument(
        "--dataset",
        default="us_stocks_sip/minute_aggs_v1",
        help="Flat-files dataset prefix inside the bucket (default: us_stocks_sip/minute_aggs_v1)",
    )
    p_fetch.add_argument(
        "--format",
        default="auto",
        choices=["auto", "csv", "csv.gz", "parquet"],
        help="Flat-file format to expect (default: auto)",
    )

    def _run_fetch(g: GlobalArgs, a: argparse.Namespace) -> int:
        _ = g
        symbols = [s.strip() for s in str(a.symbols).split(",") if s.strip()]
        from baytrader.fetch import _parse_date  # local import to keep CLI lean

        fargs = FetchArgs(
            symbols=symbols,
            start=_parse_date(str(a.start)),
            end=_parse_date(str(a.end)),
            cache_dir=str(a.cache_dir),
            dataset=str(a.dataset),
            file_format=str(a.format),
        )
        return run_fetch(args=fargs)

    p_fetch.set_defaults(_handler=_run_fetch)

    p_build = sub.add_parser("build-dataset", help="Build aligned dataset files (stub).")
    p_build.set_defaults(_handler=lambda g, a: _handle_stub("build-dataset", g, a))

    p_train_tcn = sub.add_parser("train-tcn", help="Train Stage 1 TCN (stub).")
    p_train_tcn.set_defaults(_handler=lambda g, a: _handle_stub("train-tcn", g, a))

    p_train_diff = sub.add_parser("train-diffusion", help="Train Stage 2 diffusion (stub).")
    p_train_diff.set_defaults(_handler=lambda g, a: _handle_stub("train-diffusion", g, a))

    p_predict = sub.add_parser("predict", help="Run end-to-end prediction (stub).")
    p_predict.set_defaults(_handler=lambda g, a: _handle_stub("predict", g, a))

    p_wf = sub.add_parser("walkforward-eval", help="Run walk-forward evaluation (stub).")
    p_wf.set_defaults(_handler=lambda g, a: _handle_stub("walkforward-eval", g, a))

    p_gpu = sub.add_parser("gpu-check", help="Print CUDA/device info and run a tiny test (stub).")
    p_gpu.set_defaults(_handler=lambda g, a: _handle_stub("gpu-check", g, a))

    # silence unused-variable warnings without affecting runtime
    _ = (p_fetch, p_build, p_train_tcn, p_train_diff, p_predict, p_wf, p_gpu)

    return parser


def main(argv: list[str] | None = None) -> int:
    _maybe_load_dotenv()
    parser = build_parser()
    args = parser.parse_args(argv)

    g = GlobalArgs(seed=int(args.seed))

    handler = getattr(args, "_handler", None)
    if handler is None:
        parser.error("No command handler configured.")
        return 2

    return int(handler(g, args))


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
