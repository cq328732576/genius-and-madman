const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 监听控制台日志
  page.on('console', msg => {
    console.log('[BROWSER]', msg.text());
  });
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => {
    const scene = window.__GAME__.scene.scenes[0];
    const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
    if (anchor) scene.createAnchorSprite(anchor);
    scene.madman.setPosition(785, 768);
    scene.dashCooldown = 0;
    console.log('Setup complete, madman at', scene.madman.x, scene.madman.y);
  });
  
  await page.waitForTimeout(500);
  
  console.log('\n=== 触发冲刺 ===');
  await page.evaluate(() => {
    window.__TEST_API__.setHoldDash(false);
    window.__TEST_API__.triggerDash('right');
    window.__TEST_API__.step(100);
  });
  
  await page.waitForTimeout(1000);
  
  const state = await page.evaluate(() => window.__TEST_API__.getState());
  console.log('\n=== 最终状态 ===');
  console.log(JSON.stringify(state, null, 2));
  
  await browser.close();
})();
