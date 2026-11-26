/**
 * Phase 2 演示视频录制
 * 展示：瞄准、锥角限制、保留发射、消耗发射(2x)
 * 目标: 15-20秒，无长空闲
 */
import { test, chromium } from '@playwright/test';
import * as path from 'path';

test.describe('Phase 2 演示视频', () => {
  test('录制完整演示', async () => {
    // 创建浏览器和上下文，配置视频录制
    const videoDir = path.join(process.cwd(), 'docs/evidence/phase2');
    
    const browser = await chromium.launch({
      args: [
        '--use-gl=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: videoDir,
        size: { width: 1280, height: 720 },
      },
    });
    
    const page = await context.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(() => {
      return window.__GAME__ && window.__TEST_API__ && 
             window.__GAME__.scene.scenes[0] && 
             window.__GAME__.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    await page.waitForTimeout(500);

    // 场景1: 吸附并瞄准扫描 (5秒)
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });
    await page.waitForTimeout(800);

    // 快速扫描：向上 → 右边缘 → 左边缘 → 向上
    await page.evaluate(() => window.__TEST_API__.setAimDirection(0, -1));
    await page.waitForTimeout(500);

    for (let i = 0; i <= 7; i++) {
      await page.evaluate((angle) => {
        const rad = angle * Math.PI / 180;
        window.__TEST_API__.setAimDirection(Math.sin(rad), -Math.cos(rad));
      }, i * 10); // 0 to 70 degrees
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);

    for (let i = 7; i >= -7; i--) {
      await page.evaluate((angle) => {
        const rad = angle * Math.PI / 180;
        window.__TEST_API__.setAimDirection(Math.sin(rad), -Math.cos(rad));
      }, i * 10); // 70 to -70 degrees
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);

    // 回到向上
    await page.evaluate(() => window.__TEST_API__.setAimDirection(0, -1));
    await page.waitForTimeout(500);

    // 场景2: 保留发射 (4秒)
    await page.evaluate(() => {
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(300); // 触发发射
    });
    await page.waitForTimeout(2500); // 观察飞行弧线

    // 场景3: 重新吸附 (1秒)
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });
    await page.waitForTimeout(500);

    // 场景4: 消耗发射，HUD显示21.6 (6秒)
    await page.evaluate(() => {
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(true); // 消耗模式
      window.__TEST_API__.step(16.67);
    });
    await page.waitForTimeout(1000); // 让HUD显示21.6

    await page.evaluate(() => {
      window.__TEST_API__.step(300); // 触发发射
    });
    await page.waitForTimeout(3500); // 观察更高的飞行弧线

    // 总计约17秒

    // 保存视频
    await context.close();
    await browser.close();
  });
});
