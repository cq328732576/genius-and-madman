import { test, expect } from '@playwright/test';

test('调试吸附', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'log' || msg.type() === 'error') {
      console.log(`[BROWSER ${msg.type()}]`, msg.text());
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => {
    return window.__GAME__ && window.__TEST_API__ && 
           window.__GAME__.scene.scenes[0] && 
           window.__GAME__.scene.scenes[0].sys.isActive();
  }, { timeout: 15000 });
  await page.waitForTimeout(3000);

  console.log('\n=== 设置场景 ===');
  await page.evaluate(() => {
    const scene = window.__GAME__.scene.scenes[0] as any;
    const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
    if (anchor) scene.createAnchorSprite(anchor);
    scene.madman.setPosition(785, 768);
    scene.dashCooldown = 0;
    console.log('Setup: madman at', scene.madman.x, scene.madman.y, 'anchor at', anchor?.position);
  });
  
  await page.waitForTimeout(500);
  
  console.log('\n=== 触发冲刺（不延长）===');
  await page.evaluate(() => {
    window.__TEST_API__.setHoldDash(false);
    window.__TEST_API__.triggerDash('right');
  });
  
  // 立即检查状态
  let state = await page.evaluate(() => window.__TEST_API__.getState());
  console.log('\n=== 冲刺后立即状态 ===');
  console.log('isSnapped:', state.isSnapped, 'madmanX:', state.madmanX, 'aimWindowTimer:', state.aimWindowTimer);
  expect(state.isSnapped).toBe(true);
  
  // 步进 200ms（< 280ms）
  await page.evaluate(() => window.__TEST_API__.step(200));
  state = await page.evaluate(() => window.__TEST_API__.getState());
  console.log('\n=== 200ms后 ===');
  console.log('isSnapped:', state.isSnapped, 'aimWindowTimer:', state.aimWindowTimer);
  expect(state.isSnapped).toBe(true);
  
  // 步进到 300ms（> 280ms）
  await page.evaluate(() => window.__TEST_API__.step(100));
  state = await page.evaluate(() => window.__TEST_API__.getState());
  console.log('\n=== 300ms后（应释放）===');
  console.log('isSnapped:', state.isSnapped, 'aimWindowTimer:', state.aimWindowTimer);
  expect(state.isSnapped).toBe(false);
  
  await page.screenshot({ path: 'docs/evidence/snap-test-working.png' });
});
