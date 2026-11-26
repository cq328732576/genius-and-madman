/**
 * Phase 1 真实游戏流程测试
 * 使用真实的游戏方法和帧步进
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 1 真实游戏流程', () => {
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

  test('05-吸附成功：真实冲刺流程', async ({ page }) => {
    // 设置场景：放置锚点在 x=900px（28.125u），疯子在 x=600px（18.75u）
    // 距离约 9.375u > 吸附半径 2.0u，冲刺应该能吸附
    const setup = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 放置锚点
      const anchor = scene.anchorSystem.placeAnchor(
        { x: 900 / 32, y: 768 / 32 }, // 地面上方
        'ground'
      );
      if (anchor) scene.createAnchorSprite(anchor);
      
      // 设置疯子位置（距离约 300px = 9.375u）
      scene.madman.setPosition(600, 768);
      scene.madman.setVelocity(0, 0);
      scene.dashCooldown = 0;
      
      return { anchorPlaced: !!anchor, anchorX: anchor?.position.x };
    });
    
    console.log('Setup:', setup);
    expect(setup.anchorPlaced).toBe(true);
    
    // 触发向右冲刺
    await page.evaluate(() => {
      window.__TEST_API__.triggerDash('right');
    });
    
    // 步进帧让吸附发生
    await page.evaluate(() => {
      window.__TEST_API__.step(100); // 100ms 步进
    });
    
    // 等待一下让视觉更新
    await page.waitForTimeout(200);
    
    // 验证吸附状态
    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('After dash state:', state);
    
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0);
    expect(state.aimWindowTimer).toBeLessThanOrEqual(0.28);
    
    // 疯子应该在悬停点（锚点外 0.6u）
    const expectedHoverX = 900 - 0.6 * 32; // 锚点 - 悬停偏移
    expect(state.madmanX).toBeGreaterThan(expectedHoverX - 10);
    expect(state.madmanX).toBeLessThan(expectedHoverX + 10);
    
    await page.screenshot({ path: 'docs/evidence/05-snap-success.png' });
  });

  test('06a-瞄准窗口：基础时间', async ({ page }) => {
    // 设置吸附状态
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (anchor) scene.createAnchorSprite(anchor);
      scene.madman.setPosition(600, 768);
      scene.dashCooldown = 0;
    });
    
    // 触发冲刺
    await page.evaluate(() => {
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });
    
    await page.waitForTimeout(100);
    
    // 验证吸附
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    
    // 步进到瞄准窗口中间（约 0.15s）
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.shiftKey.isDown = true; // 保持 Shift
      window.__TEST_API__.step(150);
    });
    
    await page.waitForTimeout(100);
    
    // 验证瞄准窗口
    state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('Aim window state:', state);
    
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0.10);
    expect(state.aimWindowTimer).toBeLessThan(0.28);
    
    await page.screenshot({ path: 'docs/evidence/06a-aim-window-base.png' });
  });

  test('06b-瞄准窗口：延长到上限', async ({ page }) => {
    // 设置吸附状态
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (anchor) scene.createAnchorSprite(anchor);
      scene.madman.setPosition(600, 768);
      scene.dashCooldown = 0;
    });
    
    // 触发冲刺
    await page.evaluate(() => {
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });
    
    await page.waitForTimeout(100);
    
    // 保持 Shift 步进到接近上限
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.shiftKey.isDown = true;
      window.__TEST_API__.step(400); // 步进 400ms
    });
    
    await page.waitForTimeout(100);
    
    // 验证延长的瞄准窗口
    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('Extended aim window state:', state);
    
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0.35);
    expect(state.aimWindowTimer).toBeLessThanOrEqual(0.50);
    
    await page.screenshot({ path: 'docs/evidence/06b-aim-window-extended.png' });
  });

  test('07-未吸附：短冲刺 + 徽标', async ({ page }) => {
    // 不放置锚点，直接冲刺
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.madman.setPosition(400, 768);
      scene.madman.setVelocity(0, 0);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    // 记录初始位置
    const initialState = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('Initial position:', initialState.madmanX);
    
    // 触发冲刺
    await page.evaluate(() => {
      window.__TEST_API__.triggerDash('right');
    });
    
    // 步进让短冲刺完成
    await page.evaluate(() => {
      window.__TEST_API__.step(500); // 500ms
    });
    
    await page.waitForTimeout(300);
    
    // 验证状态
    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('After miss state:', state);
    
    expect(state.isSnapped).toBe(false);
    
    // 验证移动距离约 4.0u = 128px
    const distance = state.madmanX - initialState.madmanX;
    console.log('Distance travelled:', distance, 'px (expected ~128px)');
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(200);
    
    // 验证"未吸附"徽标
    expect(state.badgeVisible).toBe(true);
    expect(state.badgeTexture).toBe('snap_badge_miss_zh_m');
    
    await page.screenshot({ path: 'docs/evidence/07-miss-short-dash.png' });
  });

  test('04-锁定提示：使用中徽标', async ({ page }) => {
    // 放置两个锚点并锁定它们
    const setup = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      const a1 = scene.anchorSystem.placeAnchor({ x: 500 / 32, y: 768 / 32 }, 'ground');
      if (a1) {
        scene.createAnchorSprite(a1);
        scene.anchorSystem.lockAnchor(a1.id);
      }
      
      const a2 = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (a2) {
        scene.createAnchorSprite(a2);
        scene.anchorSystem.lockAnchor(a2.id);
      }
      
      // 设置疯子吸附到第一个锚点
      scene.madman.setPosition(500 - 20, 768);
      scene.isSnapped = true;
      scene.snappedAnchorId = a1.id;
      
      return { a1Locked: !!a1, a2Locked: !!a2 };
    });
    
    console.log('Setup:', setup);
    expect(setup.a1Locked).toBe(true);
    expect(setup.a2Locked).toBe(true);
    
    await page.waitForTimeout(200);
    
    // 瞄准第 3 个位置（天才尝试放置）
    await page.mouse.move(1200, 768);
    await page.mouse.down();
    await page.waitForTimeout(500);
    
    // 验证徽标
    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('Locked hint state:', state);
    
    expect(state.anchorsCount).toBe(2); // 仍然是 2 个
    expect(state.badgeVisible).toBe(true);
    expect(state.badgeTexture).toBe('snap_badge_inuse_zh_g');
    
    await page.screenshot({ path: 'docs/evidence/04-locked-hint.png' });
    
    await page.mouse.up();
  });
});
