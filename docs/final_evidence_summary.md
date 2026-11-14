# EXIT-ZERO — Final Evidence Summary & Statistical Manifesto

**Project:** EXIT-ZERO — Adaptive Emergency Evacuation Digital Twin  
**Hackathon:** INNOVEX 2026  
**Evaluation Standard:** Replicated Empirical Evidence (Strict Paired Fairness)  
**Last Audited:** November 12, 2026  

---

## 1. Experimental Methodology & Fairness Protocol

All benchmark evaluations adhere to the **Strict Paired Fairness Protocol** defined in `backend/app/experiments/runner.py`:

```
+---------------------------------------------------------------------------------------------------------+
|                                    STRICT PAIRED FAIRNESS PROTOCOL                                      |
+---------------------------------------------------------------------------------------------------------+
| 1. Paired Random Seeds:                                                                                 |
|    Each trial runs Baseline and Adaptive with the exact same random seed (e.g. s ∈ [101, 120]).         |
| 2. Identical Agent Spawns:                                                                              |
|    Occupant initial coordinates (x, y) and assigned rooms match down to floating-point bit.             |
| 3. Identical Physical Attributes:                                                                       |
|    Free walking speed v_0 and mobility category (standard, reduced_speed, wheelchair) match.            |
| 4. Shared Movement Physics:                                                                             |
|    Weidmann continuous speed-density deceleration v(ρ), corridor flow caps, and FIFO exit throughput   |
|    are shared identically across both strategies.                                                       |
| 5. Identical Environmental Timelines:                                                                   |
|    Fire growth rates, smoke radii, and scheduled scenario events execute at identical time steps.       |
| 6. Statistical Rigor:                                                                                   |
|    95% Confidence Intervals computed via Percentile Bootstrap (N=2000 resamples, seed=2026).           |
|    Significance evaluated via Two-Tailed Paired Permutation Tests.                                      |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Audited Benchmark Artifacts (`experiments/benchmark_*.json`)

All figures below come directly from persisted JSON artifacts in `experiments/`:

| Artifact & Scenario | Pop (N) | Seeds | Baseline Mean (s) | Adaptive Mean (s) | Mean Delta (s) | Rel Gain (%) | 95% Bootstrap CI (s) | Permutation p-value | W / L / T (Adapt / Base / Tie) | Peak Queue Reduction | Peak Memory |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **B. Congested Corridor (`N200_20seeds`, Principal Claim)** | **200** | **20** | **84.45** | **72.92** | **+11.53** | **+13.65%** | **[6.50, 16.60]** | **p = 0.0001** | **16 / 3 / 1** | **-7.30 pers** | **2.06 MB heap** (`tracemalloc`) |
| **A. Sudden Exit Closure (`N150_20seeds`, Pre-fix V1)** | 150 | 20 (11 complete, 9 timeout) | 91.14 | 90.82 | +0.32 | +0.35% | [-0.18, 1.05] | p = 0.6206 | 5 / 2 / 13 | -1.25 pers | 3.41 MB heap |
| **D. Mixed Mobility (`N140_20seeds`, V1)** | 140 | 20 | 68.90 | 70.47 | -1.57 | -2.28% | — | p = 0.0078 | 0 / 8 / 12 | -3.25 pers | — |
| **D. Mixed Mobility (`N140_20seeds_v2`, V2)** | 140 | 20 | 68.90 | 69.83 | -0.93 | -1.35% | [-1.52, -0.42] | p = 0.0010 | 0 / 6 / 14 | +20.85 pers* | 3.45 MB heap / 64.21 MB RSS |
| **B. Congested Corridor (`N500_3seeds`, Preliminary)** | 500 | 3 | 231.83 | 131.67 | +100.17 | +43.20% | [86.50, 115.00] | p = 0.2500 | 3 / 0 / 0 | -71.33 pers | 5.64 MB heap / 67.50 MB RSS |

*\*Note on V2 Scenario D queue increase:* `benchmark_scenario_mixed_mobility_N140_20seeds_v2.json` ran with `w_accessibility_reservation = 2.0`, which pushed ambulatory occupants into the narrow south emergency stairwell. Phase 5.3 set `AlgorithmWeights.w_accessibility_reservation` default to `0.0` while retaining opt-in configuration, improving Seed 101–120 Scenario D Adaptive queue delta cleanly (`7.60` Baseline vs `5.45` Adaptive, wheelchair mean `48.44s` vs `48.42s`) and restoring Scenario B Seed 101 performance (`84.5s` Baseline vs `64.0s` Adaptive). Historical artifacts in `experiments/` are preserved unchanged for auditability.

---

## 3. Principal Evidence Analysis (Scenario B, $N = 200$, 20 Seeds)

Source artifact: `experiments/benchmark_scenario_congested_corridor_N200_20seeds.json` (`job_id = "exp_4049e56e"`).

- **Baseline Evacuation Time:** Mean = **84.45s**, Median = 83.25s, Std = 4.77s.
- **EXIT-ZERO Evacuation Time:** Mean = **72.92s**, Median = 74.25s, Std = 9.26s.
- **Mean Improvement:** **11.53 seconds faster (+13.65% relative gain)**.
- **Bootstrap 95% Confidence Interval:** $[+6.50\text{s}, +16.60\text{s}]$, strictly positive across 2,000 resamples (`seed=2026`).
- **Hypothesis Testing:** Two-tailed paired permutation test yields $p = 0.0001 < 0.001$.
- **Head-to-Head Record:** EXIT-ZERO won **16 seeds (80%)**, tied **1 seed (5%)**, and lost **3 seeds (15%)**.
- **Congestion & Queue Impact:**
  - Peak exit queue decreased by **7.30 occupants** on average across the 20 seeds.
  - Peak crowd density decreased by **0.31 pers/m²** on average.

---

## 4. Accessibility & Mixed-Mobility Analysis (Scenario D, $N = 140$, 20 Seeds)

Source artifacts: `benchmark_scenario_mixed_mobility_N140_20seeds.json` (V1) and `benchmark_scenario_mixed_mobility_N140_20seeds_v2.json` (V2).

| Metric Cohort | Metric | Baseline | Adaptive V1 (`N140`) | Adaptive V2 (`N140_v2`) | Phase 5.3 Post-Fix Check (20 seeds `101..120`) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **All Occupants** | Mean Total Evacuation Time | 68.90s | 70.47s | 69.83s | 69.60s |
| **All Occupants** | Mean Peak Exit Queue | 7.60 pers | 4.35 pers | 28.45 pers | 5.45 pers |
| **Wheelchair Cohort** | Wheelchair Mean Evacuation Time | **48.44s** | 49.08s | 48.62s | **48.42s** |
| **Wheelchair Cohort** | Inaccessible Node / Exit Violations | **0** | **0** | **0** | **0** |
| **Wheelchair Cohort** | Wheelchair Trapped Count | **0** | **0** | **0** | **0** |

### Engineering Conclusions:
1. **Strict ADA Graph Filtering Works:** Wheelchair occupants never enter inaccessible corridors, stairwells, or exits (`0` violations across all tested baselines and adaptive runs).
2. **Physical Distance Dominance:** At $0.65\text{–}0.85\text{ m/s}$, wheelchair detours cost far more time than moderate exit queues. Detour stabilization prevents needless reassignments.
3. **Reservation Weight Tuning:** Defaulting `w_accessibility_reservation` to `0.0` eliminates the artificial bottleneck on narrow emergency stairwells when ramps are uncongested.

---

## 5. Computational Complexity & Memory Accounting

- **Optimized Graph Lookups:** Single-source reverse Dijkstra per accessible/standard graph class + invalidated-on-change cached subgraphs + incremental per-exit arrival dictionary (`_cached_arrival_times`).
- **Measured Memory Footprint (from audited artifacts & live Phase 5.3 telemetry):**
  - `tracemalloc` Peak Python Heap: **2.06 MB** (`N=200` Scenario B) to **5.64 MB** (`N=500` Scenario B).
  - `psutil` Peak Process RSS: **64.21 MB** (`N=140` Scenario D V2) to **67.50 MB** (`N=500` Scenario B).
  - Live `Scenario B` single-run and Phase 5.3 scaling measurements are documented separately in `docs/phase5_3_test_results.md`.

---

## 6. Life-Safety & Regulatory Disclaimer

> [!WARNING]
> **EXIT-ZERO IS A RESEARCH AND DESIGN PROTOTYPE, NOT A CERTIFIED LIFE-SAFETY EVACUATION SYSTEM.**
>
> EXIT-ZERO is developed strictly as an experimental digital twin to evaluate predictive routing algorithms, crowd density dynamics, and accessibility trade-offs in simulated environments. It is **not** certified under NFPA 101, NFPA 72, EN 54, or any municipal building code and must never be deployed to control real-world building signage, doors, or alarms.
