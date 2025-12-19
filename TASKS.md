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
  - train-diffusion
  - predict
  - walkforward-eval
  - gpu-check

**Acceptance**
- `uv run python -m baytrader.cli --help` works
- Each command prints a stub message

---

# PHASE 1 — Polygon Ingest & Cache

## Task 1.1 — Polygon client
**Do**
- Implement `polygon_client.py`
- Read API key from env
- Support 1‑minute aggregates
- Handle pagination + retries

**Acceptance**
- Unit test with mocked HTTP response
- Rate‑limit safe retry logic exists

---

## Task 1.2 — Parquet cache writer
**Do**
- Implement `cache.py`
- Write bars to:
  `data_cache/symbol=MSFT/year=YYYY/month=MM/day=DD/*.parquet`
- Enforce schema consistency

**Acceptance**
- Running fetch twice does not duplicate rows
- Parquet files readable via pandas

---

## Task 1.3 — Fetch CLI
**Do**
- Implement:
  `fetch --symbols MSFT,VGT,SPY,TLT,VIX --start YYYY-MM-DD --end YYYY-MM-DD`
- Log progress

**Acceptance**
- Cache populated for all 5 tickers
- Row counts look reasonable
- Missing days logged, not fatal

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
