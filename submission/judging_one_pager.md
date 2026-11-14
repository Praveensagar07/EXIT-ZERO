# EXIT-ZERO — Judge One-Pager

## The idea

EXIT-ZERO is a research digital twin for testing adaptive evacuation routing against a conventional shortest-path baseline without changing the underlying crowd physics.

## The technical contribution

The adaptive strategy combines travel time, predicted queue delay, hazard exposure, corridor congestion, reroute cost, and hard accessibility constraints. A 20-second inflow horizon anticipates arrivals, while a 20% hysteresis threshold limits route chatter.

## Why the comparison is credible

Every paired trial holds geometry, spawn coordinates, mobility class, free speed, hazard events, random seed, movement rules, and FIFO exit service constant. Incomplete evacuations are not reported as completed times.

## Strongest result

Scenario B · 200 occupants · 20 paired seeds:

- 84.45 s baseline mean.
- 72.92 s EXIT-ZERO mean.
- 11.53 s paired mean reduction (13.65%).
- 95% bootstrap interval: 6.5–16.6 s.
- 16 adaptive wins / 3 baseline wins / 1 tie.

## What we will not claim

- We will not claim real-world safety certification.
- We will not treat three 500-person seeds as conclusive.
- We will not hide the mixed-mobility total-time regression.
- We will not call Python allocation tracing process RSS.

## What judges can try

1. Run baseline and adaptive with the same seed.
2. Block an exit during the live simulation.
3. Inspect reroute reasons and route overlays.
4. Run a paired experiment and watch progress.
5. Download CSV/JSON evidence.

