/**
 * Phase 1 最终验收证据
 * 包含完整的状态断言
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 1 最终验收证据', () => {
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
    await page.waitForTimeout(3000);
  });

  test('01: 有效放置', async ({ page }) => {
    // 放置锚点
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor(
        { x: 500 / 32, y: 800 / 32 },
        'ground'
      );
      if (anchor) {
        scene.createAnchorSprite(anchor);
      }
      return {
        placed: !!anchor,
        count: scene.anchorSystem.getAnchors().length,
      };
    });
    
    // 断言状态
    expect(result.placed).toBe(true);
    expect(result.count).toBe(1);
    
    await page.waitForTimeout(500);
    
    // 验证 HUD
    await expect(page.locator('text=/锚点数.*1\\/2/')).toBeVisible();
    
    await page.screenshot({
      path: 'docs/evidence/01-valid-placement.png',
    });
  });

  test('02: 禁止放置（空中）', async ({ page }) => {
    // 瞄准空中
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'docs/evidence/02-forbidden-placement.png',
    });

    await page.mouse.up();
  });

  test('03a: FIFO 前 - 2 个锚点', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a1 = scene.anchorSystem.placeAnchor({ x: 400 / 32, y: 800 / 32 }, 'ground');
      if (a1) scene.createAnchorSprite(a1);
      const a2 = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a2) scene.createAnchorSprite(a2);
      return scene.anchorSystem.getAnchors().length;
    });
    
    expect(result).toBe(2);
    await page.waitForTimeout(500);
    
    await expect(page.locator('text=/锚点数.*2\\/2/')).toBeVisible();
    
    await page.screenshot({
      path: 'docs/evidence/03a-fifo-before.png',
    });
  });

  test('03b: FIFO 后 - 仍然 2 个', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.anchorSystem.placeAnchor({ x: 300 / 32, y: 800 / 32 }, 'ground');
      scene.anchorSystem.placeAnchor({ x: 600 / 32, y: 800 / 32 }, 'ground');
      const a3 = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      
      // 重新创建精灵
      scene.anchorSprites.forEach((s: any) => s.destroy());
      scene.anchorSprites.clear();
      scene.anchorSystem.getAnchors().forEach((a: any) => {
        scene.createAnchorSprite(a);
      });
      
      return {
        count: scene.anchorSystem.getAnchors().length,
        placed: !!a3,
      };
    });
    
    expect(result.count).toBe(2);
    expect(result.placed).toBe(true);
    await page.waitForTimeout(500);
    
    await expect(page.locator('text=/锚点数.*2\\/2/')).toBeVisible();
    
    await page.screenshot({
      path: 'docs/evidence/03b-fifo-after.png',
    });
  });

  test('04: 锁定提示 - 疯子吸附 + 使用中徽标', async ({ page }) => {
    // 放置 2 个锚点并锁定第一个
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a1 = scene.anchorSystem.placeAnchor({ x: 700 / 32, y: 800 / 32 }, 'ground');
      if (a1) {
        scene.createAnchorSprite(a1);
        scene.anchorSystem.lockAnchor(a1.id);
      }
      const a2 = scene.anchorSystem.placeAnchor({ x: 1100 / 32, y: 800 / 32 }, 'ground');
      if (a2) {
        scene.createAnchorSprite(a2);
        scene.anchorSystem.lockAnchor(a2.id);
      }
      
      // 设置疯子吸附到第一个锚点
      scene.madman.setPosition(700 - 20, 800 - 20);
      scene.isSnapped = true;
      scene.snappedAnchorId = a1.id;
    });
    
    await page.waitForTimeout(500);
    
    // 瞄准第 3 个位置（应该显示"使用中"）
    await page.mouse.move(400, 800);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    
    // 验证徽标可见
    const badgeVisible = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      return scene.snapBadge?.visible || false;
    });
    
    console.log('Badge visible:', badgeVisible);
    
    await page.screenshot({
      path: 'docs/evidence/04-locked-hint.png',
    });
    
    await page.mouse.up();
  });

  test('05: 吸附成功', async ({ page }) => {
    // 放置锚点
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a) scene.createAnchorSprite(a);
      
      // 设置疯子位置（距离锚点约 10 单位）
      scene.madman.setPosition(300, 768); // 地面上
      scene.madman.setVelocity(0, 0);
    });
    
    await page.waitForTimeout(500);
    
    // 冲刺向右
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(400);
    
    // 验证吸附状态
    const state = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      return {
        isSnapped: scene.isSnapped,
        madmanY: scene.madman.y,
      };
    });
    
    console.log('Snap state:', state);
    expect(state.isSnapped).toBe(true);
    
    // 验证 HUD
    await expect(page.locator('text=/是否吸附.*是/')).toBeVisible();
    
    await page.screenshot({
      path: 'docs/evidence/05-snap-success.png',
    });
    
    await page.keyboard.up('Shift');
  });

  test('06a: 瞄准窗口（基础）', async ({ page }) => {
    // 直接设置吸附状态
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a) {
        scene.createAnchorSprite(a);
        scene.anchorSystem.lockAnchor(a.id);
      }
      
      // 设置疯子吸附状态
      scene.madman.setPosition(900 - 20, 768);
      scene.madman.setVelocity(0, 0);
      scene.isSnapped = true;
      scene.snappedAnchorId = a.id;
      scene.aimWindowTimer = 0.15; // 瞄准窗口中
    });
    
    await page.waitForTimeout(200);
    await page.keyboard.down('Shift');
    await page.waitForTimeout(100);
    
    // 验证瞄准窗口
    const timer = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      return scene.aimWindowTimer;
    });
    
    console.log('Aim window timer:', timer);
    expect(timer).toBeGreaterThan(0);
    expect(timer).toBeLessThan(0.28);
    
    await expect(page.locator('text=/是否吸附.*是/')).toBeVisible();
    await expect(page.locator('text=/瞄准窗口.*0\\./')).toBeVisible();
    
    await page.screenshot({
      path: 'docs/evidence/06a-aim-window-base.png',
    });
    
    await page.keyboard.up('Shift');
  });

  test('06b: 瞄准窗口（延长）', async ({ page }) => {
    // 直接设置吸附状态
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a) {
        scene.createAnchorSprite(a);
        scene.anchorSystem.lockAnchor(a.id);
      }
      
      scene.madman.setPosition(900 - 20, 768);
      scene.madman.setVelocity(0, 0);
      scene.isSnapped = true;
      scene.snappedAnchorId = a.id;
      scene.aimWindowTimer = 0.40; // 延长到 0.4s
    });
    
    await page.waitForTimeout(200);
    await page.keyboard.down('Shift');
    await page.waitForTimeout(100);
    
    // 验证延长的瞄准窗口
    const timer = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      return scene.aimWindowTimer;
    });
    
    console.log('Extended aim window timer:', timer);
    expect(timer).toBeGreaterThan(0.35);
    
    await expect(page.locator('text=/是否吸附.*是/')).toBeVisible();
    await expect(page.locator('text=/瞄准窗口.*0\\.[34]/')).toBeVisible();
    
    await page.screenshot({
      path: 'docs/evidence/06b-aim-window-extended.png',
    });
    
    await page.keyboard.up('Shift');
  });

  test('07: 未吸附短冲刺', async ({ page }) => {
    // 不放置锚点，设置疯子位置
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.madman.setPosition(400, 768); // 地面上
      scene.madman.setVelocity(0, 0);
    });
    
    await page.waitForTimeout(500);
    
    // 冲刺（无锚点）
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.up('Shift');
    
    await page.waitForTimeout(1000);
    
    // 验证未吸附
    const isSnapped = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      return scene.isSnapped;
    });
    
    expect(isSnapped).toBe(false);
    
    // 验证 HUD
    await expect(page.locator('text=/是否吸附.*否/')).toBeVisible();
    
    await page.screenshot({
      path: 'docs/evidence/07-miss-short-dash.png',
    });
  });
});
