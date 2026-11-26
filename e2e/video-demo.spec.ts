/**
 * 录制吸附和瞄准窗口演示视频
 */

import { test } from '@playwright/test';

test.describe('Phase 1 视频演示', () => {
  test('吸附和瞄准窗口演示', async ({ page, browser }) => {
    // 创建带视频录制的上下文
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: 'docs/evidence/',
        size: { width: 1280, height: 720 },
      },
    });
    
    const demoPage = await context.newPage();
    
    await demoPage.goto('/', { waitUntil: 'networkidle' });
    await demoPage.waitForSelector('canvas', { timeout: 15000 });
    
    // 等待游戏初始化
    await demoPage.waitForFunction(() => {
      return (window as any).__GAME__ && (window as any).__TEST_API__ && 
             (window as any).__GAME__.scene.scenes[0] && 
             (window as any).__GAME__.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    
    // 等待渲染
    await demoPage.waitForTimeout(2000);
    
    // 场景 1: 放置锚点
    await demoPage.evaluate(() => {
      const scene = (window as any).__GAME__.scene.scenes[0];
      const a = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a) scene.createAnchorSprite(a);
      scene.madman.setPosition(400, 550);
      scene.madman.setVelocity(0, 0);
    });
    
    await demoPage.waitForTimeout(1000);
    
    // 场景 2: 冲刺吸附
    await demoPage.keyboard.down('Shift');
    await demoPage.keyboard.press('ArrowRight');
    await demoPage.waitForTimeout(800);
    
    // 场景 3: 瞄准窗口（保持 Shift）
    await demoPage.waitForTimeout(500);
    
    // 场景 4: 释放（Phase 1 不弹射）
    await demoPage.keyboard.up('Shift');
    await demoPage.waitForTimeout(2000);
    
    // 关闭页面以保存视频
    await demoPage.close();
    await context.close();
    
    // 等待视频处理
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
});
