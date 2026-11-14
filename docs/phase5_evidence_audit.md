# EXIT-ZERO — Phase 5 Evidence Audit

**Audit date:** November 11, 2026  
**Scope:** Saved Phase 4 reports and artifacts, experimental code, mixed-mobility rerun, memory measurement, rounding, tests, build, and submission claims.

## Executive finding

The 20-seed congested-corridor experiment remains the strongest hackathon result. The 500-person result is directionally promising but statistically preliminary. The mixed-mobility result is a genuine regression in both total clearance and mean wheelchair evacuation time under the current configuration. Historical memory values were traced Python allocations, not RSS.

## 1. 500-person uncertainty and rounding

The Phase 4 report used three paired seeds. Phase 5 reran the same seeds (101–103), N=500, `dt=0.5s`, and a 250s limit, and saved canonical CSV/JSON artifacts. All three pairs again favored EXIT-ZERO, with baseline mean 231.83s, adaptive mean 131.67s, and paired mean difference 100.17s (43.2%). The exact two-sided sign-flip p-value is `0.25`. A bootstrap interval from three observations is descriptive and unstable; it should not be presented as replicated evidence.

The historical raw means were approximately:

- Baseline: 231.833… s.
- Adaptive: 131.667… s.
- Paired mean difference: 100.167… s.

Therefore:

- the paired difference rounds to 100.2s at one decimal;
- the displayed means round to 231.8s and 131.7s;
- subtracting those display values gives 100.1s.

The discrepancy is caused by independent rounding. Reports should label the paired mean difference as the source value and avoid recomputing it from rounded display means.

## 2. Mixed-mobility regression

The Phase 5 rerun used Scenario D, 140 occupants, seeds 101–120, `dt=0.5s`, and a 250s limit. All 20 paired runs completed.

| Measure | Baseline | EXIT-ZERO | Baseline − Adaptive |
| --- | ---: | ---: | ---: |
| Mean total evacuation time | 68.90 s | 70.47 s | -1.57 s |
| Mean wheelchair evacuation time | 48.44 s | 49.08 s | -0.64 s |
| Mean waiting-time reduction | — | — | +0.42 s |
| Mean peak-queue reduction | — | — | +3.25 occupants |

The exact two-sided sign-flip p-value for total-time differences is `0.0078`; the bootstrap interval is `[-2.78, -0.57]s`. This is evidence of a total-clearance regression, not an adaptive improvement. The adaptive strategy also increases the mean of per-seed wheelchair mean evacuation times by 0.64s.

Both strategies recorded zero wheelchair-unreachable occupants in the completed trials. The previous statement that EXIT-ZERO reduced wheelchair entrapment to zero was unsupported because baseline was already zero.

## 3. Memory measurement

Historical `<35 MB` values came from `tracemalloc`, which measures traced Python allocations. It does not measure total resident process memory.

Phase 5 now reports:

- `peak_python_heap_mb`: peak traced Python allocations from `tracemalloc`;
- `peak_process_rss_mb`: process RSS sampled with `psutil` at simulation-step boundaries;
- an explicit methodology note in JSON, CSV, and the Evidence Lab.

The 20-seed mixed-mobility rerun measured 3.32 MB peak traced Python heap and 64.53 MB sampled peak process RSS. The three-seed N=500 rerun measured 5.64 MB traced heap and 67.50 MB sampled RSS. These values belong to those runs and machine; they should not be generalized to all scenarios or deployments.

## 4. Statistical corrections

- Sign-flip tests now enumerate all assignments exactly for up to 20 paired observations.
- Larger samples retain deterministic Monte Carlo sign flips with an add-one correction.
- Results with fewer than 10 completed paired seeds are labelled `preliminary`.
- Results with 10–19 completed pairs are labelled `multi-seed`.
- Results with at least 20 completed pairs are labelled `replicated`.
- A positive performance claim requires both a positive bootstrap interval and `p < 0.05`; a significant negative effect is not labelled an adaptive benefit.

## 5. Claim hierarchy for judging

1. Lead with Scenario B, N=200, 20 paired seeds.
2. Present Scenario A as near parity, not a strong speed claim.
3. Present Scenario D as an honest regression and open optimization problem.
4. Present N=500 as a preliminary scaling observation only.
5. Keep every result scoped to this simulator and its assumptions.

