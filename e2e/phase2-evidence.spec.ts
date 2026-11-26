/**
 * Phase 2 证据捕获
 * 实现方向瞄准、轨迹预览、弹射发射、保留/消耗锚点
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

test.describe('Phase 2 证据捕获', () => {
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

  test('P2-02: 锥角限制', async ({ page }) => {
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

    // 设置瞄准方向（尝试向右，应该被限制）
    await page.evaluate(() => {
      window.__TEST_API__.setAimDirection(1, 0);
      window.__TEST_API__.step(16.67);
    });

    // 冻结并获取状态
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const state = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('P2-02 state:', state);

    // 验证状态
    expect(state.isSnapped).toBe(true);
    expect(Math.abs(state.clampedAngleDeg)).toBeLessThanOrEqual(70);
    expect(state.hudText).toContain('限制角度:');

    // 截图
    const screenshotPath = path.join(evidenceDir, 'P2-02-cone-limit.png');
    await page.screenshot({ path: screenshotPath });

    // 计算并记录 MD5
    const data = fs.readFileSync(screenshotPath);
    const md5 = crypto.createHash('md5').update(data).digest('hex');
    console.log('P2-02 MD5:', md5);

    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('P2-03: 保留锚点发射', async ({ page }) => {
    // 放置锚点并吸附
    const result = await page.evaluate(() => {
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

      const afterAnchors = window.__TEST_API__.getAnchors().length;
      const afterState = window.__TEST_API__.getState();

      return { beforeAnchors, afterAnchors, afterState };
    });

    console.log('P2-03 result:', result);

    // 验证锚点未被消耗
    expect(result.beforeAnchors).toBe(result.afterAnchors);
    expect(result.afterAnchors).toBe(1);

    // 验证速度约为 16 u/s (16 * 32 = 512 px/s)
    // 由于混合和限制，实际速度可能在 10-18 u/s 范围内
    const speed = Math.sqrt(
      result.afterState.madmanVelX * result.afterState.madmanVelX +
      result.afterState.madmanVelY * result.afterState.madmanVelY
    );
    expect(speed).toBeGreaterThan(300); // ~9.4 u/s
    expect(speed).toBeLessThan(650); // ~20 u/s

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

  test('P2-04: 消耗锚点发射', async ({ page }) => {
    // 放置锚点并吸附
    const result = await page.evaluate(() => {
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

      const afterAnchors = window.__TEST_API__.getAnchors().length;
      const afterState = window.__TEST_API__.getState();

      return { beforeAnchors, afterAnchors, afterState };
    });

    console.log('P2-04 result:', result);

    // 验证锚点被消耗
    expect(result.beforeAnchors).toBe(1);
    expect(result.afterAnchors).toBe(0);

    // 验证速度约为 21.6 u/s (16 * 1.35 = 21.6, 21.6 * 32 = 691.2 px/s)
    // 由于混合和限制，实际速度可能在 13-24 u/s 范围内
    const speed = Math.sqrt(
      result.afterState.madmanVelX * result.afterState.madmanVelX +
      result.afterState.madmanVelY * result.afterState.madmanVelY
    );
    expect(speed).toBeGreaterThan(400); // ~12.5 u/s
    expect(speed).toBeLessThan(850); // ~26.5 u/s

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

  test('P2-05: 悬停点修复和视觉改进', async ({ page }) => {
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
    expect(state.hudText).toContain('是否吸附: 是');

    // 验证疯子的Y位置在地面之上（地面在768px，疯子身高58px，所以底部应该在768以上）
    const groundY = 768;
    const characterHeight = 1.8 * 32; // 58px
    expect(state.madmanY).toBeLessThan(groundY - characterHeight * 0.3);

    // 截图
    const screenshotPath = path.join(evidenceDir, 'P2-05-hover-fix-visuals.png');
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

  test('P2-07: 粗吸附半径环', async ({ page }) => {
    // 放置锚点
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
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
      };
    });

    console.log('P2-07 ring info:', ringInfo);

    // 验证环的属性
    expect(ringInfo).not.toBeNull();
    expect(ringInfo!.textureKey).toMatch(/snap_ring_bold_/);
    expect(ringInfo!.displayRadius).toBeCloseTo(64, 1); // 2.0u * 32px/u = 64px

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
