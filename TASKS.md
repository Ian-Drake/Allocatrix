# BayTrader MVP — TASKS.md
Copilot‑friendly, phase‑by‑phase task list with acceptance criteria.

This file is intended to be worked top‑to‑bottom.  
Each task should result in **runnable code** and a **verifiable artifact**.

---

## Global Rules (Apply to All Tasks)

- Python 3.11
- Use `uv` for env + deps
- Deterministic runs: **every CLI accepts `--seed`**
- No `torch.compile`, no Triton assumptions (Tesla P40 / sm_61 safe)
- Prefer simple, explicit PyTorch modules
- Every phase ends with:
  - a CLI command
  - a saved artifact
  - at least one test or sanity check

---

# PHASE 0 — Bootstrap & Dev Ergonomics

## Task 0.1 — Initialize repo structure
**Do**
- Create directory layout per SPEC.md
- Add empty `__init__.py` files
- Add `.gitignore` (ignore data_cache/, artifacts/, outputs/, .venv)

**Acceptance**
- Repo tree matches SPEC.md layout
- Git status is clean

---

## Task 0.2 — pyproject.toml + uv environment
**Do**
- Create `pyproject.toml`
- Add runtime + dev dependencies
- Configure Ruff (format + lint)
- Configure pytest

**Acceptance**
- `uv sync` succeeds
- `uv run python -c "import torch; print(torch.__version__)"` works
- `uv run ruff check .` passes

---

## Task 0.3 — CLI skeleton
**Do**
- Implement `baytrader.cli`
- Use argparse or typer
- Add stub commands:
  - fetch
  - build-dataset
  - train-tcn
  - eval-tcn
  - train-diffusion
  - eval-diffusion
  - predict
  - walkforward-eval
  - gpu-check

**Acceptance**
- `uv run python -m baytrader.cli --help` works
- Each command prints a stub message

---

# PHASE 1 — Tick Ingest + Derived Caches (NBBO → clean 1m bars)

## Task 1.1 — NBBO cache (from per-venue quotes under DATA_PATH)
**Do**
- Read local Parquet quote flat-files under `DATA_PATH` (per symbol/day)
- Order quotes by (`sip_timestamp`, `sequence_number`)
- Maintain per-venue top-of-book state and compute NBBO:
  - `best_bid = max_venues(bid_price)`
  - `best_ask = min_venues(ask_price)`
- Write derived cache to `data_cache/nbbo/` (Parquet; partitioned by `symbol/year/month/day`)

**Acceptance**
- Unit test builds NBBO correctly from a tiny multi-venue quote fixture (expected best bid/ask over time)
- Output cache exists under `data_cache/nbbo/` with deterministic row ordering for the same input

---

## Task 1.2 — Trade enrichment + cleaning contract + 1m bars
**Do**
- Enrich each trade with as-of NBBO snapshot (`nbbo_ts <= t_trade`) and compute `quote_age_ns`
- Apply the trade cleaning contract before aggregation:
  - RTH-only (`America/New_York` `[09:30, 16:00)`)
  - Corrections allowlist (default `correction == 0`; configurable)
  - Conditions allowlist (configurable)
  - Stale quote filter: drop if `quote_age_ns > BAYTRADER_STALE_QUOTE_NS`
  - Off-NBBO tolerance filter: keep only prices in `[best_bid - tol, best_ask + tol]` where
    `tol = max(BAYTRADER_OFF_NBBO_ABS_TOL_USD, BAYTRADER_OFF_NBBO_SPREAD_MULT * (best_ask - best_bid))`
- Write derived caches:
  - `data_cache/trades_enriched/` (enriched + filtered trades; Parquet; partitioned by `symbol/year/month/day`)
  - `data_cache/bars_1m/` (clean 1-minute OHLCV + VWAP + trade count from eligible trades; Parquet; partitioned by `symbol/year/month/day`)

**Note on quote features (important)**
- For MVP, `bars_1m/` is intentionally **trade-derived only** (OHLCV + VWAP). Quotes/NBBO are used to *clean* trades, not to define the bar schema.
- Quote-derived features (spread, mid, quote-age stats, locked/crossed time, etc.) can be:
  - computed during **Phase 2 feature engineering** by joining per-minute bars to `data_cache/nbbo/`, or
  - (optional optimization) persisted as a separate derived cache like `data_cache/quote_features_1m/` to keep `bars_1m/` stable and small.

**Acceptance**
- Unit test verifies each filter is enforced (RTH-only, correction/conditions allowlists, stale-quote max age, off-NBBO tolerance)
- Unit test verifies a known minute produces expected `open/high/low/close/volume/vwap/trades` in `data_cache/bars_1m/`

---

## Task 1.2b — Quote features 1m cache (NBBO → quote_features_1m)
**Do**
- Build a separate 1-minute quote feature cache derived from the NBBO stream.
- Input: `data_cache/nbbo/` (per symbol/day NBBO events ordered by (`sip_timestamp`, `sequence_number`)).
- Output: `data_cache/quote_features_1m/` (Parquet; partitioned by `symbol/year/month/day`).
- Compute per-minute features per [SPEC.md](SPEC.md) §6.5:
  - Minimum required: `best_bid_close`, `best_ask_close`, `mid_close`, `spread_close`, `nbbo_updates`, `quote_coverage_ns`
  - Recommended additional: `mid_tw`, `spread_tw`, `spread_min`, `spread_max`, `locked_ns`, `crossed_ns`, `effective_spread_close`
- RTH-only minutes (America/New_York `[09:30, 16:00)`), UTC minute-start timestamp contract.
- Deterministic aggregation: stable-sort NBBO events and integrate piecewise-constant state within each minute.

**Acceptance**
- Unit test with a tiny NBBO fixture verifies:
  - `nbbo_updates` counts correctly per minute
  - `best_bid_close/best_ask_close` reflect the as-of minute close state
  - `spread_tw` matches a hand-computed time-weighted spread for a minute with multiple NBBO updates
  - `locked_ns/crossed_ns` are correct for an interval with `bid >= ask`
- Output cache exists under `data_cache/quote_features_1m/` with deterministic row ordering for the same input

---

## Task 1.3 — `fetch` CLI (local trades+quotes → derived caches)
**Do**
- Implement:
  `fetch --symbols MSFT,VGT,SPY,TLT,VIX --start YYYY-MM-DD --end YYYY-MM-DD`
- Read inputs from `DATA_PATH` and write derived caches under `data_cache/`:
  - `data_cache/nbbo/`
  - `data_cache/trades_enriched/`
  - `data_cache/bars_1m/`
- Log progress

**Acceptance**
- Running `fetch` on a small test fixture populates all three cache roots with expected partitions
- Re-running `fetch` with the same inputs is deterministic (same output rows for the same inputs)
- Missing days are logged and non-fatal

---

# PHASE 2 — Dataset Builder (Aligned Multivariate)

## Task 2.1 — Time alignment logic
**Do**
- Build master timeline from MSFT
- Inner‑join other tickers by timestamp
- Drop windows with missing bars

**Acceptance**
- Deterministic sample count
- No NaNs in final tensors

---

## Task 2.2 — Feature engineering
**Do**
- Implement per‑instrument features:
  - log return
  - log(high/low)
  - rolling volatility (10)
  - log1p(volume) if present
- Concatenate into `X[t]`

**Acceptance**
- Feature count matches expectation
- Feature ranges look sane when plotted

---

## Task 2.3 — Normalization + targets
**Do**
- Per‑sample normalization over lookback window
- Store normalization stats
- Build MSFT future return target (H=5)

**Acceptance**
- Mean ~0, std ~1 for normalized features
- Targets line up with raw price movements

---

## Task 2.4 — build-dataset CLI
**Do**
- Implement:
  `build-dataset --lookback 30 --horizon 5`
- Write train/val parquet files

**Acceptance**
- Shapes correct
- Reproducible with same seed
- Simple sanity plot notebook works

---

# PHASE 3 — Stage 1 TCN

## Task 3.1 — TCN model
**Do**
- Implement causal 1D TCN
- Input: `[B, L, F]`
- Output: `mu, log_sigma` `[B, H]`

**Acceptance**
- Forward pass works on CPU & GPU
- No shape mismatches

---

## Task 3.2 — TCN training loop
**Do**
- Implement `train_tcn.py`
- Gaussian NLL loss
- Checkpoint best val loss
- Log metrics

**Acceptance**
- Loss decreases
- Checkpoint saved
- Training runs on Tesla P40

---

## Task 3.3 — TCN evaluation
**Do**
- Implement `eval_tcn.py`
- Compute:
  - NLL
  - p10/p50/p90 coverage
- Generate plots

**Acceptance**
- Report saved as markdown
- Calibration plot generated
- No exploding sigma

---

# PHASE 4 — Stage 2 Conditional Diffusion

## Task 4.1 — Diffusion scheduler
**Do**
- Implement beta schedule
- Precompute ᾱ_t
- CPU/GPU safe tensors

**Acceptance**
- Forward diffusion matches formula
- Deterministic with seed

---

## Task 4.2 — Denoiser network
**Do**
- Small MLP or 1D conv
- Inputs:
  - noisy y_t
  - timestep embedding
  - pooled X_norm
  - TCN mu/sigma

**Acceptance**
- Forward pass works
- Parameter count reasonable (<1M)

---

## Task 4.3 — Diffusion training loop
**Do**
- Implement `train_diffusion.py`
- MSE loss on ε
- Gradient clipping
- Configurable diffusion steps

**Acceptance**
- Loss decreases
- Training fits in GPU memory
- Checkpoint saved

---

## Task 4.4 — Diffusion evaluation
**Do**
- Implement `eval_diffusion.py`
- Sample N paths
- Compare vs:
  - TCN‑only
  - bootstrap baseline

**Acceptance**
- Samples are stable
- Percentile bands sensible
- Report + plots saved

---

# PHASE 5 — End‑to‑End Predict

## Task 5.1 — Predict pipeline
**Do**
- Implement:
  `predict --asof TIMESTAMP --samples N`
- Load latest bars
- Build window
- Run TCN → Diffusion

**Acceptance**
- Outputs folder created
- paths.parquet shape `[N, 5]`
- summary.json correct

---

## Task 5.2 — Visualization
**Do**
- Generate chart:
  - median
  - p10/p90
  - realized future (if known)

**Acceptance**
- chart.png readable
- No crashes on missing realized data

---

# PHASE 6 — Walk‑Forward Evaluation

## Task 6.1 — Rolling evaluation loop
**Do**
- Implement `walkforward-eval`
- Slide through time:
  - predict at t
  - score at t+1..t+5

**Acceptance**
- No leakage
- Runtime acceptable

---

## Task 6.2 — Metrics aggregation
**Do**
- Aggregate:
  - coverage
  - MAE of median
  - tail violations
- Save CSV + markdown report

**Acceptance**
- CSV readable
- Report interpretable

---

# PHASE 7 — GPU Safety & Validation

## Task 7.1 — GPU check command
**Do**
- Implement `gpu-check`
- Print:
  - device name
  - compute capability
  - CUDA version
- Run tiny forward/backward

**Acceptance**
- Works on Tesla P40
- No Triton usage
- Clear error if CUDA unavailable

---

## FINAL ACCEPTANCE (MVP)

MVP is complete when you can run, in order:

1. `fetch`
2. `build-dataset`
3. `train-tcn`
4. `eval-tcn`
5. `train-diffusion`
6. `eval-diffusion`
7. `predict`
8. `walkforward-eval`

…and all outputs are reproducible, stable, and sane.
