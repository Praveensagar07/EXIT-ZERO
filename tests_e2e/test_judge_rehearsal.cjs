const { chromium } = require('../frontend/node_modules/playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/evidence_screenshots');

(async () => {
  console.log('=== STARTING 3-MINUTE (180s) JUDGE DEMONSTRATION REHEARSAL ===');
  const tStart = Date.now();
  const timings = {};

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // [00:00 - 00:30] Hook & Building Layout
  let t0 = Date.now();
  console.log('\n[00:00 - 00:30] Segment 1: Problem Hook & Building Layout');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const demoBtn = page.locator('button:has-text("Interactive Demo")');
  await demoBtn.click();
  await page.waitForTimeout(500);

  const hudCard = page.locator('div[role="region"][aria-label="Judge Demonstration Walkthrough"]');
  assert(await hudCard.isVisible(), 'HUD card not open');

  const step1Btn = hudCard.locator('button:has-text("Load Building Layout & Reset")');
  await step1Btn.click();
  await page.waitForTimeout(1000);
  timings.segment1 = (Date.now() - t0) / 1000;
  console.log(`  Segment 1 elapsed: ${timings.segment1.toFixed(2)}s`);

  // [00:30 - 01:00] The Baseline Failure
  t0 = Date.now();
  console.log('\n[00:30 - 01:00] Segment 2: Baseline Shortest-Path Egress & Congestion Crush');
  const nextBtn = hudCard.locator('button:has-text("Next")');
  await nextBtn.click();
  await page.waitForTimeout(400);

  const step2Btn = hudCard.locator('button:has-text("Load & Run Baseline")');
  await step2Btn.click();
  console.log('  Running Baseline at 1x for 8s to illustrate bottleneck formation...');
  await page.waitForTimeout(8000);

  // Check metrics on HUD
  await nextBtn.click(); // Advance to Step 3 (Inspect bottleneck)
  await page.waitForTimeout(500);
  const step3Text = await hudCard.innerText();
  console.log('  Bottleneck telemetry snapshot:', step3Text.match(/t = [\d\.]+s[^\n]+/)?.[0]);
  timings.segment2 = (Date.now() - t0) / 1000;
  console.log(`  Segment 2 elapsed: ${timings.segment2.toFixed(2)}s`);

  // [01:00 - 01:45] Adaptive Predictive Intelligence
  t0 = Date.now();
  console.log('\n[01:00 - 01:45] Segment 3: EXIT-ZERO Adaptive Predictive Intelligence');
  await nextBtn.click(); // Step 4
  await page.waitForTimeout(400);

  const step4Btn = hudCard.locator('button:has-text("Run EXIT-ZERO Adaptive Simulation")');
  await step4Btn.click();
  console.log('  Running Adaptive at 1x for 8s to illustrate proactive diversion...');
  await page.waitForTimeout(8000);
  timings.segment3 = (Date.now() - t0) / 1000;
  console.log(`  Segment 3 elapsed: ${timings.segment3.toFixed(2)}s`);

  // [01:45 - 02:15] Emergency Exit Closure & Resilience
  t0 = Date.now();
  console.log('\n[01:45 - 02:15] Segment 4: Runtime Incident & Exit Failure');
  await nextBtn.click(); // Step 5
  await page.waitForTimeout(400);

  const step5Btn = hudCard.locator('button:has-text("⚡ Block East Fire Escape")');
  await step5Btn.click();
  console.log('  Blocked East Fire Escape at runtime. Simulating 5s of evacuation...');
  await page.waitForTimeout(5000);
  timings.segment4 = (Date.now() - t0) / 1000;
  console.log(`  Segment 4 elapsed: ${timings.segment4.toFixed(2)}s`);

  // [02:15 - 02:45] Evidence Lab & Statistical Rigor
  t0 = Date.now();
  console.log('\n[02:15 - 02:45] Segment 5: Evidence Lab & Statistical Rigor');
  await nextBtn.click(); // Step 6
  await page.waitForTimeout(400);

  const step6Btn = hudCard.locator('button:has-text("Open Evidence Dashboard")');
  await step6Btn.click();
  await page.waitForTimeout(1000);

  // Check statistical cards
  const evText = await page.locator('main').innerText();
  assert(evText.includes('13.65%'), '13.65% improvement missing');
  assert(evText.includes('[6.5, 16.6]'), 'Confidence interval missing');
  timings.segment5 = (Date.now() - t0) / 1000;
  console.log(`  Segment 5 elapsed: ${timings.segment5.toFixed(2)}s`);

  // [02:45 - 03:00] Conclusion & Return to Floor Plan
  t0 = Date.now();
  console.log('\n[02:45 - 03:00] Segment 6: Safety Boundaries, Disclaimers & Wrap-up');
  const simNavBtn = page.locator('nav[aria-label="Primary views"] button:has-text("Live Simulation")');
  await simNavBtn.click();
  await page.waitForTimeout(1000);
  timings.segment6 = (Date.now() - t0) / 1000;
  console.log(`  Segment 6 elapsed: ${timings.segment6.toFixed(2)}s`);

  const totalRehearsalTime = (Date.now() - tStart) / 1000;
  console.log(`\n=== REHEARSAL COMPLETE ===`);
  console.log(`Total Live Demonstration Duration: ${totalRehearsalTime.toFixed(1)}s (Target: ≤ 180s)`);
  assert(totalRehearsalTime <= 180, `Rehearsal exceeded 180 seconds: ${totalRehearsalTime}s`);
  console.log('✅ Judge rehearsal passed within target time window without restarts or hangs.');

  await browser.close();
})().catch((err) => {
  console.error('❌ Rehearsal failed:', err);
  process.exit(1);
});
