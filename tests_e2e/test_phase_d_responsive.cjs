const { chromium } = require('../frontend/node_modules/playwright');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/evidence_screenshots');

const viewports = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

(async () => {
  console.log('--- STARTING PHASE D: RESPONSIVE & ACCESSIBILITY QA ---');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  for (const vp of viewports) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.width < 768,
      hasTouch: vp.width < 1024,
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Simulation Viewport Check
    const svgCount = await page.locator('svg').count();
    assert(svgCount > 0, `Floor SVG missing on ${vp.name}`);

    // Check header
    const headerVisible = await page.locator('header').isVisible();
    assert(headerVisible, `Header not visible on ${vp.name}`);

    // Capture Simulation view
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `d_responsive_${vp.name}_sim.png`) });

    // 2. Demonstration HUD Check on this viewport
    console.log(`  Opening Demonstration Mode on ${vp.name}...`);
    // On small mobile, demo button might be in menu or header
    const demoBtn = page.locator('button:has-text("Interactive Demo"), button:has-text("Interactive Demonstration")').first();
    if (await demoBtn.isVisible()) {
      await demoBtn.click();
      await page.waitForTimeout(800);
      const hudVisible = await page.locator('div[role="region"][aria-label="Judge Demonstration Walkthrough"]').isVisible();
      assert(hudVisible, `Demonstration HUD not visible on ${vp.name}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `d_responsive_${vp.name}_hud.png`) });

      // Close HUD
      const closeBtn = page.locator('button[aria-label="Close demonstration"], button[title="Close demonstration"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
    }

    // 3. Evidence Lab Check on this viewport
    console.log(`  Checking Evidence Lab on ${vp.name}...`);
    const evidenceTabBtn = page.locator('nav[aria-label="Primary views"] button:has-text("Evidence Dashboard")');
    if (await evidenceTabBtn.isVisible()) {
      await evidenceTabBtn.click();
      await page.waitForTimeout(1200);

      const evidenceHeaderVisible = await page.locator('h2:has-text("Reproducible Evidence Lab")').isVisible();
      assert(evidenceHeaderVisible, `Evidence Lab not visible on ${vp.name}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `d_responsive_${vp.name}_evidence.png`) });
    }

    // 4. Accessibility Checks
    console.log(`  Auditing accessibility semantics on ${vp.name}...`);
    // Check main landmarks
    const headerCount = await page.locator('header').count();
    const mainCount = await page.locator('main').count();
    assert(headerCount >= 1, 'Missing <header> landmark');
    assert(mainCount >= 1, 'Missing <main> landmark');

    // Check form labels / aria-labels
    const selectsWithoutAria = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      return selects.filter(s => !s.getAttribute('aria-label') && !s.labels?.length).length;
    });
    console.log(`  Select elements without accessible label on ${vp.name}: ${selectsWithoutAria}`);

    // Check keyboard tab navigation
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement ? document.activeElement.tagName : 'NONE');
    console.log(`  Initial tab focus landed on: <${focusedTag}>`);

    assert.strictEqual(consoleErrors.length, 0, `Console errors on ${vp.name}: ${consoleErrors.join(', ')}`);
    console.log(`✅ Viewport ${vp.name} passed.`);
    await context.close();
  }

  await browser.close();
  console.log('\n--- PHASE D RESPONSIVE & ACCESSIBILITY QA COMPLETED SUCCESSFULLY ---');
})().catch((err) => {
  console.error('❌ Phase D test failed:', err);
  process.exit(1);
});
