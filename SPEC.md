# BayTrader MVP Spec (TCN → Diffusion) — Tick-Derived 1m Bars (Trades cleaned via Quotes/NBBO) (Windows + VS Code)

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
- Tick-level microstructure modeling (beyond using ticks to build clean 1m bars)
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

## 6) Data: Trades + Quotes Flat Files (SIP)

### 6.1 Data source
We build clean 1-minute bars from **trade** prints, using **top-of-book quote** flat-files to compute NBBO and enforce a trade-cleaning contract.

Inputs (per symbol/day):
- **Trades** (SIP): tick-level prints with `conditions` + `correction` fields.
- **Quotes** (SIP): per-venue top-of-book quotes (bid/ask) across major U.S. exchanges and darkpools.

Timestamp contract:
- Use `sip_timestamp` as the canonical time for ordering and joining.
- `sip_timestamp` is **epoch nanoseconds** (int64).
- `participant_timestamp` may be used for diagnostics but is not used for ordering/alignment in the MVP.

RTH-only policy (MVP):
- Build bars from Regular Trading Hours (RTH) only, defined in `America/New_York` as `[09:30, 16:00)`.

### 6.2 Cache format (raw)
Raw tick data is assumed to live under `DATA_PATH` (external to this repo).

Repo-local derived caches (gitignored) may be written under `data_cache/` in Parquet.
Recommended derived layers (per symbol/day):
- `data_cache/nbbo/` : consolidated NBBO stream derived from per-venue quotes
- `data_cache/trades_enriched/` : trades with as-of NBBO columns attached
- `data_cache/bars_1m/` : clean 1-minute bars (OHLCV + VWAP + trade count) derived from filtered trades

Optional (not required for MVP):
- `data_cache/quote_features_1m/` : per-minute quote/NBBO summary features (e.g., spread/mid, quote update counts, time-weighted spread). This can be generated to speed up Phase 2 feature engineering, but keeping `bars_1m/` trade-only is simpler and avoids schema churn.

### 6.5 Optional cache: `quote_features_1m/` (per-minute NBBO features)

Goal: provide a compact, per-minute summary of the NBBO/quote stream so Phase 2 feature engineering can join minute bars to quote state without re-scanning raw tick quotes.

**Inputs**
- `data_cache/nbbo/` (NBBO event stream), ordered by (`sip_timestamp`, `sequence_number`).

**Output**
- Parquet, partitioned by `symbol/year/month/day`:
  - `data_cache/quote_features_1m/symbol=.../year=YYYY/month=MM/day=DD/part-0000.parquet`

**Timestamp contract**
- Bar timestamp: `timestamp` is the **minute start** in UTC (`datetime64[ns, UTC]`).
- Minute window: `[timestamp, timestamp + 1 minute)`.
- RTH-only: only emit minutes in RTH (America/New_York `[09:30, 16:00)`) for weekdays.

**Required columns (recommended MVP-minimal)**
- `symbol` (string, upper)
- `timestamp` (UTC minute start)
- `best_bid_close` (float): NBBO best bid **as-of minute close** (last NBBO event with `nbbo_ts < timestamp+1m`, carried-forward from prior minutes if needed within the same RTH session)
- `best_ask_close` (float): NBBO best ask as-of minute close
- `mid_close` (float): `(best_bid_close + best_ask_close)/2`
- `spread_close` (float): `best_ask_close - best_bid_close`
- `nbbo_updates` (int): count of NBBO events with `timestamp <= nbbo_ts < timestamp+1m`
- `quote_coverage_ns` (int): nanoseconds within the minute where NBBO is defined (both bid and ask present). For MVP, if NBBO is always defined after the first quote of the day, this will be close to 60s for most minutes.

**Highly useful additional columns (recommended for modeling)**
- `mid_tw` (float): time-weighted average mid over the minute
- `spread_tw` (float): time-weighted average spread over the minute
- `spread_min` / `spread_max` (float): min/max spread observed during the minute
- `locked_ns` (int): time in ns where `spread_close == 0` is not sufficient; track intervals where `best_bid >= best_ask` (locked/crossed)
- `crossed_ns` (int): time in ns where `best_bid > best_ask`
- `effective_spread_close` (float): `spread_close / mid_close` (guard divide-by-zero)

**Computation details (determinism + edge cases)**
- Use the NBBO stream’s timestamps (`nbbo_ts`) as the change-points for piecewise-constant NBBO state.
- Time-weighted features are computed by integrating the state over sub-intervals between change-points within the minute.
- If there is no NBBO state yet for a minute (no prior quotes), emit the row with NA for price-derived fields and `quote_coverage_ns = 0` (or simply omit that minute; choose one policy and keep it consistent).
- Determinism: stable-sort NBBO events by (`sip_timestamp`, `sequence_number`) and do stable aggregation.

**Why separate from `bars_1m/`**
- Trade bars remain “price/volume from prints”, while quote bars remain “liquidity/state from NBBO”. This avoids schema churn and makes Phase 2 feature toggling cheap.

If you use Parquet partitioning, prefer:
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

### 6.4 NBBO construction + trade cleaning (MVP contract)
Because quotes are **per venue**, we first build NBBO and then enrich/clean trades.

NBBO construction (per symbol/day):
- Ingest all quote events and order by (`sip_timestamp`, `sequence_number`).
- Maintain the latest bid/ask per venue.
- Define NBBO at time `t` as:
  - `best_bid(t) = max_venues(bid_price)`
  - `best_ask(t) = min_venues(ask_price)`
- NBBO uses **all venues present** in the quote file (exchanges + darkpools).

Trade enrichment (as-of join):
- For each trade at time `t_trade` (`sip_timestamp`), attach the most recent NBBO snapshot with `nbbo_ts <= t_trade`.
- Record `quote_age_ns = t_trade - nbbo_ts`.

Trade filters (applied before 1m aggregation):
- **RTH-only**: drop trades outside RTH.
- **Corrections**: by default, keep only trades with `correction == 0` (configurable).
- **Conditions**: keep only trades whose `conditions` set is within an allowlist (configurable).
- **Stale quotes**: drop trades where `quote_age_ns > BAYTRADER_STALE_QUOTE_NS`.
- **Off-NBBO outliers**: drop trades whose price is outside `[best_bid - tol, best_ask + tol]`.
  - Default tolerance is spread-aware:
    - `tol = max(BAYTRADER_OFF_NBBO_ABS_TOL_USD, BAYTRADER_OFF_NBBO_SPREAD_MULT * (best_ask - best_bid))`

Configuration (set via `.env` / environment variables):
- `DATA_PATH` (required): root folder containing the extracted Parquet files
- `BAYTRADER_MARKET_TZ` (default `America/New_York`)
- `BAYTRADER_RTH_START` (default `09:30`), `BAYTRADER_RTH_END` (default `16:00`)
- `BAYTRADER_STALE_QUOTE_NS` (default `2000000000` = 2 seconds)
- `BAYTRADER_OFF_NBBO_ABS_TOL_USD` (default `0.01`)
- `BAYTRADER_OFF_NBBO_SPREAD_MULT` (default `0.5`)
- `BAYTRADER_TRADE_CONDITIONS_ALLOWLIST` (comma-separated; default empty = no filtering until configured)
- `BAYTRADER_TRADE_CORRECTION_ALLOWLIST` (comma-separated; default `0`)

---

## 7) Time Alignment Rules (Multi-instrument)

We require a shared minute grid.

**MVP approach (simple + robust)**
- Build clean 1-minute bars for each instrument from tick data (see §6.4).
- Restrict to RTH only.
- Build a master timeline from MSFT’s available 1-minute bars.
- For other instruments, inner-join on minute timestamp.
- If any required instrument bar is missing at a minute (including minutes with zero eligible trades after filtering):
  - treat as missing and **drop** that sample window (recommended MVP).

---

## 8) Features & Normalization

### 8.1 Base feature per instrument per minute
For each instrument `j` at minute `t`:
- `r_t` = log return of minute VWAP (default)
- `range_t` = log(high / low) (computed from eligible trade prices)
- `vol_t` = rolling std of returns over last 10 bars (within the lookback window)
- `v_t` = log1p(volume)

Each minute bar is built from filtered trades:
- `vwap_t = sum(price * size) / sum(size)` over eligible trades in the minute
- `open/high/low/close` from eligible trade prices in the minute (open=first, close=last)

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
Build (or refresh) derived caches from local Parquet trades+quotes under `DATA_PATH`.
- Inputs: symbols list, start/end dates
- Output: repo-local Parquet caches (NBBO, enriched trades, and/or 1m bars)

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

### Phase 1 — Tick ingest + derived caches (NBBO → clean 1m bars)
**Done when**
- `fetch` reads Parquet trades+quotes under `DATA_PATH` and writes derived caches
- NBBO construction, as-of join, and trade filters are deterministic
- Clean 1m bars (OHLCV + VWAP) exist for MSFT,VGT,SPY,TLT,VIX

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

1) `fetch` (build clean 1m bars from local trades+quotes)
2) `build-dataset` (aligned windows, MSFT target)
3) `train-tcn` + `eval-tcn`
4) `train-diffusion` + `eval-diffusion`
5) `predict` (as-of now or a historical timestamp)
6) `walkforward-eval` (calibration report over a range)

…and you get stable, reproducible outputs with sensible distributions.

---
