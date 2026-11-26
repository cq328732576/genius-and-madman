/**
 * Phase 1 最终证据捕获
 */
import { test } from '@playwright/test';

// 证据路径：UPDATE_EVIDENCE=1时写入docs/evidence/，否则写入test-results/
const evidencePath = (filename: string) => 
  process.env.UPDATE_EVIDENCE === '1' 
    ? `docs/evidence/${filename}` 
    : `test-results/evidence-${filename}`;

test.describe('Phase 1 证据', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(() => {
      return window.__GAME__ && window.__TEST_API__ && 
             window.__GAME__.scene.scenes[0] && 
             window.__GAME__.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('01-有效放置', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a = scene.anchorSystem.placeAnchor({ x: 500 / 32, y: 800 / 32 }, 'ground');
      if (a) scene.createAnchorSprite(a);
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: evidencePath('01-valid-placement.png') });
  });

  test('02-禁止放置', async ({ page }) => {
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.screenshot({ path: evidencePath('02-forbidden-placement.png') });
    await page.mouse.up();
  });

  test('03a-FIFO前', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const a1 = scene.anchorSystem.placeAnchor({ x: 400 / 32, y: 800 / 32 }, 'ground');
      if (a1) scene.createAnchorSprite(a1);
      const a2 = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      if (a2) scene.createAnchorSprite(a2);
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: evidencePath('03a-fifo-before.png') });
  });

  test('03b-FIFO后', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.anchorSystem.placeAnchor({ x: 300 / 32, y: 800 / 32 }, 'ground');
      scene.anchorSystem.placeAnchor({ x: 600 / 32, y: 800 / 32 }, 'ground');
      scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 800 / 32 }, 'ground');
      scene.anchorSprites.forEach((s: any) => s.destroy());
      scene.anchorSprites.clear();
      scene.anchorSystem.getAnchors().forEach((a: any) => scene.createAnchorSprite(a));
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: evidencePath('03b-fifo-after.png') });
  });

  test('04-锁定提示', async ({ page }) => {
    // 放置A和B
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchorA = scene.anchorSystem.placeAnchor({ x: 400 / 32, y: 768 / 32 }, 'ground');
      if (anchorA) scene.createAnchorSprite(anchorA);
      const anchorB = scene.anchorSystem.placeAnchor({ x: 700 / 32, y: 768 / 32 }, 'ground');
      if (anchorB) scene.createAnchorSprite(anchorB);
      
      // 疯子准备吸附到A
      scene.madman.setPosition(400 - 0.6 * 32 - 96, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    // 冲刺吸附到A（按住保持）
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
    });
    
    await page.waitForTimeout(200);
    
    // 疯子吸附到A时，尝试放置第3个（应显示A的使用中徽标）
    await page.mouse.move(1000, 768);
    await page.mouse.down();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: evidencePath('04-locked-hint.png') });
    await page.mouse.up();
  });

  test('05-吸附成功', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (anchor) scene.createAnchorSprite(anchor);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    // 触发冲刺，立即捕获（+1帧）
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      // 仅步进1帧以显示吸附状态
      window.__TEST_API__.step(16.67);
    });
    
    await page.waitForTimeout(100);
    
    await page.screenshot({ path: evidencePath('05-snap-success.png') });
  });

  test('06a-瞄准窗口基础', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (anchor) scene.createAnchorSprite(anchor);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(200); // 步进0.2s
    });
    
    await page.waitForTimeout(100);
    await page.screenshot({ path: evidencePath('06a-aim-window-base.png') });
  });

  test('06b-瞄准窗口延长', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchor = scene.anchorSystem.placeAnchor({ x: 900 / 32, y: 768 / 32 }, 'ground');
      if (anchor) scene.createAnchorSprite(anchor);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(true); // 按住延长
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(450); // 步进0.45s
    });
    
    await page.waitForTimeout(100);
    await page.screenshot({ path: evidencePath('06b-aim-window-extended.png') });
  });

  test('07-未吸附短冲刺', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      // 疯子在平台左侧，向右冲刺4u不会进入裂谷
      scene.madman.setPosition(200, 584);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    // 触发冲刺
    await page.evaluate(() => {
      window.__TEST_API__.triggerDash('right');
    });
    
    // 等待徽标显示（但在消失前捕获）
    await page.waitForTimeout(300);
    
    await page.screenshot({ path: evidencePath('07-miss-short-dash.png') });
  });
});
