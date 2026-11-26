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

    // 场景3: 重新吸附，使用setHoldDash保持吸附 (1秒)
    const snapResult = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      window.__TEST_API__.placeAnchorAt(500 / 32, 600 / 32);
      scene.madman.setPosition(385, 600);
      scene.dashCooldown = 0;
      
      // 吸附前先设置consume和aim，避免窗口过期
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(true);
      
      // 使用setHoldDash(true)保持吸附，避免窗口过期自动发射
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      return {
        isSnapped: scene.isSnapped,
        aimWindowTimer: scene.aimWindowTimer,
        consumeAnchor: scene.consumeAnchor
      };
    });
    console.log('重新吸附结果:', JSON.stringify(snapResult));
    await page.waitForTimeout(400); // 让用户看到HUD显示21.6，保持<0.5s

    // 场景4: 释放hold触发消耗发射
    const consumedResult = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 释放hold，让窗口自然过期触发发射
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.step(300); // 等待窗口过期
      window.__TEST_API__.step(16.67); // 等待发射完成
      
      return {
        launchSpeed: scene.lastLaunchSpeed,
        launchY: scene.lastLaunch.y,
        launchVy: scene.lastLaunch.vy,
        consumeAnchor: scene.consumeAnchor
      };
    });
    console.log('消耗发射:', JSON.stringify(consumedResult));
    await page.waitForTimeout(4000); // 观察更高的弧线
    
    // 断言：确保consume工作
    if (Math.abs(keptResult.launchSpeed - 16.0) > 0.1) {
      throw new Error(`保留速度错误: ${keptResult.launchSpeed}, 期望16.0`);
    }
    if (Math.abs(consumedResult.launchSpeed - 21.6) > 0.1) {
      throw new Error(`消耗速度错误: ${consumedResult.launchSpeed}, 期望21.6`);
    }
    
    // 计算峰值比 (vy²比)
    const keptRise = (keptResult.launchVy * keptResult.launchVy) / 1000; // vy²/(2g)
    const consumedRise = (consumedResult.launchVy * consumedResult.launchVy) / 1000;
    const riseRatio = consumedRise / keptRise;
    
    if (riseRatio < 1.6) {
      throw new Error(`峰值比过低: ${riseRatio.toFixed(2)}, 期望≥1.6`);
    }
    
    console.log('验证通过: 保留16.0, 消耗21.6, 峰值比', riseRatio.toFixed(2));

    // 保存视频
    await context.close();
    await browser.close();
  });
});
