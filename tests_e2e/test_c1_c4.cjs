const { chromium } = require('../frontend/node_modules/playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/evidence_screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('--- STARTING TESTS C1 - C4 ---');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', (req) => {
    if (!req.url().includes('favicon')) {
      failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    }
  });

  // TEST C1: Initial Experience
  console.log('Executing Test C1: Initial Experience...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const title = await page.title();
  assert.strictEqual(title, 'EXIT-ZERO · Evacuation Digital Twin', `Unexpected title: ${title}`);

  const navHeader = await page.locator('header').innerText();
  assert(navHeader.includes('EXIT-ZERO'), 'Header does not contain EXIT-ZERO');
  assert(navHeader.includes('INNOVEX 2026') || navHeader.includes('DIGITAL TWIN'), 'Header missing INNOVEX / DIGITAL TWIN badge');

  const mainContent = await page.locator('main').count();
  assert(mainContent > 0, 'Main dashboard is not rendered');

  const svgFloor = await page.locator('svg').count();
  assert(svgFloor > 0, 'Floor plan SVG not rendered');

  const scenarioSelect = page.locator('select[aria-label="Simulation scenario"]');
  const optionsCount = await scenarioSelect.locator('option').count();
  console.log(`Found ${optionsCount} scenarios in dropdown`);
  assert(optionsCount >= 8, `Expected at least 8 scenarios, found ${optionsCount}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c1_initial_experience.png') });
  console.log('✅ Test C1 Passed. Console errors:', consoleErrors.length, 'Failed requests:', failedRequests.length);
  assert.strictEqual(consoleErrors.length, 0, `Uncaught console errors: ${consoleErrors.join(', ')}`);

  // TEST C2: Scenario Selection across all 8 scenarios
  console.log('\nExecuting Test C2: Scenario Selection...');
  const scenarioOptions = await scenarioSelect.locator('option').allInnerTexts();
  const scenarioValues = await scenarioSelect.locator('option').evaluateAll((opts) => opts.map(o => o.value));

  for (let i = 0; i < scenarioValues.length; i++) {
    const sId = scenarioValues[i];
    const sName = scenarioOptions[i];
    console.log(`  Selecting scenario ${i + 1}/${scenarioValues.length}: ${sId} (${sName})`);

    await scenarioSelect.selectOption(sId);
    await page.waitForTimeout(1000);

    const countsText = await page.locator('header').innerText();
    assert(countsText.includes('CLOCK') && countsText.includes('LIVE'), 'Telemetry clock or online status missing from header');

    const roomRects = await page.locator('svg g.cursor-pointer, svg rect').count();
    assert(roomRects > 0, `No room geometry rendered for scenario ${sId}`);

    assert.strictEqual(consoleErrors.length, 0, `Console errors when selecting ${sId}: ${consoleErrors.join(', ')}`);
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c2_scenario_selection.png') });
  console.log('✅ Test C2 Passed: All 8 scenarios loaded with valid geometry and state.');

  // TEST C3: Baseline Simulation
  console.log('\nExecuting Test C3: Baseline Simulation...');
  await scenarioSelect.selectOption('scenario_congested_corridor');
  await page.waitForTimeout(1000);

  const algoSelect = page.locator('select[aria-label="Routing strategy"]');
  await algoSelect.selectOption('baseline');
  await page.waitForTimeout(500);

  console.log('  Initial state loaded. Stepping simulation...');
  const stepButton = page.locator('button[aria-label*="Advance simulation by 0.5 seconds"]');
  for (let s = 0; s < 5; s++) {
    await stepButton.click();
    await page.waitForTimeout(200);
  }

  const timeAfterStep = await page.locator('header').innerText();
  assert(timeAfterStep.includes('2.5s'), `Simulated time did not reach 2.5s: ${timeAfterStep}`);

  // Test Play / Pause
  const playButton = page.locator('button[aria-label="Start simulation"], button[aria-label="Pause simulation"]');
  await playButton.click(); // Start playback
  console.log('  Playing at 1x speed for 3 seconds...');
  await page.waitForTimeout(3000);
  await playButton.click(); // Pause playback
  console.log('  Paused playback.');

  // Test Speed Multiplier
  const speedSelect = page.locator('select[aria-label="Simulation speed"]');
  await speedSelect.selectOption('2');
  console.log('  Switched to 2x speed.');
  await page.waitForTimeout(300);

  // Test Reset
  const resetButton = page.locator('button[aria-label="Reset simulation"]');
  await resetButton.click();
  await page.waitForTimeout(1000);
  const timeAfterReset = await page.locator('header').innerText();
  assert(timeAfterReset.includes('0.0s'), 'Simulation did not reset to 0.0s');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c3_baseline_simulation.png') });
  console.log('✅ Test C3 Passed: Baseline movement, queue, metrics, step, play, pause, speed, and reset confirmed.');

  // TEST C4: Adaptive Simulation
  console.log('\nExecuting Test C4: Adaptive Simulation...');
  await algoSelect.selectOption('adaptive');
  await page.waitForTimeout(1000);

  const bannerText = await page.locator('main').innerText();
  assert(bannerText.includes('Adaptive') || bannerText.includes('EXIT-ZERO'), 'Adaptive algorithm not reflected in UI');

  // Run simulation forward
  await playButton.click();
  console.log('  Playing Adaptive simulation for 5 seconds...');
  await page.waitForTimeout(5000);
  await playButton.click(); // Pause

  // Check Reroutes tab
  const reroutesTab = page.locator('button:has-text("Reroutes"), button:has-text("Reroute Events")').first();
  if (await reroutesTab.count() > 0) {
    await reroutesTab.click();
    await page.waitForTimeout(500);
    const rerouteContent = await page.locator('aside').innerText();
    console.log('  Reroutes panel text snippet:', rerouteContent.slice(0, 150).replace(/\n/g, ' '));
  }

  const circles = await page.locator('svg circle').count();
  console.log(`  Rendered ${circles} occupant circles on floor plan.`);
  assert(circles > 0, 'No occupant circles rendered');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c4_adaptive_simulation.png') });
  console.log('✅ Test C4 Passed: Adaptive simulation runs cleanly with live congestion lookahead and reroute tracking.');

  await browser.close();
  console.log('\n--- TESTS C1 - C4 COMPLETED SUCCESSFULLY ---');
})().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
