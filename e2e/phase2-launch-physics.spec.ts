/**
 * Phase 2 发射物理测试
 * 验证发射后的真实飞行物理
 */
import { test, expect } from '@playwright/test';

test.describe('Phase 2 发射物理验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(() => {
      return window.__GAME__ && window.__TEST_API__ && 
             window.__GAME__.scene.scenes[0] && 
             window.__GAME__.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test('保留锚点向上发射：峰值高度 ≥ 220px', async ({ page }) => {
    // 理论：v = 16 u/s = 512 px/s, g = 500 px/s²
    // 峰值高度 = v²/(2g) = 512²/(2*500) ≈ 262px
    // 允许误差15%，最小220px

    // 放置锚点并吸附并发射
    const launchData = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      // 设置向上瞄准
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(16.67);
      
      // 触发发射
      window.__TEST_API__.step(300);
      
      // 记录发射瞬间的速度
      const body = scene.madman.body;
      return { 
        initialVel: { x: body.velocity.x, y: body.velocity.y },
        incomingDir: scene.incomingDashDir,
        aimDir: scene.aimDirection
      };
    });

    // 记录1秒内的y坐标和速度
    const samples = await page.evaluate(() => {
      const positions: number[] = [];
      const velocities: number[] = [];
      const scene = window.__GAME__.scene.scenes[0] as any;
      const body = scene.madman.body;
      
      // 采样60帧（约1秒）
      for (let i = 0; i < 60; i++) {
        window.__TEST_API__.step(16.67);
        positions.push(scene.madman.y);
        velocities.push(body.velocity.y);
      }
      
      return { 
        positions, 
        velocities, 
        launchAirTime: scene.launchAirTime,
        bodyY: body.y,
        bodyX: body.x,
        bodyMoves: body.moves,
        bodyEnable: body.enable
      };
    });

    // 找到最小y（最高点）
    const launchY = 768;
    const minY = Math.min(...samples.positions);
    const peakRise = launchY - minY;

    console.log('保留发射峰值高度:', peakRise.toFixed(1), 'px');
    console.log('理论峰值:', 262, 'px');
    console.log('最小要求:', 220, 'px');
    console.log('发射速度 vx/vy:', launchData.initialVel.x.toFixed(1), '/', launchData.initialVel.y.toFixed(1));
    console.log('进入方向:', launchData.incomingDir);
    console.log('瞄准方向:', launchData.aimDir);
    console.log('launchAirTime:', samples.launchAirTime);
    console.log('前5帧y:', samples.positions.slice(0, 5).map(v => v.toFixed(1)));
    console.log('后5帧y:', samples.positions.slice(-5).map(v => v.toFixed(1)));
    console.log('前5帧vy:', samples.velocities.slice(0, 5).map(v => v.toFixed(1)));
    console.log('unique y values:', new Set(samples.positions.map(v => v.toFixed(0))).size);
    console.log('body.y:', samples.bodyY, 'body.x:', samples.bodyX);
    console.log('body.moves:', samples.bodyMoves, 'body.enable:', samples.bodyEnable);

    // 断言峰值高度 ≥ 220px
    expect(peakRise).toBeGreaterThanOrEqual(220);
  });

  test('锥角边缘发射：0.5s内水平位移 ≥ 150px', async ({ page }) => {
    // 放置锚点并吸附
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      // 设置-20°方向（右边缘）
      const angle = -20 * Math.PI / 180;
      const dirX = Math.sin(angle);
      const dirY = -Math.cos(angle);
      window.__TEST_API__.setAimDirection(dirX, dirY);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(16.67);
    });

    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 触发发射并记录起始x
      window.__TEST_API__.step(300);
      const startX = scene.madman.x;
      
      // 前进0.5秒（30帧）
      for (let i = 0; i < 30; i++) {
        window.__TEST_API__.step(16.67);
      }
      
      const endX = scene.madman.x;
      return { startX, endX, dx: endX - startX };
    });

    console.log('锥角边缘发射水平位移:');
    console.log('  起始x:', result.startX.toFixed(1));
    console.log('  结束x:', result.endX.toFixed(1));
    console.log('  位移dx:', result.dx.toFixed(1), 'px');
    console.log('  最小要求:', 150, 'px');

    // 断言水平位移 ≥ 150px
    expect(result.dx).toBeGreaterThanOrEqual(150);
  });

  test('消耗锚点峰值 ≥ 1.6x 保留锚点峰值', async ({ page }) => {
    // 理论比例：(21.6/16)² ≈ 1.82
    // 允许误差，最小1.6x

    // 测试保留锚点发射
    const keptPeak = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(16.67);
      window.__TEST_API__.step(300);
      
      const launchY = scene.madman.y;
      let minY = launchY;
      
      // 采样60帧
      for (let i = 0; i < 60; i++) {
        window.__TEST_API__.step(16.67);
        minY = Math.min(minY, scene.madman.y);
      }
      
      return launchY - minY;
    });

    // 重置场景
    await page.reload();
    await page.waitForFunction(() => window.__TEST_API__, { timeout: 5000 });
    await page.waitForTimeout(1000);

    // 测试消耗锚点发射
    const consumedPeak = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(true); // 消耗模式
      window.__TEST_API__.step(16.67);
      window.__TEST_API__.step(300);
      
      const launchY = scene.madman.y;
      let minY = launchY;
      
      // 采样60帧
      for (let i = 0; i < 60; i++) {
        window.__TEST_API__.step(16.67);
        minY = Math.min(minY, scene.madman.y);
      }
      
      return launchY - minY;
    });

    const ratio = consumedPeak / keptPeak;

    console.log('峰值高度对比:');
    console.log('  保留峰值:', keptPeak.toFixed(1), 'px');
    console.log('  消耗峰值:', consumedPeak.toFixed(1), 'px');
    console.log('  比例:', ratio.toFixed(2), 'x');
    console.log('  理论:', 1.82, 'x');
    console.log('  最小要求:', 1.6, 'x');

    // 断言比例 ≥ 1.6
    expect(ratio).toBeGreaterThanOrEqual(1.6);
  });
});
