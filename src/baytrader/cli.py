from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass


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

    p_fetch = sub.add_parser("fetch", help="Fetch and cache Polygon bars (stub).")
    p_fetch.set_defaults(_handler=lambda g, a: _handle_stub("fetch", g, a))

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
