# BayTrader MVP Spec (TCN → Diffusion) — Polygon 1m (Windows + VS Code)

Version: v1.2 (2025-12-18)  
Primary environment: Windows 10/11, VS Code, Python 3.11, PyTorch + CUDA (Tesla P40)

---

## 1) MVP Goal

Build a two-stage generative system that, given the last **30 minutes** of **1-minute bars**, samples many plausible **5-minute future return paths** for a stock.

**Fixed MVP instruments**
- Stock: **MSFT**
- Sector ETF: **VGT**
- Broad market: **SPY**
- Rates proxy: **TLT** (10Y-ish rates proxy via duration exposure; used as “rates factor” input)
- Volatility: **VIX** (as a Polygon-supported ticker/series; validated by a discovery step)

**Outputs**
- N sampled future return paths for MSFT over the next 5 minutes
- Summary statistics (median, percentiles, expected move)
- Walk-forward evaluation report against realized outcomes

**Non-goals (explicitly out of scope for MVP)**
- Live trading/execution
- Portfolio optimization / rebalancing
- Tick-level microstructure modeling
- Options / Greeks modeling
- Real-time streaming infrastructure (batch “as-of now” is fine)

---

## 2) System Overview

### Inputs (conditioning signals)
At each minute, we ingest and featurize 5 synchronized instruments:

1. MSFT (target)
2. VGT
3. SPY
4. TLT
5. VIX

### Stage 1 — TCN (coarse probabilistic forecast)
- Learns a conditional distribution for MSFT’s next 5 one-minute returns.
- Produces parameters of a simple distribution per horizon step (Normal recommended for MVP).

### Stage 2 — Conditional Diffusion (refinement sampler)
- Trains a diffusion denoiser to sample realistic future return sequences length 5
- Conditioned on:
  - the 30-min lookback features of all instruments
  - Stage 1’s coarse forecast (mu/sigma)

---

## 3) Key Parameters (MVP Defaults)

- Bar size: `1m`
- Lookback: `30` minutes → `L = 30`
- Horizon: `5` minutes → `H = 5`
- Samples per prediction: `N = 512` (configurable)
- Diffusion timesteps: start with `Tdiff = 100` (configurable)
- Train/val split: time-based (no leakage)

---

## 4) Tools & Setup (Windows + VS Code)

### 4.1 Required installs
- Git for Windows
- Python **3.11.x**
- VS Code

### 4.2 Python environment/deps manager
**Recommended:** `uv`
- Keep a repo-local virtual environment.
- Dependency management via `pyproject.toml`.

**Alternative:** conda/miniconda (only if you strongly prefer conda workflows).

### 4.3 VS Code extensions
Install:
- Python (Microsoft)
- Pylance
- Jupyter (for quick verification notebooks)
- GitHub Copilot
- GitHub Copilot Chat
- Ruff (lint/format)

Optional:
- Docker (only if you want container parity later)

### 4.4 Python dependencies (MVP)
Runtime:
- `httpx` (Polygon requests)
- `pandas`, `numpy`
- `pyarrow` (parquet)
- `pydantic` (configs + schemas)
- `torch` (models)
- `scikit-learn` (baselines/metrics)
- `matplotlib` (plots)
- `tqdm` (progress)

Dev:
- `pytest`
- `ruff`

---

## 5) GPU Constraints: Tesla P40 (Pascal, sm_61)

The Tesla P40 is a Pascal GPU (compute capability 6.1). This affects which features we can rely on.

**MVP constraints / policy**
- Do **not** require `torch.compile` / Inductor / Triton to work.
- Default to straightforward eager PyTorch.
- Keep models small; prefer convolutional/MLP modules over exotic kernels.
- Use fp32 by default; allow optional AMP as an optimization pass.

**Repo must include a GPU validation command** that prints:
- `torch.cuda.is_available()`
- device name
- compute capability
- a tiny forward+backward sanity pass

---

## 6) Data: Polygon.io

### 6.1 Data source
Use Polygon “Aggregates” endpoint for 1-minute bars per instrument.

### 6.2 Cache format (raw)
Write raw bars to Parquet, partitioned by:
- `symbol=.../year=YYYY/month=MM/day=DD/part-*.parquet`

### 6.3 Dataset format (derived)
Create training examples of synchronized windows:

- `X`: `[num_samples, L, F_total]`
- `Y`: `[num_samples, H]` (MSFT future returns)

Store:
- `dataset_train.parquet`
- `dataset_val.parquet`

Include:
- timestamps for the window end (as-of time)
- per-window normalization stats needed to de-normalize targets

---

## 7) Time Alignment Rules (Multi-instrument)

We require a shared minute grid.

**MVP approach (simple + robust)**
- Build a master timeline from MSFT’s minutes.
- For other instruments, join on timestamp.
- If any required instrument bar is missing at a minute:
  - mark as missing and **drop** that sample window (recommended MVP).
- Restrict to regular market hours (configurable).

---

## 8) Features & Normalization

### 8.1 Base feature per instrument per minute
For each instrument `j` at minute `t`:
- `r_t` = log return of close
- `range_t` = log(high / low)
- `vol_t` = rolling std of returns over last 10 bars (within the lookback window)
- `v_t` = log1p(volume) (if volume exists; if not, omit for that instrument)

Concatenate instrument features into one vector per minute:
- `x_t = [features(MSFT), features(VGT), features(SPY), features(TLT), features(VIX)]`

### 8.2 Target
`Y = [r_{t+1}, r_{t+2}, r_{t+3}, r_{t+4}, r_{t+5}]` (MSFT only)

### 8.3 Normalization
Per-sample, per-feature normalization over the **lookback window only**:

- `mean_f = mean(X[:, f]) over L steps`
- `std_f = std(X[:, f]) over L steps + eps`
- `X_norm = (X - mean) / std`

Targets are normalized with the corresponding return feature stats (store what you need to invert).

---

## 9) Model Specs

## 9.1 Stage 1: TCN

**Input:** `X_norm` shape `[B, L, F_total]`  
**Output:** `mu` and `log_sigma` shape `[B, H]`

**Loss:** Gaussian NLL on normalized targets:
- `sigma = softplus(log_sigma) + eps`
- `loss = sum_t ( (y_t - mu_t)^2 / (2*sigma_t^2) + log(sigma_t) )`

**Acceptance metrics (MVP)**
- NLL decreases during training
- Calibration: realized y falls within predicted p10–p90 ~80% of time on validation (not perfect, but sane)
- No exploding sigma

---

## 9.2 Stage 2: Conditional Diffusion

We diffuse the MSFT future return sequence length `H=5`.

**Forward process**
- `y_0` is the true normalized return sequence
- sample `t ~ Uniform(1..Tdiff)`
- noise: `ε ~ N(0, I)`
- produce `y_t = sqrt(ᾱ_t) * y_0 + sqrt(1-ᾱ_t) * ε`

**Denoiser network input**
- noisy sequence `y_t` (shape `[B, H]`)
- timestep embedding
- conditioning:
  - `X_norm` `[B, L, F_total]` (projected/pooled)
  - Stage 1 `(mu, sigma)` `[B, H]`

**Output**
- predict `ε̂` (noise prediction) `[B, H]`

**Loss**
- `MSE(ε, ε̂)`

**Sampling**
- start from noise `y_T ~ N(0,I)`
- run reverse steps to produce `y_0_samples`
- output N samples, de-normalize to real returns (optionally accumulate to price paths for visualization)

**Acceptance metrics (MVP)**
- Diffusion samples are stable (no absurd spikes)
- Calibration improves or remains sane vs TCN-only
- Sampling is deterministic with fixed seed

---

## 10) CLI Contract (MVP)

All commands are deterministic with `--seed`.

### `fetch`
Fetch and cache Polygon bars.
- Inputs: symbols list, start/end dates
- Output: parquet cache

Example:
- `fetch --symbols MSFT,VGT,SPY,TLT,VIX --start 2024-01-01 --end 2025-12-01`

### `build-dataset`
Build aligned samples.
- Inputs: symbols, lookback, horizon, date range, split point
- Output: `dataset_train.parquet`, `dataset_val.parquet`

### `train-tcn`
Train Stage 1.
- Output: `artifacts/tcn/` (checkpoint + metrics)

### `eval-tcn`
Evaluate Stage 1.
- Output: `artifacts/tcn/tcn_report.md`, plots

### `train-diffusion`
Train Stage 2.
- Output: `artifacts/diffusion/` (checkpoint + metrics)

### `eval-diffusion`
Evaluate Stage 2.
- Output: `artifacts/diffusion/diffusion_report.md`, plots

### `predict`
End-to-end inference: current window → TCN → diffusion samples.
- Output per symbol set (MSFT-focused):
  - `outputs/{timestamp}/paths.parquet` (N x H returns for MSFT)
  - `outputs/{timestamp}/summary.json`
  - `outputs/{timestamp}/chart.png`

### `walkforward-eval`
Backtest-style evaluation harness.
- Output:
  - `artifacts/walkforward/eval_metrics.csv`
  - `artifacts/walkforward/eval_report.md`

### `gpu-check`
Print CUDA/device info and run a tiny test.
- Output: console + optional log file

---

## 11) Repo Layout (Suggested)

```
baytrader-mvp/
  src/baytrader/
    cli.py
    config.py
    polygon_client.py
    cache.py
    dataset_builder.py
    align.py
    features.py
    metrics.py
    utils/
      seeds.py
      io.py
      gpu.py
    models/
      tcn.py
      diffusion.py
    train/
      train_tcn.py
      train_diffusion.py
    eval/
      eval_tcn.py
      eval_diffusion.py
      walkforward.py
  tests/
  notebooks/
  data_cache/        (gitignored)
  artifacts/         (gitignored)
  outputs/           (gitignored)
  pyproject.toml
  config.toml
  README.md
  SPEC.md
```

---

## 12) Phased Build Plan (Discrete, Testable Outputs)

### Phase 0 — Bootstrap
**Done when**
- repo created, `uv` env works
- tests + ruff pass
- CLI skeleton works

### Phase 1 — Polygon ingest + cache
**Done when**
- `fetch` populates parquet cache for MSFT,VGT,SPY,TLT,VIX
- retry/backoff and rate-limit handling included
- mock tests pass

### Phase 2 — Dataset builder (aligned multivariate)
**Done when**
- `build-dataset` produces train/val files
- shape checks & no NaNs
- deterministic sample count

### Phase 3 — Stage 1 TCN
**Done when**
- `train-tcn` produces checkpoint
- `eval-tcn` produces report + calibration plot

### Phase 4 — Stage 2 Diffusion
**Done when**
- `train-diffusion` produces checkpoint
- `eval-diffusion` produces sampled paths + report

### Phase 5 — End-to-end predict
**Done when**
- `predict` produces outputs bundle (paths/summary/chart)
- reproducible with seed

### Phase 6 — Walk-forward evaluation
**Done when**
- `walkforward-eval` produces CSV + report comparing:
  - TCN-only vs Diffusion vs bootstrap baseline

---

## 13) Definition of Done (MVP)

MVP is complete when you can run:

1) `fetch` (cache Polygon 1m bars)
2) `build-dataset` (aligned windows, MSFT target)
3) `train-tcn` + `eval-tcn`
4) `train-diffusion` + `eval-diffusion`
5) `predict` (as-of now or a historical timestamp)
6) `walkforward-eval` (calibration report over a range)

…and you get stable, reproducible outputs with sensible distributions.

---
