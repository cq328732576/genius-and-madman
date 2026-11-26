/**
 * Phase 2 演示视频录制
 * 展示：瞄准、锥角限制、保留发射、消耗发射(2x)
 * 目标: 15-20秒，无长空闲，明显2x峰值差异
 */
import { test, chromium } from '@playwright/test';
import * as path from 'path';

test.describe('Phase 2 演示视频', () => {
  test('录制完整演示', async () => {
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
        dir: path.join(process.cwd(), 'test-results/demo-video'),
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
    // 锚点放在x=500 y=600空旷区域，上方有600px空间
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(500 / 32, 600 / 32);
      scene.madman.setPosition(385, 600);
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
      }, i * 10);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);

    for (let i = 7; i >= -7; i--) {
      await page.evaluate((angle) => {
        const rad = angle * Math.PI / 180;
        window.__TEST_API__.setAimDirection(Math.sin(rad), -Math.cos(rad));
      }, i * 10);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);

    // 回到向上
    await page.evaluate(() => window.__TEST_API__.setAimDirection(0, -1));
    await page.waitForTimeout(500);

    // 场景2: 保留发射 (4秒)
    const keptResult = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(300);
      window.__TEST_API__.step(16.67); // 等待1帧让发射完成
      return {
        launchSpeed: scene.lastLaunchSpeed,
        launchY: scene.lastLaunch.y,
        launchVy: scene.lastLaunch.vy,
        consumeAnchor: scene.consumeAnchor
      };
    });
    console.log('保留发射:', JSON.stringify(keptResult));
    await page.waitForTimeout(2800); // 观察完整弧线

    // 场景3: 重新吸附 (1秒)
    const snapResult = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 清除第一个锚点（如果保留的话）
      const anchors = window.__TEST_API__.getAnchors();
      console.log('重新吸附前锚点数:', anchors.length);
      
      window.__TEST_API__.placeAnchorAt(500 / 32, 600 / 32);
      scene.madman.setPosition(385, 600);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      return {
        isSnapped: scene.isSnapped,
        anchorsCount: window.__TEST_API__.getAnchors().length,
        madmanX: scene.madman.x,
        madmanY: scene.madman.y
      };
    });
    console.log('重新吸附结果:', snapResult);
    await page.waitForTimeout(500);

    // 场景4: 消耗发射，HUD显示21.6 (6秒)
    await page.evaluate(() => {
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(true);
      window.__TEST_API__.step(16.67);
    });
    
    await page.waitForTimeout(1500); // 让HUD显示21.6

    const consumedResult = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      const before = {
        isSnapped: scene.isSnapped,
        aimWindowTimer: scene.aimWindowTimer,
        consumeAnchor: scene.consumeAnchor,
        cKeyDown: scene.cKeyDown,
        lastLaunchSpeed: scene.lastLaunchSpeed
      };
      console.log('step(300)前:', before);
      
      window.__TEST_API__.step(300);
      
      const after = {
        isSnapped: scene.isSnapped,
        lastLaunchSpeed: scene.lastLaunchSpeed,
        launchY: scene.lastLaunch.y,
        launchVy: scene.lastLaunch.vy
      };
      console.log('step(300)后:', after);
      
      window.__TEST_API__.step(16.67);
      
      return {
        launchSpeed: scene.lastLaunchSpeed,
        launchY: scene.lastLaunch.y,
        launchVy: scene.lastLaunch.vy,
        consumeAnchor: scene.consumeAnchor
      };
    });
    console.log('消耗发射:', JSON.stringify(consumedResult));
    await page.waitForTimeout(4000); // 观察更高的弧线
    
    // 保存视频
    await context.close();
    await browser.close();
  });
});
