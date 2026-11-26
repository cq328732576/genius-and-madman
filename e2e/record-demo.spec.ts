/**
 * Phase 2 演示视频录制
 * 展示：吸附、方向瞄准+轨迹预览、保留锚点发射、消耗锚点发射
 */
import { test } from '@playwright/test';
import * as path from 'path';

test.describe('Phase 2 演示视频', () => {
  test('录制完整演示', async ({ page, context }) => {
    // 配置视频录制
    const videoDir = path.join(process.cwd(), 'docs/evidence/phase2');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(() => {
      return window.__GAME__ && window.__TEST_API__ && 
             window.__GAME__.scene.scenes[0] && 
             window.__GAME__.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // 场景1: 吸附
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    await page.waitForTimeout(1000);

    // 执行冲刺并吸附
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });
    await page.waitForTimeout(1500);

    // 场景2: 方向瞄准 + 轨迹预览（扫向锥角边缘）
    // 从向上开始
    await page.evaluate(() => {
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.step(16.67);
    });
    await page.waitForTimeout(500);

    // 扫向右边缘
    for (let i = 0; i <= 10; i++) {
      await page.evaluate((angle) => {
        const rad = angle * Math.PI / 180;
        window.__TEST_API__.setAimDirection(Math.sin(rad), -Math.cos(rad));
        window.__TEST_API__.step(16.67);
      }, i * 7); // 0 to 70 degrees
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);

    // 扫回到中间
    for (let i = 10; i >= 0; i--) {
      await page.evaluate((angle) => {
        const rad = angle * Math.PI / 180;
        window.__TEST_API__.setAimDirection(Math.sin(rad), -Math.cos(rad));
        window.__TEST_API__.step(16.67);
      }, i * 3); // back to 0
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);

    // 场景3: 保留锚点发射
    await page.evaluate(() => {
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(16.67);
    });
    await page.waitForTimeout(500);

    // 触发发射
    await page.evaluate(() => {
      window.__TEST_API__.step(300); // 等待瞄准窗口结束
    });
    await page.waitForTimeout(2000); // 观察飞行

    // 场景4: 准备第二次吸附并消耗
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      // 重新放置锚点
      if (window.__TEST_API__.getAnchors().length === 0) {
        window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      }
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    await page.waitForTimeout(1000);

    // 再次吸附
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });
    await page.waitForTimeout(1000);

    // 场景5: 消耗锚点发射（按C键）
    await page.evaluate(() => {
      window.__TEST_API__.setAimDirection(0.3, -1);
      window.__TEST_API__.setConsume(true); // 消耗模式
      window.__TEST_API__.step(16.67);
    });
    await page.waitForTimeout(1000);

    // 触发消耗发射
    await page.evaluate(() => {
      window.__TEST_API__.step(300); // 等待瞄准窗口结束
    });
    await page.waitForTimeout(2000); // 观察飞行

    // 保存视频
    await context.close();
  });
});
