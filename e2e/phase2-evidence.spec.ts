/**
 * Phase 2 证据捕获（修订版）
 * 修复所有规范要求的问题
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';

// 创建证据目录
const evidenceDir = 'docs/evidence/phase2';
if (!fs.existsSync(evidenceDir)) {
  fs.mkdirSync(evidenceDir, { recursive: true });
}

test.describe('Phase 2 证据捕获（修订版）', () => {
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

  test('P2-01: 轨迹预览可见', async ({ page }) => {
    // 放置锚点并吸附
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });

    // 设置瞄准方向（向上偏右）
    await page.evaluate(() => {
      window.__TEST_API__.setAimDirection(0.5, -1);
      window.__TEST_API__.step(16.67);
    });

    // 冻结并获取状态
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('P2-01 state:', state);

    // 验证状态
    expect(state.isSnapped).toBe(true);
    expect(state.trajectoryPointsLength).toBeGreaterThan(0);
    expect(state.hudText).toContain('是否吸附: 是');

    // 截图
    const screenshotPath = path.join(evidenceDir, 'P2-01-trajectory-preview.png');
    await page.screenshot({ path: screenshotPath });

    // 计算并记录 MD5
    const data = fs.readFileSync(screenshotPath);
    const md5 = crypto.createHash('md5').update(data).digest('hex');
    console.log('P2-01 MD5:', md5);

    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('P2-02: 锥角限制（输入超过70°）', async ({ page }) => {
    // 放置锚点并吸附
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });

    // 设置瞄准方向为向右（90°偏离向上轴，超过70°限制）
    await page.evaluate(() => {
      window.__TEST_API__.setAimDirection(1, 0);  // 向右 = 0°
      window.__TEST_API__.step(16.67);
    });

    // 冻结并获取状态
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('P2-02 state:', state);

    // 验证状态
    expect(state.isSnapped).toBe(true);
    // 输入0°距离轴-90°是90°，应限制到最近边缘-20°
    expect(state.clampedAngle).toBeCloseTo(-20, 0.5);
    expect(state.hudText).toContain('限制瞄准:');
    expect(state.trajectoryPointsLength).toBeGreaterThan(0);

    // 截图
    const screenshotPath = path.join(evidenceDir, 'P2-02-cone-limit.png');
    await page.screenshot({ path: screenshotPath });

    const data = fs.readFileSync(screenshotPath);
    const md5 = crypto.createHash('md5').update(data).digest('hex');
    console.log('P2-02 MD5:', md5);

    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('P2-03: 保留锚点发射（发射后捕获）', async ({ page }) => {
    // 放置锚点并吸附
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);

      // 设置瞄准方向（向上）
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(16.67);

      const beforeAnchors = window.__TEST_API__.getAnchors().length;

      // 等待瞄准窗口结束（触发发射）
      window.__TEST_API__.step(300);
      
      // 发射后等待几帧让疯子离开地面
      window.__TEST_API__.step(100);

      return { beforeAnchors };
    });

    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const afterAnchors = window.__TEST_API__.getAnchors().length;
      const state = window.__TEST_API__.getState();
      return { afterAnchors, state };
    });

    console.log('P2-03 result:', result);
    console.log('P2-03 lastLaunchSpeed:', result.state.lastLaunchSpeed, 'u/s');

    // 验证锚点未被消耗
    expect(result.afterAnchors).toBe(1);

    // 验证记录的发射速度 ≈ 16 u/s
    expect(Math.abs(result.state.lastLaunchSpeed - 16)).toBeLessThan(0.1);
    
    // 验证疯子在空中
    expect(result.state.madmanY).toBeLessThan(768 - 20);

    // 冻结并截图
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const screenshotPath = path.join(evidenceDir, 'P2-03-kept-anchor.png');
    await page.screenshot({ path: screenshotPath });

    const data = fs.readFileSync(screenshotPath);
    const md5 = crypto.createHash('md5').update(data).digest('hex');
    console.log('P2-03 MD5:', md5);

    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('P2-04: 消耗锚点发射（发射后捕获）', async ({ page }) => {
    // 放置锚点并吸附
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);

      // 设置瞄准方向（向上）并消耗锚点
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(true);
      window.__TEST_API__.step(16.67);

      const beforeAnchors = window.__TEST_API__.getAnchors().length;

      // 等待瞄准窗口结束（触发发射）
      window.__TEST_API__.step(300);
      
      // 发射后等待几帧让疯子离开地面
      window.__TEST_API__.step(100);

      return { beforeAnchors };
    });

    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const afterAnchors = window.__TEST_API__.getAnchors().length;
      const state = window.__TEST_API__.getState();
      return { afterAnchors, state };
    });

    console.log('P2-04 result:', result);
    console.log('P2-04 lastLaunchSpeed:', result.state.lastLaunchSpeed, 'u/s');

    // 验证锚点被消耗
    expect(result.afterAnchors).toBe(0);

    // 验证记录的发射速度 ≈ 21.6 u/s (16 * 1.35)
    expect(Math.abs(result.state.lastLaunchSpeed - 21.6)).toBeLessThan(0.1);
    
    // 验证疯子在空中
    expect(result.state.madmanY).toBeLessThan(768 - 20);

    // 冻结并截图
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const screenshotPath = path.join(evidenceDir, 'P2-04-consumed-anchor.png');
    await page.screenshot({ path: screenshotPath });

    const data = fs.readFileSync(screenshotPath);
    const md5 = crypto.createHash('md5').update(data).digest('hex');
    console.log('P2-04 MD5:', md5);

    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('P2-05: 悬停点修复（脚完全在地面上方）', async ({ page }) => {
    // 放置锚点并吸附
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
    });

    // 冻结并获取状态
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('P2-05 state:', state);

    // 验证状态
    expect(state.isSnapped).toBe(true);
    
    // 计算疯子底部位置
    // 疯子高度 = 1.8u * 32 = 58px，底部对齐，所以底部 = y
    // 地面顶部在y=768处，平台厚度32px，所以顶部 = 768 - 16 = 752px
    // 悬停点应该让疯子的底部在地面以上
    const madmanBottom = state.madmanY;
    const groundSurface = 768;
    
    console.log('P2-05 madman bottom:', madmanBottom, 'ground surface:', groundSurface);
    // 疯子底部应该在地面上方（y值更小）
    expect(madmanBottom).toBeLessThan(groundSurface - 10);

    // 截图
    const screenshotPath = path.join(evidenceDir, 'P2-05-hover-fix.png');
    await page.screenshot({ path: screenshotPath });

    const data = fs.readFileSync(screenshotPath);
    const md5 = crypto.createHash('md5').update(data).digest('hex');
    console.log('P2-05 MD5:', md5);

    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('P2-06: 「已吸附」真实徽标', async ({ page }) => {
    // 放置锚点并吸附
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      // 设置一个不同的瞄准方向以区别于P2-05
      window.__TEST_API__.setAimDirection(-0.5, -1);
      window.__TEST_API__.step(16.67);
    });

    // 冻结并获取状态
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('P2-06 state:', state);

    // 验证状态
    expect(state.isSnapped).toBe(true);
    expect(state.badgeVisible).toBe(true);
    expect(state.badgeTexture).toMatch(/snap_badge_snapped_zh_/);

    // 截图
    const screenshotPath = path.join(evidenceDir, 'P2-06-snapped-badge.png');
    await page.screenshot({ path: screenshotPath });

    const data = fs.readFileSync(screenshotPath);
    const md5 = crypto.createHash('md5').update(data).digest('hex');
    console.log('P2-06 MD5:', md5);

    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('P2-07: 粗吸附半径环（疯子接近时）', async ({ page }) => {
    // 放置锚点
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      
      // 疯子在接近锚点的位置，但还未吸附
      scene.madman.setPosition(900 - 80, 768);
    });

    // 检查环的属性
    const ringInfo = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const anchors = scene.anchorSystem.getAnchors();
      if (anchors.length === 0) return null;

      const anchorId = anchors[0].id;
      const container = scene.anchorSprites.get(anchorId);
      if (!container) return null;

      const snapRing = container.getData('snapRing');
      if (!snapRing) return null;

      return {
        textureKey: snapRing.texture?.key || 'unknown',
        scale: snapRing.scale,
        // 环半径 = 118 * scale
        displayRadius: 118 * snapRing.scale,
        displayWidth: 256 * snapRing.scale,
      };
    });

    console.log('P2-07 ring info:', ringInfo);

    // 验证环的属性
    expect(ringInfo).not.toBeNull();
    expect(ringInfo!.textureKey).toMatch(/snap_ring_bold_/);
    expect(ringInfo!.displayRadius).toBeCloseTo(64, 1); // 2.0u * 32px/u = 64px
    // displayWidth = 256 * scale = 256 * 0.542 ≈ 138.8
    expect(ringInfo!.displayWidth).toBeGreaterThan(130);
    expect(ringInfo!.displayWidth).toBeLessThan(145);

    // 冻结并截图
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const screenshotPath = path.join(evidenceDir, 'P2-07-bold-ring.png');
    await page.screenshot({ path: screenshotPath });

    const data = fs.readFileSync(screenshotPath);
    const md5 = crypto.createHash('md5').update(data).digest('hex');
    console.log('P2-07 MD5:', md5);

    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });
});
