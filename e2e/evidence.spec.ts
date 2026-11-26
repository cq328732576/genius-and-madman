/**
 * Phase 1 验收证据生成
 * 使用测试钩子 API 驱动游戏状态，确保每个截图显示正确的场景
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 1 验收证据', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    
    // 等待游戏初始化
    await page.waitForFunction(() => {
      return window.__GAME__ && window.__TEST_API__ && 
             window.__GAME__.scene.scenes[0] && 
             window.__GAME__.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    
    // 额外等待确保渲染完成
    await page.waitForTimeout(2000);
  });

  test('证据 1: 有效放置', async ({ page }) => {
    // 放置锚点在地面
    const placed = await page.evaluate(() => {
      return window.__TEST_API__.placeAnchor(500, 800);
    });
    expect(placed).toBe(true);
    
    await page.waitForTimeout(500);
    
    // 验证 HUD 显示 1/2
    const hudText = await page.locator('text=/锚点数.*1\\/2/').isVisible();
    expect(hudText).toBe(true);
    
    // 验证锚点数
    const anchorCount = await page.evaluate(() => {
      return window.__TEST_API__.getAnchors().length;
    });
    expect(anchorCount).toBe(1);
    
    await page.screenshot({
      path: 'docs/evidence/01-valid-placement.png',
      fullPage: false,
    });
  });

  test('证据 2: 禁止放置（空中）', async ({ page }) => {
    // 瞄准空中位置
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'docs/evidence/02-forbidden-placement.png',
    });

    await page.mouse.up();
  });

  test('证据 3a: FIFO 替换（放置前）', async ({ page }) => {
    // 放置 2 个锚点
    await page.evaluate(() => {
      window.__TEST_API__.placeAnchor(400, 800);
      window.__TEST_API__.placeAnchor(900, 800);
    });
    
    await page.waitForTimeout(800);
    
    // 验证 HUD 2/2
    const hudText = await page.locator('text=/锚点数.*2\\/2/').isVisible();
    expect(hudText).toBe(true);
    
    await page.screenshot({
      path: 'docs/evidence/03a-fifo-before.png',
    });
  });

  test('证据 3b: FIFO 替换（放置第 3 个后）', async ({ page }) => {
    // 放置 3 个锚点
    await page.evaluate(() => {
      window.__TEST_API__.placeAnchor(300, 800);
      window.__TEST_API__.placeAnchor(600, 800);
      window.__TEST_API__.placeAnchor(900, 800);
    });
    
    await page.waitForTimeout(1000);
    
    // 验证仍然只有 2 个
    const anchorCount = await page.evaluate(() => {
      return window.__TEST_API__.getAnchors().length;
    });
    expect(anchorCount).toBe(2);
    
    // 验证 HUD 2/2
    const hudText = await page.locator('text=/锚点数.*2\\/2/').isVisible();
    expect(hudText).toBe(true);
    
    await page.screenshot({
      path: 'docs/evidence/03b-fifo-after.png',
    });
  });

  test('证据 4: 锁定锚点不可替换', async ({ page }) => {
    // 放置 2 个锚点
    await page.evaluate(() => {
      window.__TEST_API__.placeAnchor(500, 800);
      window.__TEST_API__.placeAnchor(900, 800);
    });
    
    await page.waitForTimeout(500);
    
    // 锁定第一个锚点
    await page.evaluate(() => {
      window.__TEST_API__.lockAnchor(0);
    });
    
    await page.waitForTimeout(500);
    
    // 瞄准第 3 个位置（应该显示"使用中"）
    await page.mouse.move(1200, 800);
    await page.mouse.down();
    await page.waitForTimeout(800);
    
    await page.screenshot({
      path: 'docs/evidence/04-locked-hint.png',
    });
    
    await page.mouse.up();
  });

  test('证据 5: 吸附成功', async ({ page }) => {
    // 放置锚点
    await page.evaluate(() => {
      window.__TEST_API__.placeAnchor(900, 800);
      window.__TEST_API__.setMadmanPosition(400, 550);
    });
    
    await page.waitForTimeout(500);
    
    // 模拟冲刺吸附
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    
    // 验证吸附状态
    const isSnapped = await page.evaluate(() => {
      return window.__TEST_API__.isSnapped();
    });
    expect(isSnapped).toBe(true);
    
    // 验证 HUD "是否吸附: 是"
    const hudText = await page.locator('text=/是否吸附.*是/').isVisible();
    expect(hudText).toBe(true);
    
    await page.screenshot({
      path: 'docs/evidence/05-snap-success.png',
    });
    
    await page.keyboard.up('Shift');
  });

  test('证据 6a: 瞄准窗口（基础）', async ({ page }) => {
    // 放置锚点并吸附
    await page.evaluate(() => {
      window.__TEST_API__.placeAnchor(900, 800);
      window.__TEST_API__.snapToAnchor(0);
      window.__TEST_API__.setMadmanPosition(900 - 20, 800 - 20);
    });
    
    await page.waitForTimeout(200);
    await page.keyboard.down('Shift');
    await page.waitForTimeout(100);
    
    // 验证瞄准窗口计时器
    const timer = await page.evaluate(() => {
      return window.__TEST_API__.getAimWindowTimer();
    });
    expect(timer).toBeGreaterThan(0);
    expect(timer).toBeLessThan(0.28);
    
    await page.screenshot({
      path: 'docs/evidence/06a-aim-window-base.png',
    });
    
    await page.keyboard.up('Shift');
  });

  test('证据 6b: 瞄准窗口（延长）', async ({ page }) => {
    // 放置锚点并吸附
    await page.evaluate(() => {
      window.__TEST_API__.placeAnchor(900, 800);
      window.__TEST_API__.snapToAnchor(0);
      window.__TEST_API__.setMadmanPosition(900 - 20, 800 - 20);
    });
    
    await page.waitForTimeout(200);
    await page.keyboard.down('Shift');
    await page.waitForTimeout(400); // 延长到 0.4s
    
    // 验证瞄准窗口计时器接近 0.4s
    const timer = await page.evaluate(() => {
      return window.__TEST_API__.getAimWindowTimer();
    });
    expect(timer).toBeGreaterThan(0.35);
    
    await page.screenshot({
      path: 'docs/evidence/06b-aim-window-extended.png',
    });
    
    await page.keyboard.up('Shift');
  });

  test('证据 7: 未吸附短冲刺', async ({ page }) => {
    // 不放置锚点，直接冲刺
    await page.evaluate(() => {
      window.__TEST_API__.setMadmanPosition(400, 550);
    });
    
    await page.waitForTimeout(500);
    
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.up('Shift');
    
    await page.waitForTimeout(1000);
    
    // 验证 HUD "是否吸附: 否"
    const hudText = await page.locator('text=/是否吸附.*否/').isVisible();
    expect(hudText).toBe(true);
    
    await page.screenshot({
      path: 'docs/evidence/07-miss-short-dash.png',
    });
  });
});
