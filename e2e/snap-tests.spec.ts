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
    // 设置：锚点在900px，悬停点在880.8px，疯子在785px（3u距离）
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
      window.__TEST_API__.step(100);
    });
    
    // 步进0.2s，应该仍然吸附
    await page.evaluate(() => {
      window.__TEST_API__.step(200);
    });
    
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('After 0.2s:', state);
    
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0.19);
    expect(state.aimWindowTimer).toBeLessThan(0.22);
    
    // 验证位置在悬停点
    const hoverX = 900 - 0.6 * 32;
    expect(Math.abs(state.madmanX - hoverX)).toBeLessThan(2);
    
    // 步进到0.30s（超过0.28s基础窗口）
    await page.evaluate(() => {
      window.__TEST_API__.step(100);
    });
    
    state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('After 0.30s (should release):', state);
    
    expect(state.isSnapped).toBe(false);
    
    await page.screenshot({ path: 'docs/evidence/06a-aim-window-base.png' });
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
      window.__TEST_API__.step(100);
    });
    
    // 步进0.45s，应该仍然吸附（因为按住）
    await page.evaluate(() => {
      window.__TEST_API__.step(450);
    });
    
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('After 0.45s (held):', state);
    
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0.44);
    expect(state.aimWindowTimer).toBeLessThan(0.47);
    
    // 步进到0.52s（超过0.50s最大窗口）
    await page.evaluate(() => {
      window.__TEST_API__.step(70);
    });
    
    state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('After 0.52s (should release):', state);
    
    expect(state.isSnapped).toBe(false);
    
    await page.screenshot({ path: 'docs/evidence/06b-aim-window-extended.png' });
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
      window.__TEST_API__.step(100);
    });
    
    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('Snap success state:', state);
    
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0);
    
    // 验证悬停点位置
    const hoverX = 900 - 0.6 * 32;
    expect(Math.abs(state.madmanX - hoverX)).toBeLessThan(2);
    
    await page.screenshot({ path: 'docs/evidence/05-snap-success.png' });
  });

  test('04-锁定提示（使用中徽标）', async ({ page }) => {
    // 放置锚点A，疯子吸附到A
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
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });
    
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('After snap to A:', state);
    expect(state.isSnapped).toBe(true);
    
    // 疯子吸附时，尝试放置第3个锚点（会触发FIFO，但A被锁定）
    await page.mouse.move(1200, 768);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    
    state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('After 3rd placement attempt:', state);
    
    // 验证：仍然吸附，锚点未变，徽标显示
    expect(state.isSnapped).toBe(true);
    expect(state.badgeVisible).toBe(true);
    expect(state.badgeTexture).toBe('snap_badge_inuse_zh_g');
    
    await page.screenshot({ path: 'docs/evidence/04-locked-hint.png' });
    
    await page.mouse.up();
  });
});
