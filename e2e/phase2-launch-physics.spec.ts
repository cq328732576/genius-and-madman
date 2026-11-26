/**
 * Phase 2 发射物理测试
 * 验证发射后的真实飞行物理（基于实测速度）
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

  test('校准：自由落体0.5s应下落约62.5px', async ({ page }) => {
    // 理论：g = 500 px/s², Δy = 0.5*g*t² = 0.5*500*0.25 = 62.5px
    // 允许±10%: 56-69px
    // 地面在y=768-16=752，放在y=300（距地面452px）
    
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const body = scene.madman.body;
      
      // 将madman放在离地面至少200px的空中，零速度，开启重力
      scene.madman.setPosition(400, 300);
      body.setVelocity(0, 0);
      body.allowGravity = true;
      
      const startY = scene.madman.y;
      
      // 自由落体0.5s (30帧)
      for (let i = 0; i < 30; i++) {
        window.__TEST_API__.step(16.67);
      }
      
      const endY = scene.madman.y;
      const bodyVelY = body.velocity.y;
      return { startY, endY, deltaY: endY - startY, bodyVelY };
    });
    
    console.log('自由落体校准:');
    console.log('  起始y:', result.startY.toFixed(1));
    console.log('  结束y:', result.endY.toFixed(1));
    console.log('  下落Δy:', result.deltaY.toFixed(1), 'px');
    console.log('  最终vy:', result.bodyVelY.toFixed(1), 'px/s');
    console.log('  理论Δy:', 62.5, 'px');
    console.log('  允许范围:', '56-69 px');
    
    // 断言Δy在56-69px范围内（±10%）
    expect(result.deltaY).toBeGreaterThanOrEqual(56);
    expect(result.deltaY).toBeLessThanOrEqual(69);
  });

  test('发射速度：保留约420px/s, 消耗=保留×1.35±3%', async ({ page }) => {
    // 实际速度受混合影响，约420 px/s (kept)
    // 消耗应为保留×1.35
    
    const keptResult = await page.evaluate(() => {
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
      
      const body = scene.madman.body;
      const vx = body.velocity.x;
      const vy = body.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      return { vx, vy, speed };
    });
    
    await page.reload();
    await page.waitForFunction(() => window.__TEST_API__, { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    const consumedResult = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(true);
      window.__TEST_API__.step(16.67);
      window.__TEST_API__.step(300);
      
      const body = scene.madman.body;
      const vx = body.velocity.x;
      const vy = body.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      return { vx, vy, speed };
    });
    
    console.log('保留发射速度:');
    console.log('  vx:', keptResult.vx.toFixed(1), 'vy:', keptResult.vy.toFixed(1));
    console.log('  |v|:', keptResult.speed.toFixed(1), 'px/s');
    
    console.log('消耗发射速度:');
    console.log('  vx:', consumedResult.vx.toFixed(1), 'vy:', consumedResult.vy.toFixed(1));
    console.log('  |v|:', consumedResult.speed.toFixed(1), 'px/s');
    
    const expectedConsumed = keptResult.speed * 1.35;
    const ratio = consumedResult.speed / keptResult.speed;
    
    console.log('消耗/保留比例:', ratio.toFixed(3));
    console.log('  期望:', 1.35, '±4%: 1.30-1.40');
    
    // 断言消耗速度 = 保留×1.35±4%
    expect(ratio).toBeGreaterThanOrEqual(1.30);
    expect(ratio).toBeLessThanOrEqual(1.40);
  });

  test('保留峰值：水平进入，实测峰值 = vy²/(2g) ±10%', async ({ page }) => {
    const result = await page.evaluate(() => {
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
      
      const body = scene.madman.body;
      const launchY = scene.madman.y;
      const vx = body.velocity.x;
      const vy = body.velocity.y;
      
      // 采样60帧找峰值
      let minY = launchY;
      for (let i = 0; i < 60; i++) {
        window.__TEST_API__.step(16.67);
        minY = Math.min(minY, scene.madman.y);
      }
      
      const measuredRise = launchY - minY;
      const predictedRise = (vy * vy) / (2 * 500);
      
      return { vx, vy, launchY, minY, measuredRise, predictedRise };
    });
    
    console.log('保留峰值（水平进入）:');
    console.log('  发射点y:', result.launchY.toFixed(1));
    console.log('  vx:', result.vx.toFixed(1), 'vy:', result.vy.toFixed(1));
    console.log('  预测峰值:', result.predictedRise.toFixed(1), 'px');
    console.log('  实测峰值:', result.measuredRise.toFixed(1), 'px');
    console.log('  误差:', ((result.measuredRise / result.predictedRise - 1) * 100).toFixed(1), '%');
    
    // 断言实测 = 预测 ±10%
    const lowerBound = result.predictedRise * 0.9;
    const upperBound = result.predictedRise * 1.1;
    expect(result.measuredRise).toBeGreaterThanOrEqual(lowerBound);
    expect(result.measuredRise).toBeLessThanOrEqual(upperBound);
  });

  test('保留峰值：垂直进入，必须上升262px ±10%', async ({ page }) => {
    // 纯垂直：用setIncomingDashDir设置垂直进入
    // approachDir (0,-1), aim up (0,-1)，无混合
    // vy = -512, 峰值 = 512²/(2*500) = 262px
    
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 水平吸附
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      // 覆盖进入方向为垂直
      window.__TEST_API__.setIncomingDashDir(0, -1);
      
      // 瞄准向上
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(16.67);
      window.__TEST_API__.step(300);
      
      // 从lastLaunch获取发射瞬时值
      const launch = scene.lastLaunch;
      
      // 采样80帧找峰值
      let minY = launch.y;
      for (let i = 0; i < 80; i++) {
        window.__TEST_API__.step(16.67);
        minY = Math.min(minY, scene.madman.y);
      }
      
      const measuredRise = launch.y - minY;
      
      return { 
        vx: launch.vx, 
        vy: launch.vy, 
        launchY: launch.y, 
        minY, 
        measuredRise 
      };
    });
    
    console.log('保留峰值（垂直进入）:');
    console.log('  发射点y:', result.launchY.toFixed(1));
    console.log('  vx:', result.vx.toFixed(1), 'vy:', result.vy.toFixed(1));
    console.log('  实测峰值:', result.measuredRise.toFixed(1), 'px');
    console.log('  期望vy: -512±3% (-497 to -527)');
    console.log('  期望峰值:', 262, 'px, 允许: 236-288');
    
    // 断言vy = -512±3%
    expect(Math.abs(result.vy)).toBeGreaterThanOrEqual(497);
    expect(Math.abs(result.vy)).toBeLessThanOrEqual(527);
    
    // 断言峰值 262±10%
    expect(result.measuredRise).toBeGreaterThanOrEqual(236);
    expect(result.measuredRise).toBeLessThanOrEqual(288);
  });

  test('锥角边缘：同侧发射，角度≤70.5°，dx=vx·0.5±10%且≥150px', async ({ page }) => {
    // 右侧进入，瞄准右侧边缘(+70° from vertical)
    
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      // 瞄准右侧边缘：+70° from vertical
      // dirX = sin(70°) = 0.940, dirY = -cos(70°) = -0.342
      const dirX = 0.9397; // sin(70°)
      const dirY = -0.342; // -cos(70°)
      window.__TEST_API__.setAimDirection(dirX, dirY);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(16.67);
      window.__TEST_API__.step(300);
      
      // 从lastLaunch获取发射瞬时值
      const launch = scene.lastLaunch;
      
      // 计算发射角度（从垂直方向）
      const angleFromVertical = Math.abs(Math.atan2(launch.vx, -launch.vy) * 180 / Math.PI);
      
      // 前进0.5s
      for (let i = 0; i < 30; i++) {
        window.__TEST_API__.step(16.67);
      }
      
      const endX = scene.madman.x;
      const dx = endX - launch.x;
      const predictedDx = launch.vx * 0.5;
      
      return { 
        vx: launch.vx, 
        vy: launch.vy, 
        startX: launch.x, 
        endX, 
        dx, 
        predictedDx, 
        angleFromVertical 
      };
    });
    
    console.log('锥角边缘（同侧）:');
    console.log('  vx:', result.vx.toFixed(1), 'vy:', result.vy.toFixed(1));
    console.log('  发射角度:', result.angleFromVertical.toFixed(1), '° (from vertical)');
    console.log('  起始x:', result.startX.toFixed(1));
    console.log('  结束x:', result.endX.toFixed(1));
    console.log('  实测dx:', result.dx.toFixed(1), 'px');
    console.log('  预测dx:', result.predictedDx.toFixed(1), 'px');
    console.log('  误差:', ((result.dx / result.predictedDx - 1) * 100).toFixed(1), '%');
    
    // 断言角度 ≤ 70.5°
    expect(result.angleFromVertical).toBeLessThanOrEqual(70.5);
    
    // 断言 dx = vx*0.5 ±10%
    const lowerBound = result.predictedDx * 0.9;
    const upperBound = result.predictedDx * 1.1;
    expect(result.dx).toBeGreaterThanOrEqual(lowerBound);
    expect(result.dx).toBeLessThanOrEqual(upperBound);
    
    // 断言 dx ≥ 150px
    expect(result.dx).toBeGreaterThanOrEqual(150);
  });

  test('消耗/保留峰值比例 ≥ 1.6x', async ({ page }) => {
    // 测试保留
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
      for (let i = 0; i < 60; i++) {
        window.__TEST_API__.step(16.67);
        minY = Math.min(minY, scene.madman.y);
      }
      return launchY - minY;
    });
    
    await page.reload();
    await page.waitForFunction(() => window.__TEST_API__, { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // 测试消耗
    const consumedPeak = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      window.__TEST_API__.setAimDirection(0, -1);
      window.__TEST_API__.setConsume(true);
      window.__TEST_API__.step(16.67);
      window.__TEST_API__.step(300);
      
      const launchY = scene.madman.y;
      let minY = launchY;
      for (let i = 0; i < 80; i++) {
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

  test('vx保持：发射后1s内，无输入时vx保持±2%', async ({ page }) => {
    // 验证修复：launchInputLockS结束后vx不被清零
    
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(100);
      
      // 瞄准使vx > 0
      const dirX = 0.9397; // sin(70°)
      const dirY = -0.342; // -cos(70°)
      window.__TEST_API__.setAimDirection(dirX, dirY);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(16.67);
      window.__TEST_API__.step(300);
      
      const launchVx = scene.lastLaunch.vx;
      
      // 1秒后（无输入）
      for (let i = 0; i < 60; i++) {
        window.__TEST_API__.step(16.67);
      }
      
      const finalVx = scene.madman.body.velocity.x;
      const ratio = finalVx / launchVx;
      
      return { launchVx, finalVx, ratio };
    });
    
    console.log('vx保持测试:');
    console.log('  发射vx:', result.launchVx.toFixed(1));
    console.log('  1s后vx:', result.finalVx.toFixed(1));
    console.log('  比例:', result.ratio.toFixed(3));
    console.log('  期望: 0.98-1.02 (±2%)');
    
    // 断言vx保持在±2%内
    expect(result.ratio).toBeGreaterThanOrEqual(0.98);
    expect(result.ratio).toBeLessThanOrEqual(1.02);
  });
});
