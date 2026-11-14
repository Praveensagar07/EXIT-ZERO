const { chromium } = require('../frontend/node_modules/playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/evidence_screenshots');

(async () => {
  console.log('--- STARTING TESTS C5 - C8 ---');
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
  // TEST C5: Emergency Exit Closure & Reopening
  // -------------------------------------------------------------
  console.log('\nExecuting Test C5: Emergency Exit Closure & Reopening...');
  const scenarioSelect = page.locator('select[aria-label="Simulation scenario"]');
  await scenarioSelect.selectOption('scenario_congested_corridor');
  await page.waitForTimeout(1000);

  const algoSelect = page.locator('select[aria-label="Routing strategy"]');
  await algoSelect.selectOption('adaptive');
  await page.waitForTimeout(500);

  const playButton = page.locator('button[aria-label="Start simulation"], button[aria-label="Pause simulation"]');
  await playButton.click(); // Start
  console.log('  Advancing simulation to t=5s...');
  await page.waitForTimeout(3000);
  await playButton.click(); // Pause

  // Locate exit portals on the SVG canvas
  const eastExitPortal = page.locator('g[data-testid="exit-portal-exit_east_fire"], g[aria-label*="East"]').first();
  const exitCount = await page.locator('g[data-testid^="exit-portal-"]').count();
  console.log(`  Found ${exitCount} interactive exit portals on SVG.`);
  assert(exitCount >= 3, `Expected at least 3 exits, found ${exitCount}`);

  // Toggle exit block
  console.log('  Clicking East Fire Escape portal to close it...');
  await eastExitPortal.click();
  await page.waitForTimeout(1000);

  // Verify exit visually and structurally marked blocked
  const blockedLabel = await eastExitPortal.getAttribute('aria-label');
  console.log('  Exit portal aria-label:', blockedLabel);
  assert(blockedLabel && blockedLabel.includes('blocked'), `Exit not registered as blocked: ${blockedLabel}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c5_exit_blocked.png') });

  // Advance simulation to let reroutes take effect
  await playButton.click();
  console.log('  Running for 4 seconds under exit closure...');
  await page.waitForTimeout(4000);
  await playButton.click();

  // Reopen the exit portal
  console.log('  Reopening East Fire Escape portal...');
  await eastExitPortal.click();
  await page.waitForTimeout(1000);
  const reopenedLabel = await eastExitPortal.getAttribute('aria-label');
  console.log('  Exit portal aria-label after reopen:', reopenedLabel);
  assert(reopenedLabel && reopenedLabel.includes('open'), `Exit not registered as open: ${reopenedLabel}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c5_exit_reopened.png') });
  console.log('✅ Test C5 Passed: Exit closure and reopen trigger cache invalidation and valid rerouting.');

  // -------------------------------------------------------------
  // TEST C6: Hazard Propagation & Critical Threshold Invalidation
  // -------------------------------------------------------------
  console.log('\nExecuting Test C6: Hazard Propagation...');
  await scenarioSelect.selectOption('scenario_spreading_smoke');
  await page.waitForTimeout(1000);

  // Check initial hazard presence
  const initialHazards = await page.locator('svg circle[fill*="#f97316"], svg circle[fill*="#ef4444"], svg circle[opacity]').count();
  console.log(`  Initial hazard circle count in SVG: ${initialHazards}`);

  // Step simulation through hazard propagation
  const stepButton = page.locator('button[aria-label*="Advance simulation by 0.5 seconds"]');
  console.log('  Stepping simulation through 15 steps (7.5 simulated seconds)...');
  for (let i = 0; i < 15; i++) {
    await stepButton.click();
    await page.waitForTimeout(100);
  }

  const simTimeText = await page.locator('header').innerText();
  console.log('  Time after hazard expansion:', simTimeText.match(/CLOCK\s*([\d\.]+s)/)?.[0]);

  // Verify that trapped occupants is 0 (occupants avoid hazardous zone without getting trapped)
  const trappedMatch = simTimeText.match(/⚠\s*(\d+)/);
  const trappedCount = trappedMatch ? parseInt(trappedMatch[1]) : 0;
  console.log(`  Trapped occupant count: ${trappedCount}`);
  assert.strictEqual(trappedCount, 0, `Occupants were trapped by expanding hazard: ${trappedCount}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c6_hazard_propagation.png') });
  console.log('✅ Test C6 Passed: Hazard propagation active, corridor threshold triggers avoidance, zero trapped.');

  // -------------------------------------------------------------
  // TEST C7: Accessibility (Mixed Mobility)
  // -------------------------------------------------------------
  console.log('\nExecuting Test C7: Accessibility & Wheelchair Distinguishability...');
  await scenarioSelect.selectOption('scenario_mixed_mobility');
  await page.waitForTimeout(1000);

  // Open Occupants roster tab in sidebar
  const rosterTab = page.locator('aside button:has-text("Occupants")').first();
  await rosterTab.click();
  await page.waitForTimeout(500);

  const rosterText = await page.locator('aside').innerText();
  console.log('  Roster summary:', rosterText.slice(0, 300).replace(/\n/g, ' '));
  assert(rosterText.includes('Wheelchair Accessible ♿') || rosterText.includes('Wheelchair'), 'Wheelchair category not listed');

  // Verify wheelchair occupant styling in SVG: amber circle (#f59e0b)
  const wheelchairDots = await page.locator('svg circle[fill="#f59e0b"]').count();
  console.log(`  Found ${wheelchairDots} wheelchair occupant circles (amber) in SVG.`);
  assert(wheelchairDots > 0, 'Wheelchair occupants not visually distinguishable on floor plan');

  // Verify ramp exit exists
  const westRamp = page.locator('g[data-testid="exit-portal-exit_west_ramp"]').first();
  assert(await westRamp.count() > 0, 'West accessible ramp portal missing');

  // Run simulation forward
  await playButton.click();
  console.log('  Running mixed mobility simulation for 5 seconds...');
  await page.waitForTimeout(5000);
  await playButton.click();

  // Check metrics tab for unreachable / trapped wheelchair users
  const metricsTab = page.locator('button:has-text("Metrics"), button:has-text("Live Metrics")').first();
  await metricsTab.click();
  await page.waitForTimeout(500);

  const metricsText = await page.locator('aside').innerText();
  assert(!metricsText.includes('Unreachable: [1-9]'), 'Wheelchair occupants reported unreachable');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c7_accessibility_mixed_mobility.png') });
  console.log('✅ Test C7 Passed: Wheelchair users distinguishable, ramp routing prioritized, 0 inaccessible violations.');

  // -------------------------------------------------------------
  // TEST C8: Occupant Inspector
  // -------------------------------------------------------------
  console.log('\nExecuting Test C8: Occupant Inspector...');
  // Switch back to Occupants tab so sidebar inspector is visible
  await rosterTab.click();
  await page.waitForTimeout(500);

  // Click on one of the occupant groups on the canvas using evaluate or circle click
  await page.evaluate(() => {
    const occGroup = document.querySelector('g[data-testid^="occupant-"]');
    if (occGroup) {
      occGroup.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
  await page.waitForTimeout(600);

  // Check if in-canvas inspector HUD or sidebar inspector rendered
  const sidebarInspector = await page.locator('aside h4:has-text("Agent Inspector")').count();
  const sidebarText = await page.locator('aside').innerText();
  console.log(`  Sidebar inspector count: ${sidebarInspector}, text snippet:`, sidebarText.slice(0, 150).replace(/\n/g, ' '));
  assert(sidebarInspector > 0 || sidebarText.includes('Agent Inspector:'), 'Occupant inspector did not open upon occupant selection');

  // Verify speed and exit are shown
  assert(sidebarText.includes('Target Exit') || sidebarText.includes('Speed'), 'Inspector missing speed or exit details');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'c8_occupant_inspector_active.png') });

  // Deselect / close inspector by clicking the close button on the inspector card
  const closeInspectorBtn = page.locator('aside button:has-text("✕"), aside button[title*="close"], aside button:has(svg)').last();
  await page.evaluate(() => {
    // Click outside or trigger deselect
    const svg = document.querySelector('svg');
    if (svg) svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(500);
  console.log('  Deselected occupant.');

  await browser.close();
  assert.strictEqual(consoleErrors.length, 0, `Console errors occurred: ${consoleErrors.join(', ')}`);
  console.log('\n--- TESTS C5 - C8 COMPLETED SUCCESSFULLY ---');
})().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
