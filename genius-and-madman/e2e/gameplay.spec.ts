/**
 * 端到端测试：覆盖所有接受条件的游戏场景
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('锚点 vs 爆发 - Phase 1 验收测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待游戏加载
    await page.waitForTimeout(2000);
  });

  test('场景 1: 有效放置 - 锚点落在可附着表面上', async ({ page }) => {
    // 等待游戏完全加载
    await page.waitForTimeout(1000);

    // 在地面上点击放置锚点
    await page.mouse.move(640, 800);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // 截图
    await page.screenshot({
      path: 'genius-and-madman/artifacts/01-valid-placement.png',
      fullPage: false,
    });

    // 验证锚点是否可见
    const anchors = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      return scene.anchorSystem?.getAnchors().length || 0;
    });

    expect(anchors).toBe(1);
  });

  test('场景 2: 禁止放置 - 锚点不能落在空中', async ({ page }) => {
    await page.waitForTimeout(1000);

    // 在空中位置尝试放置
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.waitForTimeout(300);

    // 截图（应该显示禁止指示器）
    await page.screenshot({
      path: 'genius-and-madman/artifacts/02-forbidden-placement.png',
      fullPage: false,
    });

    await page.mouse.up();
    await page.waitForTimeout(200);

    // 验证锚点未被放置
    const anchors = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      return scene.anchorSystem?.getAnchors().length || 0;
    });

    expect(anchors).toBe(0);
  });

  test('场景 3: FIFO 替换 - 第3个锚点替换最旧的', async ({ page }) => {
    // 放置第 1 个锚点
    await page.mouse.click(300, 800);
    await page.waitForTimeout(500);

    // 放置第 2 个锚点
    await page.mouse.click(500, 800);
    await page.waitForTimeout(500);

    // 验证有 2 个锚点
    let anchors = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      return scene.anchorSystem?.getAnchors() || [];
    });
    expect(anchors.length).toBe(2);
    const firstAnchorId = anchors[0].id;

    // 放置第 3 个锚点
    await page.mouse.click(700, 800);
    await page.waitForTimeout(500);

    // 截图
    await page.screenshot({
      path: 'artifacts/03-fifo-replacement.png',
      fullPage: true,
    });

    // 验证仍然只有 2 个锚点，且第 1 个被移除
    anchors = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      return scene.anchorSystem?.getAnchors() || [];
    });
    expect(anchors.length).toBe(2);
    expect(anchors.find((a: any) => a.id === firstAnchorId)).toBeUndefined();
  });

  test('场景 4: 锁定锚点 - 被吸附的锚点不能被替换', async ({ page }) => {
    // 放置 2 个锚点
    await page.mouse.click(500, 800);
    await page.waitForTimeout(500);
    await page.mouse.click(900, 800);
    await page.waitForTimeout(500);

    // 获取锚点ID
    const anchorIds = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      return scene.anchorSystem?.getAnchors().map((a: any) => a.id) || [];
    });

    // 锁定第 1 个锚点（模拟吸附）
    await page.evaluate((id) => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      scene.anchorSystem?.lockAnchor(id);
    }, anchorIds[0]);

    await page.waitForTimeout(300);

    // 尝试放置第 3 个锚点
    await page.mouse.click(1100, 800);
    await page.waitForTimeout(500);

    // 截图
    await page.screenshot({
      path: 'artifacts/04-locked-anchor.png',
      fullPage: true,
    });

    // 验证第 2 个锚点被替换，第 1 个（被锁定）仍在
    const remainingAnchors = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      return scene.anchorSystem?.getAnchors().map((a: any) => a.id) || [];
    });

    expect(remainingAnchors).toContain(anchorIds[0]);
    expect(remainingAnchors).not.toContain(anchorIds[1]);
  });

  test('场景 5: 锁定提示 - 所有锚点被锁定时显示提示', async ({ page }) => {
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

    // 瞄准第 3 个位置（应该显示"锚点正在被使用"）
    await page.mouse.move(1100, 800);
    await page.mouse.down();
    await page.waitForTimeout(500);

    // 截图
    await page.screenshot({
      path: 'artifacts/05-locked-hint.png',
      fullPage: true,
    });

    await page.mouse.up();
  });

  test('场景 6: 冲刺吸附 - 路径进入半径时自动吸附', async ({ page }) => {
    // 放置一个锚点
    await page.mouse.click(900, 800);
    await page.waitForTimeout(500);

    // 移动疯子到锚点左侧（使用键盘）
    // 注：实际测试中需要模拟键盘持续按下
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(1000);
    await page.keyboard.up('ArrowLeft');

    await page.waitForTimeout(300);

    // 向右冲刺（Shift + 方向键）
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('Shift');

    await page.waitForTimeout(500);

    // 截图
    await page.screenshot({
      path: 'artifacts/06-snap-success.png',
      fullPage: true,
    });

    // 验证吸附状态
    const isSnapped = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const scene = game.scene.scenes[0];
      return scene.isSnapped || false;
    });

    expect(isSnapped).toBe(true);
  });

  test('场景 7: 短冲刺 - 未进入吸附半径时显示"未吸附"', async ({ page }) => {
    // 不放置锚点，直接冲刺
    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('Shift');

    await page.waitForTimeout(1000);

    // 截图（应该显示"未吸附"提示）
    await page.screenshot({
      path: 'artifacts/07-miss-badge.png',
      fullPage: true,
    });
  });

  test('场景 8: 瞄准窗口 - 吸附后进入瞄准窗口', async ({ page }) => {
    // 放置锚点
    await page.mouse.click(900, 800);
    await page.waitForTimeout(500);

    // 移动到左侧并冲刺
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowLeft');

    await page.keyboard.down('Shift');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(200);
    await page.keyboard.up('ArrowRight');
    // 保持 Shift 按住以延长瞄准窗口
    await page.waitForTimeout(400);

    // 截图
    await page.screenshot({
      path: 'artifacts/08-aim-window.png',
      fullPage: true,
    });

    await page.keyboard.up('Shift');
  });

  test('综合场景录像', async ({ page, context }) => {
    // 创建录像上下文
    const recordingPage = await context.newPage();
    await recordingPage.goto('/');
    await recordingPage.waitForTimeout(2000);

    // 场景 1: 有效放置
    await recordingPage.mouse.click(500, 800);
    await recordingPage.waitForTimeout(800);

    // 场景 2: 第二个锚点
    await recordingPage.mouse.click(900, 800);
    await recordingPage.waitForTimeout(800);

    // 场景 3: 移动疯子
    await recordingPage.keyboard.down('ArrowLeft');
    await recordingPage.waitForTimeout(1000);
    await recordingPage.keyboard.up('ArrowLeft');
    await recordingPage.waitForTimeout(300);

    // 场景 4: 冲刺吸附
    await recordingPage.keyboard.down('Shift');
    await recordingPage.keyboard.down('ArrowRight');
    await recordingPage.waitForTimeout(200);
    await recordingPage.keyboard.up('ArrowRight');
    await recordingPage.waitForTimeout(600);

    // 场景 5: 弹射
    await recordingPage.keyboard.up('Shift');
    await recordingPage.waitForTimeout(1000);

    // 场景 6: FIFO 替换
    await recordingPage.mouse.click(1100, 800);
    await recordingPage.waitForTimeout(800);

    // 最终截图
    await recordingPage.screenshot({
      path: 'artifacts/09-综合场景.png',
      fullPage: true,
    });

    await recordingPage.close();
  });
});
