/**
 * Phase 1 吸附测试 - 核心验收标准3
 */
import { test, expect } from '@playwright/test';

test.describe('Phase 1 吸附测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(() => {
      return window.__GAME__ && window.__TEST_API__ && 
             window.__GAME__.scene.scenes[0] && 
             window.__GAME__.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('测试A: 基础瞄准窗口 (0.28s)', async ({ page }) => {
    // 设置：锚点，疯子在3u距离
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (anchor) scene.createAnchorSprite(anchor);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    // 触发冲刺（不按住）
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
    });
    
    // 立即检查吸附
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    
    // 验证位置在悬停点
    const hoverX = 900 - 0.6 * 32;
    expect(Math.abs(state.madmanX - hoverX)).toBeLessThan(2);
    
    // 步进0.2s
    await page.evaluate(() => window.__TEST_API__.step(200));
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0.19);
    expect(state.aimWindowTimer).toBeLessThan(0.22);
    
    await page.screenshot({ path: 'docs/evidence/06a-aim-window-base.png' });
    
    // 步进到0.30s（超过0.28s基础窗口）
    await page.evaluate(() => window.__TEST_API__.step(100));
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(false);
  });

  test('测试B: 延长瞄准窗口 (0.50s)', async ({ page }) => {
    // 设置
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (anchor) scene.createAnchorSprite(anchor);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    // 触发冲刺并按住
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
    });
    
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    
    // 步进0.45s，应该仍然吸附（因为按住）
    await page.evaluate(() => window.__TEST_API__.step(450));
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0.44);
    expect(state.aimWindowTimer).toBeLessThan(0.47);
    
    await page.screenshot({ path: 'docs/evidence/06b-aim-window-extended.png' });
    
    // 步进到0.52s（超过0.50s最大窗口）
    await page.evaluate(() => window.__TEST_API__.step(70));
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(false);
  });

  test('05-吸附成功', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (anchor) scene.createAnchorSprite(anchor);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
    });
    
    const state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0);
    
    // 验证悬停点位置
    const hoverX = 900 - 0.6 * 32;
    expect(Math.abs(state.madmanX - hoverX)).toBeLessThan(2);
    
    await page.screenshot({ path: 'docs/evidence/05-snap-success.png' });
  });

  test('04-锁定提示（使用中徽标）', async ({ page }) => {
    // 放置锚点A
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchorA = scene.anchorSystem.placeAnchor({ x: 500 / 32, y: 768 / 32 }, 'ground');
      if (anchorA) scene.createAnchorSprite(anchorA);
      scene.madman.setPosition(500 - 0.6 * 32 - 96, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    // 冲刺吸附到锚点A
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(true); // 按住以保持吸附
      window.__TEST_API__.triggerDash('right');
    });
    
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    
    // 疯子吸附时，尝试放置第3个锚点
    await page.mouse.move(1200, 768);
    await page.mouse.down();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: 'docs/evidence/04-locked-hint.png' });
    
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    expect(state.anchorsCount).toBe(1); // A仍然锁定，第3个无法放置
    
    await page.mouse.up();
  });
});
