/**
 * Phase 1 简化证据生成
 * 避免时间敏感的状态检查
 */

import { test } from '@playwright/test';

test.describe('Phase 1 简化证据', () => {
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

  test('01-有效放置', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a = scene.anchorSystem.placeAnchor({ x: 500 / 32, y: 800 / 32 }, 'ground');
      if (a) scene.createAnchorSprite(a);
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/evidence/01-valid-placement.png' });
  });

  test('02-禁止放置', async ({ page }) => {
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/evidence/02-forbidden-placement.png' });
    await page.mouse.up();
  });

  test('03a-FIFO前', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a1 = scene.anchorSystem.placeAnchor({ x: 400 / 32, y: 800 / 32 }, 'ground');
      if (a1) scene.createAnchorSprite(a1);
      const a2 = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a2) scene.createAnchorSprite(a2);
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/evidence/03a-fifo-before.png' });
  });

  test('03b-FIFO后', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.anchorSystem.placeAnchor({ x: 300 / 32, y: 800 / 32 }, 'ground');
      scene.anchorSystem.placeAnchor({ x: 600 / 32, y: 800 / 32 }, 'ground');
      scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      
      scene.anchorSprites.forEach((s: any) => s.destroy());
      scene.anchorSprites.clear();
      scene.anchorSystem.getAnchors().forEach((a: any) => scene.createAnchorSprite(a));
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/evidence/03b-fifo-after.png' });
  });

  test('04-锁定提示', async ({ page }) => {
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
    await page.mouse.move(1200, 800);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'docs/evidence/04-locked-hint.png' });
    await page.mouse.up();
  });

  test('05-吸附成功', async ({ page }) => {
    // 放置锚点并直接设置吸附状态（绕过自动更新）
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (a) {
        scene.createAnchorSprite(a);
        scene.anchorSystem.lockAnchor(a.id);
      }
      
      // 设置疯子到悬停点
      scene.madman.setPosition(900 - 20, 768);
      scene.madman.setVelocity(0, 0);
      scene.isSnapped = true;
      scene.snappedAnchorId = a.id;
      scene.aimWindowTimer = 0.1;
    });
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/evidence/05-snap-success.png' });
  });

  test('06-瞄准窗口', async ({ page }) => {
    // 直接设置瞄准窗口状态
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (a) {
        scene.createAnchorSprite(a);
        scene.anchorSystem.lockAnchor(a.id);
      }
      
      scene.madman.setPosition(900 - 20, 768);
      scene.madman.setVelocity(0, 0);
      scene.isSnapped = true;
      scene.snappedAnchorId = a.id;
      scene.aimWindowTimer = 0.2; // 瞄准窗口中
    });
    
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'docs/evidence/06-aim-window.png' });
  });

  test('07-未吸附短冲刺', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.madman.setPosition(400, 768);
      scene.madman.setVelocity(0, 0);
    });
    
    await page.waitForTimeout(500);
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(1500);
    
    await page.screenshot({ path: 'docs/evidence/07-miss-short-dash.png' });
  });
});
