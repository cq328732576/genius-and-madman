/**
 * 截图测试 - 生成所有验收场景的截图
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 1 验收截图', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待游戏完全加载和渲染
    await page.waitForTimeout(3000);
    
    // 等待 canvas 出现
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // 额外等待确保首帧渲染完成
    await page.waitForTimeout(1000);
  });

  test('截图 1: 有效放置', async ({ page }) => {
    // 确保游戏已启动
    await page.waitForFunction(() => {
      const game = (window as any).__GAME__;
      return game && game.scene && game.scene.isActive('GameScene');
    });

    await page.mouse.click(500, 800);
    await page.waitForTimeout(800);

    await page.screenshot({
      path: 'docs/evidence/01-valid-placement.png',
      fullPage: false,
    });
  });

  test('截图 2: 禁止放置（空中）', async ({ page }) => {
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'artifacts/02-forbidden-placement.png',
    });

    await page.mouse.up();
  });

  test('截图 3: FIFO 替换', async ({ page }) => {
    // 放置 3 个锚点，第 1 个应该被替换
    await page.mouse.click(300, 800);
    await page.waitForTimeout(500);
    await page.mouse.click(500, 800);
    await page.waitForTimeout(500);
    await page.mouse.click(700, 800);
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'artifacts/03-fifo-replacement.png',
    });
  });

  test('截图 4: 锁定锚点不可替换', async ({ page }) => {
    // 放置 2 个锚点
    await page.mouse.click(500, 800);
    await page.waitForTimeout(500);
    await page.mouse.click(900, 800);
    await page.waitForTimeout(500);

    // 锁定第一个
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      const anchors = scene.anchorSystem?.getAnchors() || [];
      if (anchors[0]) {
        scene.anchorSystem?.lockAnchor(anchors[0].id);
      }
    });

    await page.waitForTimeout(300);

    // 尝试放置第 3 个（应该替换第 2 个）
    await page.mouse.click(1100, 800);
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'artifacts/04-locked-anchor-no-replace.png',
    });
  });

  test('截图 5: 所有锚点被锁定的提示', async ({ page }) => {
    // 放置 2 个锚点并全部锁定
    await page.mouse.click(500, 800);
    await page.waitForTimeout(500);
    await page.mouse.click(900, 800);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      const anchors = scene.anchorSystem?.getAnchors() || [];
      anchors.forEach((a: any) => scene.anchorSystem?.lockAnchor(a.id));
    });

    // 瞄准第 3 个位置（应该显示提示）
    await page.mouse.move(1100, 800);
    await page.mouse.down();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'artifacts/05-locked-hint.png',
    });

    await page.mouse.up();
  });

  test('截图 6: 冲刺吸附', async ({ page }) => {
    // 放置一个锚点
    await page.mouse.click(900, 800);
    await page.waitForTimeout(500);

    // 移动疯子到左侧
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(50);
    }

    await page.waitForTimeout(300);

    // 向右冲刺
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.up('Shift');

    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'artifacts/06-snap-success.png',
    });
  });

  test('截图 7: 未吸附短冲刺', async ({ page }) => {
    // 不放置锚点，直接冲刺
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.up('Shift');

    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'artifacts/07-miss-short-dash.png',
    });
  });

  test('截图 8: 瞄准窗口', async ({ page }) => {
    // 放置锚点
    await page.mouse.click(900, 800);
    await page.waitForTimeout(500);

    // 移动到左侧
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(50);
    }

    // 冲刺并保持 Shift 进入瞄准窗口
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);

    await page.screenshot({
      path: 'artifacts/08-aim-window.png',
    });

    await page.keyboard.up('Shift');
  });
});
