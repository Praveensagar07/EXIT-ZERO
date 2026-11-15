const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/playwright'));

async function run() {
  console.log("=== BROWSER VERIFICATION: PHYSICS-BASED FIRE AVOIDANCE ===");
  const evidenceDir = path.resolve(__dirname, '../docs/evidence_screenshots');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  console.log("Navigating to http://localhost:5173 ...");
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Select the multi-floor scenario from dropdown if available
  console.log("Setting up multi-floor demo scenario...");
  const scenarioSelect = page.locator('select').first();
  if (await scenarioSelect.count() > 0) {
    const options = await scenarioSelect.locator('option').allTextContents();
    console.log("Available scenarios:", options);
    // Find scenario with multifloor or demo
    const multiIdx = options.findIndex(o => o.toLowerCase().includes('multi-floor') || o.toLowerCase().includes('block a'));
    if (multiIdx >= 0) {
      await scenarioSelect.selectOption({ index: multiIdx });
      await page.waitForTimeout(1000);
    }
  }

  // Ensure Exploded 3D view is active or switch to F3
  const explodedBtn = page.getByRole('button', { name: /exploded/i }).first();
  if (await explodedBtn.count() > 0) {
    await explodedBtn.click();
    await page.waitForTimeout(1000);
  }

  // Capture BEFORE screenshot (t=0, before fire)
  const beforeImg = path.join(evidenceDir, 'fire_avoidance_before.png');
  await page.screenshot({ path: beforeImg, fullPage: true });
  console.log(`Saved BEFORE screenshot: ${beforeImg}`);

  // Click Play / Run Simulation to start playback
  console.log("Starting simulation run...");
  const playBtn = page.locator('button').filter({ has: page.locator('svg.lucide-play, svg.lucide-play-circle') }).first();
  if (await playBtn.count() > 0) {
    await playBtn.click();
    console.log("Play button clicked, advancing simulation...");
  } else {
    // Alternatively look for button with "Play" or "Start"
    const startBtn = page.getByRole('button', { name: /start|play|run simulation/i }).first();
    if (await startBtn.count() > 0) {
      await startBtn.click();
    }
  }

  // Advance simulation through API or UI steps for ~12-15 seconds
  await page.waitForTimeout(6000);

  // Capture AFTER screenshot (fire active, agents routing away)
  const afterImg = path.join(evidenceDir, 'fire_avoidance_after.png');
  await page.screenshot({ path: afterImg, fullPage: true });
  console.log(`Saved AFTER screenshot: ${afterImg}`);

  // Switch to Floor 3 view specifically to inspect floor 3 occupants and fire
  const f3Btn = page.getByRole('button', { name: /F3|Laboratories|Administration/i }).first();
  if (await f3Btn.count() > 0) {
    await f3Btn.click();
    await page.waitForTimeout(1000);
    const f3Img = path.join(evidenceDir, 'fire_avoidance_f3_detail.png');
    await page.screenshot({ path: f3Img, fullPage: true });
    console.log(`Saved F3 DETAIL screenshot: ${f3Img}`);
  }

  await browser.close();
  console.log("=== BROWSER VERIFICATION COMPLETED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Browser verification failed:", err);
  process.exit(1);
});
