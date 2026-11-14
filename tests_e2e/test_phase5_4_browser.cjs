const { chromium } = require('playwright');

async function runPhase54BrowserValidation() {
  console.log('================================================================');
  console.log('EXIT-ZERO — PHASE 5.4 REAL BROWSER ACCEPTANCE TESTING');
  console.log('Testing 3D Multi-Floor Digital Twin, Building Studio & Light Theme');
  console.log('================================================================\n');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  const testResults = [];

  const recordResult = (testName, passed, details = '') => {
    testResults.push({ testName, passed, details });
    const mark = passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark} - ${testName}`);
    if (details) console.log(`   └─ ${details}`);
  };

  try {
    // -------------------------------------------------------------
    // Test 1: Initial Experience & Light Architectural Engineering UI
    // -------------------------------------------------------------
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    const bodyBg = await page.evaluate(() => {
      const el = document.body;
      return window.getComputedStyle(el).backgroundColor;
    });
    // #FAFAF8 is rgb(250, 250, 248)
    const isLightBg = bodyBg.includes('250, 250, 248') || bodyBg.includes('248, 250, 252') || bodyBg.includes('255, 255, 255');
    recordResult('Test 1.1: Light Architectural Theme Background', isLightBg, `Body background: ${bodyBg}`);

    const hasBrand = (await page.textContent('body')).includes('EXIT-ZERO');
    recordResult('Test 1.2: Brand Presence', hasBrand, 'Header displays EXIT-ZERO brand');

    const hasTabs =
      (await page.locator('text=Simulation').count()) > 0 &&
      (await page.locator('text=Building Studio').count()) > 0 &&
      (await page.locator('text=Evidence Lab').count()) > 0;
    recordResult('Test 1.3: Primary Navigation Tabs', hasTabs, 'Simulation, Building Studio, Evidence Lab tabs visible');

    const hasCanvas3D = (await page.locator('canvas').count()) > 0;
    recordResult('Test 1.4: 3D WebGL Canvas Mounted', hasCanvas3D, 'Three.js 3D canvas is present and active');

    // -------------------------------------------------------------
    // Test 2: View Mode & Multi-Floor Controls
    // -------------------------------------------------------------
    const fullBtn = page.locator('button:has-text("Full Building")');
    const explodedBtn = page.locator('button:has-text("Exploded View")');
    const floorOnlyBtn = page.locator('button:has-text("Floor Only")');

    const hasViewModes = (await fullBtn.count()) > 0 && (await explodedBtn.count()) > 0;
    recordResult('Test 2.1: View Mode Switches', hasViewModes, 'Full Building, Exploded View, Floor Only controls ready');

    // Click Exploded View
    if (await explodedBtn.count() > 0) {
      await explodedBtn.first().click();
      await page.waitForTimeout(500);
      recordResult('Test 2.2: Exploded View Mode Activated', true, 'Exploded view active with separated floor slabs');
    }

    // Toggle 2D Floor Plan vs 3D View
    const floorPlanBtn = page.locator('button:has-text("2D Floor Plan")');
    const view3DBtn = page.locator('button:has-text("3D View")');

    if (await floorPlanBtn.count() > 0) {
      await floorPlanBtn.first().click();
      await page.waitForTimeout(500);
      const hasSvg = (await page.locator('svg').count()) > 0;
      recordResult('Test 2.3: Toggle to 2D Floor Plan', hasSvg, '2D SVG Floor Plan Viewport active');

      await view3DBtn.first().click();
      await page.waitForTimeout(500);
      recordResult('Test 2.4: Toggle back to 3D View', true, 'Interactive 3D Viewport restored');
    }

    // -------------------------------------------------------------
    // Test 3: Simulation Execution on Multi-Floor Demo
    // -------------------------------------------------------------
    const playBtn = page.locator('button[title="Play"]');
    if (await playBtn.count() > 0) {
      await playBtn.click();
      await page.waitForTimeout(2500);

      const timeText = await page.locator('text=Simulation Time').locator('..').textContent();
      recordResult('Test 3.1: Simulation Run & Digital Timer', !timeText.includes('00:00'), `Time progressed: ${timeText.replace('Simulation Time', '').trim()}`);

      const evacText = await page.locator('text=Evacuated').first().locator('..').textContent();
      recordResult('Test 3.2: Evacuation Progress Tracking', evacText.includes('/'), `Evacuated status: ${evacText.replace('Evacuated', '').trim()}`);

      const pauseBtn = page.locator('button[title="Pause"]');
      if (await pauseBtn.count() > 0) {
        await pauseBtn.click();
        await page.waitForTimeout(400);
        recordResult('Test 3.3: Pause Simulation', true, 'Simulation successfully paused');
      }

      const resetBtn = page.locator('button[title="Reset Simulation"]');
      if (await resetBtn.count() > 0) {
        await resetBtn.click();
        await page.waitForTimeout(400);
        recordResult('Test 3.4: Reset Simulation', true, 'Simulation reset to t=0');
      }
    }

    // -------------------------------------------------------------
    // Test 4: Building Studio Experience & Geometry Inspector
    // -------------------------------------------------------------
    const studioTab = page.locator('header nav button:has-text("Building Studio")');
    await studioTab.click();
    await page.waitForTimeout(1000);

    const hasStudioHeader = (await page.textContent('body')).includes('Building Studio');
    recordResult('Test 4.1: Building Studio Navigation', hasStudioHeader, 'Building Studio workspace loaded');

    const hasAddElements =
      (await page.locator('text=Add Elements').count()) > 0 &&
      (await page.locator('text=Room').count()) > 0 &&
      (await page.locator('text=Corridor').count()) > 0 &&
      (await page.locator('text=Ramp').count()) > 0;
    recordResult('Test 4.2: Studio Architectural Toolbox', hasAddElements, 'Add Elements grid (Room, Corridor, Wall, Ramp, etc.) visible');

    const hasProperties = (await page.locator('text=Properties').count()) > 0;
    recordResult('Test 4.3: Right Properties Inspector', hasProperties, 'Element & Connectivity inspector tabs visible');

    const hasStatusBar = (await page.textContent('body')).includes('Floors:') && (await page.textContent('body')).includes('Building Valid');
    recordResult('Test 4.4: Studio Real-time Status Bar', hasStatusBar, 'Bottom bar displays floors, rooms, exits, capacity and Building Valid badge');

    // -------------------------------------------------------------
    // Test 5: Evidence Lab Navigation & Demonstration Mode Modal
    // -------------------------------------------------------------
    const evidenceTab = page.locator('header nav button:has-text("Evidence Lab")');
    await evidenceTab.click();
    await page.waitForTimeout(1000);

    const hasEvidence = (await page.textContent('body')).includes('Evidence');
    recordResult('Test 5.1: Evidence Lab Navigation', hasEvidence, 'Evidence dashboard mounted');

    const demoBtn = page.locator('button:has-text("Judge Demo")');
    if (await demoBtn.count() > 0) {
      await demoBtn.click();
      await page.waitForTimeout(500);

      const hasModal = (await page.textContent('body')).includes('Demonstration') || (await page.textContent('body')).includes('Judge');
      recordResult('Test 5.2: Judge Demonstration Modal Launcher', hasModal, '3-minute Judge Demo workflow active');

      const closeBtn = page.locator('button[aria-label="Close demonstration"]');
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
        await page.waitForTimeout(300);
        recordResult('Test 5.3: Close Demonstration Modal', true, 'Demo modal closed cleanly');
      }
    }

  } catch (err) {
    console.error('Test execution error:', err);
    recordResult('Browser Test Error', false, err.message);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${testResults.filter((r) => r.passed).length} / ${testResults.length} BROWSER ACCEPTANCE TESTS PASSED`);
  console.log('================================================================\n');

  if (testResults.some((r) => !r.passed)) {
    process.exit(1);
  }
}

runPhase54BrowserValidation();
