/**
 * 修复的截图测试 - 确保正确渲染
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 1 验收截图（修复版）', () => {
  test.beforeEach(async ({ page }) => {
    // 启用软件渲染避免 GPU 问题
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // 等待 canvas 出现并渲染
    await page.waitForSelector('canvas', { timeout: 15000 });
    
    // 等待游戏初始化
    await page.waitForFunction(() => {
      const game = (window as any).__GAME__;
      return game && game.scene && game.scene.scenes[0] && game.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    
    // 额外等待几帧确保渲染完成
    await page.waitForTimeout(2000);
  });

  test('截图 1: 有效放置', async ({ page }) => {
    // 点击地面放置锚点
    await page.mouse.click(640, 800);
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'docs/evidence/01-valid-placement.png',
      fullPage: false,
    });
    
    // 验证锚点已放置
    const anchors = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      return scene.anchorSystem?.getAnchors().length || 0;
    });
    expect(anchors).toBe(1);
  });

  test('截图 2: 禁止放置（空中）', async ({ page }) => {
    // 瞄准空中位置
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'docs/evidence/02-forbidden-placement.png',
    });

    await page.mouse.up();
  });

  test('截图 3: FIFO 替换', async ({ page }) => {
    // 放置 3 个锚点
    await page.mouse.click(300, 800);
    await page.waitForTimeout(600);
    await page.mouse.click(640, 800);
    await page.waitForTimeout(600);
    await page.mouse.click(900, 800);
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'docs/evidence/03-fifo-replacement.png',
    });
    
    // 验证只有 2 个锚点
    const anchors = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      return scene.anchorSystem?.getAnchors().length || 0;
    });
    expect(anchors).toBe(2);
  });

  test('截图 4: 锁定锚点不可替换', async ({ page }) => {
    // 放置 2 个锚点
    await page.mouse.click(500, 800);
    await page.waitForTimeout(600);
    await page.mouse.click(900, 800);
    await page.waitForTimeout(600);

    // 锁定第一个锚点
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      const anchors = scene.anchorSystem?.getAnchors() || [];
      if (anchors[0]) {
        scene.anchorSystem?.lockAnchor(anchors[0].id);
      }
    });

    await page.waitForTimeout(400);

    // 尝试放置第 3 个锚点
    await page.mouse.click(1200, 800);
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'docs/evidence/04-locked-anchor-no-replace.png',
    });
  });

  test('截图 5: 所有锚点被锁定的提示', async ({ page }) => {
    // 放置 2 个锚点并全部锁定
    await page.mouse.click(500, 800);
    await page.waitForTimeout(600);
    await page.mouse.click(900, 800);
    await page.waitForTimeout(600);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      const anchors = scene.anchorSystem?.getAnchors() || [];
      anchors.forEach((a: any) => scene.anchorSystem?.lockAnchor(a.id));
    });

    await page.waitForTimeout(400);

    // 瞄准第 3 个位置（应该显示"使用中"提示）
    await page.mouse.move(1200, 800);
    await page.mouse.down();
    await page.waitForTimeout(800);

    await page.screenshot({
      path: 'docs/evidence/05-locked-hint.png',
    });

    await page.mouse.up();
  });

  test('截图 6: 冲刺吸附', async ({ page }) => {
    // 放置一个锚点
    await page.mouse.click(900, 800);
    await page.waitForTimeout(800);

    // 移动疯子到左侧
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(40);
    }

    await page.waitForTimeout(500);

    // 向右冲刺吸附
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.up('Shift');

    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'docs/evidence/06-snap-success.png',
    });
  });

  test('截图 7: 未吸附短冲刺', async ({ page }) => {
    // 不放置锚点，直接冲刺
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    await page.keyboard.up('Shift');

    await page.waitForTimeout(1500);

    await page.screenshot({
      path: 'docs/evidence/07-miss-short-dash.png',
    });
  });

  test('截图 8: 瞄准窗口', async ({ page }) => {
    // 放置锚点
    await page.mouse.click(900, 800);
    await page.waitForTimeout(800);

    // 移动到左侧
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(40);
    }

    await page.waitForTimeout(500);

    // 冲刺并保持 Shift 进入瞄准窗口
    await page.keyboard.down('Shift');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'docs/evidence/08-aim-window.png',
    });

    await page.keyboard.up('Shift');
  });
});
