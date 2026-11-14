# EXIT-ZERO — 4-Minute Judge Demonstration

## Before judges arrive

- Start the backend and frontend.
- Confirm the backend status reads **LIVE**.
- Open Scenario B: Congested Corridor.
- Set seed `101`.
- Keep the Evidence Lab available in a second browser tab only if the event permits it.
- Do not pre-record a live result as though it were generated during the demonstration.

## 0:00–0:35 — Problem and fairness

“EXIT-ZERO tests whether predictive routing can reduce simulated evacuation bottlenecks. Baseline and adaptive routing receive the same building, occupant coordinates, mobility mix, random seed, hazard events, movement physics, and exit queues. Only the routing decision changes.”

Point to the scenario, strategy, and seed controls. State that this is a research prototype, not a certified safety system.

## 0:35–1:25 — Baseline run

Load baseline, press Play, and point to the floor plan, density overlay, exit queues, live census, and clock. Let the run finish. Read the displayed result; do not substitute a saved number if the live result differs.

## 1:25–2:20 — Adaptive run

Reset, switch to EXIT-ZERO adaptive, keep seed `101`, and press Play. Show the reroute feed and route overlays. Explain the 20-second inflow lookahead and the 20% hysteresis threshold in one sentence each.

Let the run finish and compare the live outcome with the baseline observation.

## 2:20–3:15 — Replicated evidence

Open the Evidence Lab.

“A single run is a demonstration, not proof. Our principal saved result uses 20 paired seeds with 200 occupants. It reports mean clearance of 84.45 seconds for baseline and 72.92 seconds for EXIT-ZERO, a paired mean reduction of 11.53 seconds. The 95% bootstrap interval is 6.5 to 16.6 seconds.”

Show the seed-level table and export controls.

## 3:15–4:00 — Honest limits

“The 500-person result has only three seeds, so we label it preliminary. In mixed mobility, overall clearance was 1.57 seconds slower and mean wheelchair evacuation time was 0.64 seconds slower under adaptive routing. We report that regression instead of inferring an accessibility benefit from queue length alone. Python heap and total process RSS are also labelled separately.”

Close with the value proposition: reproducible, auditable routing experiments in an interactive digital twin.

## If the live run fails

Do not invent a result. Show the backend status, retry once with Reset, then move to the saved 20-seed artifact and explain that it is a previously generated reproducible export. Record the failure after judging.

