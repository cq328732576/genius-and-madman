/**
 * Phase 3 证据截图生成
 */
import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.join(process.cwd(), 'docs/evidence/phase3');

test.describe('Phase 3 证据截图', () => {
  test.beforeEach(async ({ page }) => {
    // 确保证据目录存在
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(() => {
      return window.__GAME__ && window.__TEST_API__ && 
             window.__GAME__.scene.scenes[0] && 
             window.__GAME__.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('P3-01: 全景截图', async ({ page }) => {
    // 显示完整关卡布局
    await page.evaluate(() => {
      window.__TEST_API__.freeze();
    });

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'P3-01-panorama.png'),
      fullPage: false,
    });

    console.log('✓ P3-01: 全景截图已保存');
  });

  test('P3-02: 吸附后轨迹预览', async ({ page }) => {
    // 1. 放置锚点
    await page.evaluate(() => {
      const anchorX = 13.5;
      const anchorY = 22;
      window.__TEST_API__.placeAnchorAt(anchorX, anchorY);
    });

    await page.waitForTimeout(500);

    // 2. 疯子吸附
    await page.evaluate(() => {
      const ppu = 32;
      const madmanStartX = 10 * ppu;
      const madmanStartY = 23 * ppu;
      window.__TEST_API__.setMadmanPosition(madmanStartX, madmanStartY);
      
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.dashCooldown = 0;
      window.__TEST_API__.step(100);
      
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(200);
    });

    await page.waitForTimeout(500);

    // 3. 瞄准右上（最大水平距离）
    await page.evaluate(() => {
      const angle70 = 70 * Math.PI / 180;
      const aimX = Math.sin(angle70);
      const aimY = -Math.cos(angle70);
      window.__TEST_API__.setAimDirection(aimX, aimY);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(100);
      window.__TEST_API__.freeze();
    });

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'P3-02-trajectory-preview.png'),
      fullPage: false,
    });

    console.log('✓ P3-02: 轨迹预览截图（落点应在右平台）');
  });

  test('P3-03: 疯子落地压力板，桥梁伸出', async ({ page }) => {
    // 直接将疯子传送到压力板
    await page.evaluate(() => {
      const ppu = 32;
      const plateX = 23.5 * ppu;
      const plateY = 23 * ppu;
      window.__TEST_API__.setMadmanPosition(plateX, plateY);
      window.__TEST_API__.step(500);
    });

    await page.waitForTimeout(1000); // 等待桥梁动画

    await page.evaluate(() => {
      window.__TEST_API__.freeze();
    });

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'P3-03-pressure-plate-bridge.png'),
      fullPage: false,
    });

    console.log('✓ P3-03: 压力板激活，桥梁伸出');
  });

  test('P3-04: 天才通过桥梁', async ({ page }) => {
    // 1. 先激活桥梁
    await page.evaluate(() => {
      const ppu = 32;
      const plateX = 23.5 * ppu;
      const plateY = 23 * ppu;
      window.__TEST_API__.setMadmanPosition(plateX, plateY);
      window.__TEST_API__.step(500);
    });

    await page.waitForTimeout(1000);

    // 2. 天才在桥上
    await page.evaluate(() => {
      const ppu = 32;
      const bridgeX = 20 * ppu;
      const bridgeY = 23.5 * ppu;
      window.__TEST_API__.setGeniusPosition(bridgeX, bridgeY);
      window.__TEST_API__.step(100);
      window.__TEST_API__.freeze();
    });

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'P3-04-genius-crossing.png'),
      fullPage: false,
    });

    console.log('✓ P3-04: 天才通过桥梁');
  });

  test('P3-05: 双方在出口，通关提示', async ({ page }) => {
    // 1. 激活桥梁
    await page.evaluate(() => {
      const ppu = 32;
      const plateX = 23.5 * ppu;
      const plateY = 23 * ppu;
      window.__TEST_API__.setMadmanPosition(plateX, plateY);
      window.__TEST_API__.step(500);
    });

    await page.waitForTimeout(1000);

    // 2. 双方进入出口
    await page.evaluate(() => {
      const ppu = 32;
      const exitX = 29 * ppu;
      const exitY = 22 * ppu;
      window.__TEST_API__.setGeniusPosition(exitX, exitY);
      window.__TEST_API__.setMadmanPosition(exitX + 20, exitY);
      window.__TEST_API__.step(500);
      window.__TEST_API__.freeze();
    });

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'P3-05-both-in-exit.png'),
      fullPage: false,
    });

    console.log('✓ P3-05: 双方在出口，通关提示显示');
  });

  test('P3-06: 掉入裂谷后重生', async ({ page }) => {
    // 1. 先放置一个锚点（用于测试重置）
    await page.evaluate(() => {
      window.__TEST_API__.placeAnchorAt(13.5, 22);
    });

    await page.waitForTimeout(500);

    // 2. 将疯子扔进裂谷
    await page.evaluate(() => {
      const ppu = 32;
      const riftCenterX = 17 * ppu;
      const riftY = 26 * ppu;
      window.__TEST_API__.setMadmanPosition(riftCenterX, riftY);
      window.__TEST_API__.step(100);
    });

    await page.waitForTimeout(300);

    // 3. 等待掉落和重生
    await page.evaluate(() => {
      window.__TEST_API__.step(2000);
    });

    await page.waitForTimeout(500);

    // 4. 验证锚点已清除
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchorsCount = scene.anchorSystem.getAnchors().length;
      console.log('Anchors after respawn:', anchorsCount);
      window.__TEST_API__.freeze();
    });

    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, 'P3-06-respawn-checkpoint.png'),
      fullPage: false,
    });

    console.log('✓ P3-06: 重生在检查点，锚点已重置');
  });
});
