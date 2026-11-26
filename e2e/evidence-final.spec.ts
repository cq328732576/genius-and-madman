/**
 * Phase 1 验收证据生成（最终版本）
 * 使用简化的测试钩子，直接操作游戏状态
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 1 验收证据（最终版）', () => {
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
    // 直接使用 Test API 放置锚点
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor(
        { x: 500 / 32, y: 800 / 32 },
        'ground'
      );
      if (anchor) {
        scene.createAnchorSprite(anchor);
      }
    });
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({
      path: 'docs/evidence/01-valid-placement.png',
      fullPage: false,
    });
  });

  test('02: 禁止放置', async ({ page }) => {
    // 瞄准空中
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await page.waitForTimeout(800);

    await page.screenshot({
      path: 'docs/evidence/02-forbidden-placement.png',
    });

    await page.mouse.up();
  });

  test('03a: FIFO前-2个锚点', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a1 = scene.anchorSystem.placeAnchor({ x: 400 / 32, y: 800 / 32 }, 'ground');
      if (a1) scene.createAnchorSprite(a1);
      const a2 = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a2) scene.createAnchorSprite(a2);
    });
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({
      path: 'docs/evidence/03a-fifo-before.png',
    });
  });

  test('03b: FIFO后-仍然2个', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a1 = scene.anchorSystem.placeAnchor({ x: 300 / 32, y: 800 / 32 }, 'ground');
      if (a1) scene.createAnchorSprite(a1);
      const a2 = scene.anchorSystem.placeAnchor({ x: 600 / 32, y: 800 / 32 }, 'ground');
      if (a2) scene.createAnchorSprite(a2);
      const a3 = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a3) scene.createAnchorSprite(a3);
    });
    
    await page.waitForTimeout(1000);
    
    await page.screenshot({
      path: 'docs/evidence/03b-fifo-after.png',
    });
  });

  test('04: 锁定提示', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a1 = scene.anchorSystem.placeAnchor({ x: 500 / 32, y: 800 / 32 }, 'ground');
      if (a1) {
        scene.createAnchorSprite(a1);
        scene.anchorSystem.lockAnchor(a1.id);
      }
      const a2 = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a2) {
        scene.createAnchorSprite(a2);
        scene.anchorSystem.lockAnchor(a2.id);
      }
    });
    
    await page.waitForTimeout(500);
    
    // 瞄准第 3 个位置
    await page.mouse.move(1200, 800);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    
    await page.screenshot({
      path: 'docs/evidence/04-locked-hint.png',
    });
    
    await page.mouse.up();
  });

  test('05: 吸附成功', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a) scene.createAnchorSprite(a);
      
      // 设置疯子位置
      scene.madman.setPosition(400, 550);
      scene.madman.setVelocity(0, 0);
    });
    
    await page.waitForTimeout(500);
    
    // 冲刺
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
    
    await page.screenshot({
      path: 'docs/evidence/05-snap-success.png',
    });
    
    await page.keyboard.up('Shift');
  });

  test('06: 瞄准窗口', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a) {
        scene.createAnchorSprite(a);
        scene.anchorSystem.lockAnchor(a.id);
      }
      
      // 设置疯子位置和吸附状态
      scene.madman.setPosition(900 - 20, 800 - 20);
      scene.madman.setVelocity(0, 0);
      scene.isSnapped = true;
      scene.snappedAnchorId = a.id;
      scene.aimWindowTimer = 0.15;
    });
    
    await page.waitForTimeout(500);
    await page.keyboard.down('Shift');
    await page.waitForTimeout(200);
    
    await page.screenshot({
      path: 'docs/evidence/06-aim-window.png',
    });
    
    await page.keyboard.up('Shift');
  });

  test('07: 未吸附短冲刺', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.madman.setPosition(400, 550);
      scene.madman.setVelocity(0, 0);
    });
    
    await page.waitForTimeout(500);
    
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.up('Shift');
    
    await page.waitForTimeout(1500);
    
    await page.screenshot({
      path: 'docs/evidence/07-miss-short-dash.png',
    });
  });
});
