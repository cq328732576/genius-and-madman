/**
 * Phase 3 演示视频录制 - 裂谷初跃完整通关
 * 展示：放置锚点 → 吸附 → 轨迹预览 → 弹射跨越裂谷 → 压力板 → 桥梁 → 双方出口
 * 目标: ~20秒
 */
import { test, chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const ARTIFACTS_DIR = path.join(process.cwd(), 'docs/evidence/phase3');

test.describe('Phase 3 演示视频', () => {
  test('录制完整通关流程', async () => {
    // 确保目标目录存在
    if (!fs.existsSync(ARTIFACTS_DIR)) {
      fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    }

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
        dir: path.join(process.cwd(), 'test-results/phase3-demo-video'),
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
    await page.waitForTimeout(1000); // 让场景完全加载

    console.log('=== Phase 3 演示开始 ===');

    // === 场景 1: 初始状态，显示关卡布局 (2s) ===
    console.log('场景 1: 显示关卡布局');
    await page.waitForTimeout(2000);

    // === 场景 2: 天才放置锚点在凸台上 (2s) ===
    console.log('场景 2: 天才放置锚点');
    await page.evaluate(() => {
      const ppu = 32;
      // 锚点放在凸台上 (13.5, 22)
      const result = window.__TEST_API__.placeAnchorAt(13.5, 22);
      console.log('锚点放置结果:', result);
    });
    await page.waitForTimeout(1500);

    // === 场景 3: 疯子冲刺吸附到锚点 (2s) ===
    console.log('场景 3: 疯子冲刺吸附');
    await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 将疯子放在合适位置
      scene.madman.setPosition(10 * ppu, 23 * ppu);
      scene.dashCooldown = 0;
      
      // 触发冲刺
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(200);
    });
    await page.waitForTimeout(1500);

    // === 场景 4: 瞄准并显示轨迹预览 (2s) ===
    console.log('场景 4: 瞄准右上方，显示轨迹');
    await page.evaluate(() => {
      // 瞄准右上方 70° from vertical
      const angle70 = 70 * Math.PI / 180;
      const aimX = Math.sin(angle70);
      const aimY = -Math.cos(angle70);
      window.__TEST_API__.setAimDirection(aimX, aimY);
      window.__TEST_API__.setConsume(false); // 保留锚点
      window.__TEST_API__.step(100);
    });
    await page.waitForTimeout(1500); // 让观众看到轨迹预览

    // === 场景 5: 弹射发射，跨越裂谷 (3s) ===
    console.log('场景 5: 弹射跨越裂谷');
    await page.evaluate(() => {
      // 等待瞄准窗口结束，自动发射
      window.__TEST_API__.step(500);
    });
    
    await page.waitForTimeout(500); // 看到发射

    // 等待飞行和落地
    await page.evaluate(() => {
      window.__TEST_API__.step(1000); // 步进 1 秒
    });
    await page.waitForTimeout(1500);

    const landingPos = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      return { x: scene.madman.x / ppu, y: scene.madman.y / ppu };
    });
    console.log(`疯子落地位置: (${landingPos.x.toFixed(2)}, ${landingPos.y.toFixed(2)})`);

    // === 场景 6: 疯子移动到压力板，桥梁伸出 (3s) ===
    console.log('场景 6: 激活压力板，桥梁伸出');
    await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 移动到压力板
      scene.madman.setPosition(23.5 * ppu, 23 * ppu);
      window.__TEST_API__.step(500);
    });
    await page.waitForTimeout(1500); // 观看桥梁动画

    // === 场景 7: 天才通过桥梁 (3s) ===
    console.log('场景 7: 天才通过桥梁');
    await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 天才从左侧移动到桥上
      scene.genius.setPosition(16 * ppu, 24 * ppu);
      window.__TEST_API__.step(100);
    });
    await page.waitForTimeout(500);

    // 继续移动到右侧
    await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.genius.setPosition(22 * ppu, 23 * ppu);
      window.__TEST_API__.step(100);
    });
    await page.waitForTimeout(1500);

    // === 场景 8: 双方进入出口，显示通关 (3s) ===
    console.log('场景 8: 双方进入出口，通关');
    await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 双方进入出口区
      scene.genius.setPosition(29 * ppu, 22 * ppu);
      scene.madman.setPosition(29 * ppu + 20, 22 * ppu);
      window.__TEST_API__.step(500);
    });
    await page.waitForTimeout(2500); // 显示通关消息

    console.log('=== Phase 3 演示完成 ===');

    // 保存视频
    await context.close();
    await browser.close();
    
    // 等待视频处理（browser 关闭后）
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 查找生成的视频文件
    const videoDir = path.join(process.cwd(), 'test-results/phase3-demo-video');
    if (fs.existsSync(videoDir)) {
      const files = fs.readdirSync(videoDir);
      const videoFile = files.find(f => f.endsWith('.webm'));
      
      if (videoFile) {
        const srcPath = path.join(videoDir, videoFile);
        const dstPath = path.join(ARTIFACTS_DIR, 'phase3-demo.webm');
        
        // 复制到证据目录
        fs.copyFileSync(srcPath, dstPath);
        console.log(`✓ 演示视频已保存: ${dstPath}`);
      } else {
        console.warn('⚠ 未找到生成的视频文件');
      }
    }
  });
});
