const { chromium } = require('../frontend/node_modules/playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/evidence_screenshots');

(async () => {
  console.log('--- STARTING TESTS C9 - C10 ---');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // -------------------------------------------------------------
  // TEST C9: Evidence Lab Validation & Live Batch Run
  // -------------------------------------------------------------
  console.log('\nExecuting Test C9: Evidence Lab Validation...');

  // Switch to Evidence Dashboard view
  const evidenceTabBtn = page.locator('nav[aria-label="Primary views"] button:has-text("Evidence Dashboard")');
  await evidenceTabBtn.click();
  await page.waitForTimeout(1500);

  // Verify view switched to Evidence Lab
  const evidenceTitle = await page.locator('h2:has-text("Reproducible Evidence Lab")').count();
  assert(evidenceTitle > 0, 'Reproducible Evidence Lab title not rendered');

  // Verify preloaded Scenario B evidence metrics
  const evidenceLabText = await page.locator('main').innerText();
  console.log('  Evidence Lab Header Text Verified');

  // Verify key audited figures in UI
  assert(evidenceLabText.includes('84.5') || evidenceLabText.includes('84.45'), 'Baseline mean time (84.45s) missing from Evidence Lab');
  assert(evidenceLabText.includes('72.9') || evidenceLabText.includes('72.92'), 'Adaptive mean time (72.92s) missing from Evidence Lab');
  assert(evidenceLabText.includes('11.5') || evidenceLabText.includes('11.53'), 'Delta (11.53s) missing from Evidence Lab');
  assert(evidenceLabText.includes('6.5') && evidenceLabText.includes('16.6'), '95% Bootstrap CI [6.5, 16.6] missing from Evidence Lab');
  assert(evidenceLabText.includes('p = 0.0001'), 'Permutation p-value 0.0001 missing from Evidence Lab');
  assert(evidenceLabText.includes('16 Wins') && evidenceLabText.includes('3 Loss') && evidenceLabText.includes('1 Ties'), 'Head-to-head outcomes (16/3/1) missing from Evidence Lab');
  assert(evidenceLabText.includes('Python heap') && evidenceLabText.includes('Process RSS'), 'Honest memory labels missing from Evidence Lab');

  // Verify charts render
  const svgCharts = await page.locator('.recharts-responsive-container svg').count();
  console.log(`  Found ${svgCharts} Recharts SVG charts.`);
  assert(svgCharts >= 2, `Expected at least 2 comparative Recharts, found ${svgCharts}`);

  // Verify per-seed table has 20 rows
  const tableRows = await page.locator('tbody tr').count();
  console.log(`  Per-seed table row count: ${tableRows}`);
  assert(tableRows >= 20, `Expected 20 seed rows, found ${tableRows}`);

  // Test CSV and JSON download links
  const csvLink = page.locator('a:has-text("Export CSV")');
  const jsonLink = page.locator('a:has-text("Export JSON")');
  assert(await csvLink.count() > 0, 'Export CSV link missing');
  assert(await jsonLink.count() > 0, 'Export JSON link missing');

  const csvHref = await csvLink.getAttribute('href');
  const jsonHref = await jsonLink.getAttribute('href');
  console.log(`  CSV Export URL: ${csvHref}`);
  console.log(`  JSON Export URL: ${jsonHref}`);

  // Fetch the actual exported content via browser evaluate
  const csvContent = await page.evaluate(async (url) => {
    const res = await fetch(url);
    return res.text();
  }, csvHref);
  assert(csvContent.includes('# EXIT-ZERO Experimental Benchmark Export'), 'CSV export missing valid header metadata');
  assert(csvContent.includes('PER_SEED_TRIAL_DATA') && csvContent.includes('Seed,Winner,Base_Evac_Time_s'), 'CSV export missing trial table headers');
  console.log('  CSV export content verified successfully.');

  const jsonContent = await page.evaluate(async (url) => {
    const res = await fetch(url);
    return res.json();
  }, jsonHref);
  assert(jsonContent.job_id, 'JSON export missing job_id');
  assert(jsonContent.summary && jsonContent.summary.sample_size === 20, 'JSON export summary sample size mismatch');
  console.log('  JSON export content verified successfully.');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c9_evidence_lab_verified.png') });

  // Run a real small experiment (3 seeds, 100 occupants) to test live job creation and polling
  console.log('  Configuring small real live experiment (3 seeds, 100 occupants)...');
  // Select 100 occupants inside Evidence Lab
  const popSelect = page.locator('main select').nth(1);
  await popSelect.selectOption('100');

  // Select 3 seeds inside Evidence Lab
  const seedCountSelect = page.locator('main select[aria-label="Paired seed count"]');
  await seedCountSelect.selectOption('3');

  const runExpBtn = page.locator('button:has-text("Execute Benchmark")');
  await runExpBtn.click();
  console.log('  Experiment launched! Polling status in UI...');

  // Wait for experiment job to finish (under 25s for 100 occupants / 3 seeds)
  await page.waitForFunction(() => {
    const btn = document.querySelector('button');
    const text = document.body.innerText;
    return text.includes('Execute Benchmark') && !text.includes('Running (');
  }, { timeout: 35000 });
  await page.waitForTimeout(1000);

  const completedTableRows = await page.locator('tbody tr').count();
  console.log(`  Completed experiment table rows: ${completedTableRows}`);
  assert.strictEqual(completedTableRows, 3, `Expected 3 trial rows, found ${completedTableRows}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c9_live_experiment_completed.png') });
  console.log('✅ Test C9 Passed: Evidence Lab verified, CSV/JSON validated, live experiment executed cleanly.');

  // -------------------------------------------------------------
  // TEST C10: Full Six-Step Judge Walkthrough
  // -------------------------------------------------------------
  console.log('\nExecuting Test C10: Full Six-Step Judge Walkthrough...');

  // Switch back to simulation view
  const liveSimBtn = page.locator('nav[aria-label="Primary views"] button:has-text("Live Simulation")');
  await liveSimBtn.click();
  await page.waitForTimeout(1000);

  // Open the Demonstration HUD
  const demoPillBtn = page.locator('button:has-text("Interactive Demo")');
  await demoPillBtn.click();
  await page.waitForTimeout(1000);

  const hudCard = page.locator('div[role="region"][aria-label="Judge Demonstration Walkthrough"]');
  assert(await hudCard.count() > 0, 'Demonstration Mode HUD failed to open');
  console.log('  Demonstration HUD opened successfully.');

  // Step 1: Building Layout & Occupant Distribution
  console.log('  Step 1: Building Layout & Occupant Distribution');
  let hudText = await hudCard.innerText();
  assert(hudText.includes('1. Building Layout'), 'Step 1 title missing');
  const step1Action = hudCard.locator('button:has-text("Load Building Layout & Reset")');
  await step1Action.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c10_step1_building_layout.png') });

  // Advance to Step 2
  const nextBtn = hudCard.locator('button:has-text("Next")');
  await nextBtn.click();
  await page.waitForTimeout(500);

  // Step 2: Conventional Shortest-Path Evacuation
  console.log('  Step 2: Conventional Shortest-Path Evacuation');
  hudText = await hudCard.innerText();
  assert(hudText.includes('2. Conventional Shortest-Path'), 'Step 2 title missing');
  const step2Action = hudCard.locator('button:has-text("Load & Run Baseline")');
  await step2Action.click();
  await page.waitForTimeout(3000); // Let baseline run for 3 seconds
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c10_step2_baseline_run.png') });

  // Advance to Step 3
  await nextBtn.click();
  await page.waitForTimeout(500);

  // Step 3: Formation of Congestion & Bottlenecks
  console.log('  Step 3: Formation of Congestion & Bottlenecks');
  hudText = await hudCard.innerText();
  assert(hudText.includes('3. Formation of Congestion'), 'Step 3 title missing');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c10_step3_bottleneck_physics.png') });

  // Advance to Step 4
  await nextBtn.click();
  await page.waitForTimeout(500);

  // Step 4: Predictive Adaptive Routing
  console.log('  Step 4: Predictive Adaptive Routing');
  hudText = await hudCard.innerText();
  assert(hudText.includes('4. Predictive Adaptive Routing'), 'Step 4 title missing');
  const step4Action = hudCard.locator('button:has-text("Run EXIT-ZERO Adaptive Simulation")');
  await step4Action.click();
  await page.waitForTimeout(3000); // Let adaptive run for 3 seconds
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c10_step4_adaptive_run.png') });

  // Advance to Step 5
  await nextBtn.click();
  await page.waitForTimeout(500);

  // Step 5: Live Emergency Exit Failure & Resilience
  console.log('  Step 5: Live Emergency Exit Failure & Resilience');
  hudText = await hudCard.innerText();
  assert(hudText.includes('5. Live Emergency Exit Failure'), 'Step 5 title missing');
  const step5Action = hudCard.locator('button:has-text("⚡ Block East Fire Escape")');
  await step5Action.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c10_step5_exit_blocked.png') });

  // Advance to Step 6
  await nextBtn.click();
  await page.waitForTimeout(500);

  // Step 6: Experimental Evidence & Scientific Rigor
  console.log('  Step 6: Experimental Evidence & Scientific Rigor');
  hudText = await hudCard.innerText();
  assert(hudText.includes('6. Experimental Evidence'), 'Step 6 title missing');
  const step6Action = hudCard.locator('button:has-text("Open Evidence Dashboard")');
  await step6Action.click();
  await page.waitForTimeout(1500);

  // Verify transition to Evidence Dashboard occurred seamlessly without reload
  const finalEvidenceTitle = await page.locator('h2:has-text("Reproducible Evidence Lab")').count();
  assert(finalEvidenceTitle > 0, 'Step 6 did not switch view to Evidence Lab');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c10_step6_evidence_transition.png') });
  console.log('✅ Test C10 Passed: Full 6-step walkthrough executed sequentially with zero restarts or defects.');

  await browser.close();
  assert.strictEqual(consoleErrors.length, 0, `Console errors occurred: ${consoleErrors.join(', ')}`);
  console.log('\n--- TESTS C9 - C10 COMPLETED SUCCESSFULLY ---');
})().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
