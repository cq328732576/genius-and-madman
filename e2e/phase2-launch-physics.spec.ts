/**
 * Phase 2 发射物理测试
 * 验证发射后的真实飞行物理（基于实测速度）
 */
import { test, expect } from '@playwright/test';

test.describe('Phase 2 发射物理验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?level=testLevel', { waitUntil: 'networkidle' });
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

  test('发射速度：保留512±3% px/s, 消耗691±3% px/s', async ({ page }) => {
    // 从lastLaunch读取发射瞬时速度，未受重力影响
    // 保留: 16 u/s × 32 = 512 px/s
    // 消耗: 16 × 1.35 × 32 = 691 px/s
    
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
      
      const launch = scene.lastLaunch;
      const speed = Math.sqrt(launch.vx * launch.vx + launch.vy * launch.vy);
      return { vx: launch.vx, vy: launch.vy, speed };
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
      
      const launch = scene.lastLaunch;
      const speed = Math.sqrt(launch.vx * launch.vx + launch.vy * launch.vy);
      return { vx: launch.vx, vy: launch.vy, speed };
    });
    
    console.log('保留发射速度:');
    console.log('  vx:', keptResult.vx.toFixed(1), 'vy:', keptResult.vy.toFixed(1));
    console.log('  |v|:', keptResult.speed.toFixed(1), 'px/s');
    console.log('  期望: 512 ±3% (497-527 px/s)');
    
    console.log('消耗发射速度:');
    console.log('  vx:', consumedResult.vx.toFixed(1), 'vy:', consumedResult.vy.toFixed(1));
    console.log('  |v|:', consumedResult.speed.toFixed(1), 'px/s');
    console.log('  期望: 691 ±3% (671-711 px/s)');
    
    const ratio = consumedResult.speed / keptResult.speed;
    
    console.log('消耗/保留比例:', ratio.toFixed(3));
    console.log('  期望:', 1.35, '±4%: 1.30-1.40');
    
    // 断言保留速度 512±3%
    expect(keptResult.speed).toBeGreaterThanOrEqual(497);
    expect(keptResult.speed).toBeLessThanOrEqual(527);
    
    // 断言消耗速度 691±3%
    expect(consumedResult.speed).toBeGreaterThanOrEqual(671);
    expect(consumedResult.speed).toBeLessThanOrEqual(711);
    
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
    // 在x=500 y=600测试，上方有600px空旷空间
    
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 水平吸附，放在platform1和platform2之间的空旷区域
      window.__TEST_API__.placeAnchorAt(500 / 32, 600 / 32);
      scene.madman.setPosition(385, 600);
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
      const body = scene.madman.body;
      
      // 采样80帧找峰值，记录关键帧
      let minY = launch.y;
      let apexFrame = 0;
      const logs: string[] = [];
      let hitCeiling = false;
      
      for (let i = 0; i < 80; i++) {
        window.__TEST_API__.step(16.67);
        const y = scene.madman.y;
        const vy = body.velocity.y;
        const blockedUp = body.blocked.up;
        const touchingUp = body.touching.up;
        
        if (y < minY) {
          minY = y;
          apexFrame = i + 1;
        }
        
        // 记录关键帧：前5帧，穿越y=0，每10帧，以及vy变号附近
        const shouldLog = i < 5 || 
                         (i % 10 === 0) || 
                         (Math.abs(vy) < 50 && vy >= 0) ||
                         blockedUp || touchingUp;
        
        if (shouldLog) {
          logs.push(`[${i+1}] y=${y.toFixed(1)} vy=${vy.toFixed(1)} blocked.up=${blockedUp} touching.up=${touchingUp}`);
        }
        
        if (blockedUp || touchingUp) {
          hitCeiling = true;
        }
      }
      
      const measuredRise = launch.y - minY;
      const predictedApexTime = Math.abs(launch.vy) / 500;
      const predictedApexFrame = Math.round(predictedApexTime / 0.01667);
      
      return { 
        vx: launch.vx, 
        vy: launch.vy, 
        launchX: launch.x,
        launchY: launch.y, 
        minY, 
        measuredRise,
        apexFrame,
        predictedApexFrame,
        logs: logs.join('\n'),
        hitCeiling
      };
    });
    
    console.log('保留峰值（垂直进入）:');
    console.log('  发射点:', `x=${result.launchX.toFixed(1)} y=${result.launchY.toFixed(1)}`);
    console.log('  vx:', result.vx.toFixed(1), 'vy:', result.vy.toFixed(1));
    console.log('  峰值帧:', result.apexFrame, '预测:', result.predictedApexFrame);
    console.log('  实测峰值:', result.measuredRise.toFixed(1), 'px');
    console.log('  期望vy: -512±3% (-497 to -527)');
    console.log('  期望峰值:', 262, 'px, 允许: 236-288');
    console.log('  撞顶?', result.hitCeiling);
    console.log('\n逐帧日志:');
    console.log(result.logs);
    
    // 断言vy = -512±3%
    expect(Math.abs(result.vy)).toBeGreaterThanOrEqual(497);
    expect(Math.abs(result.vy)).toBeLessThanOrEqual(527);
    
    // 断言未撞顶
    expect(result.hitCeiling).toBe(false);
    
    // 断言峰值 262±10%
    expect(result.measuredRise).toBeGreaterThanOrEqual(236);
    expect(result.measuredRise).toBeLessThanOrEqual(288);
  });

  test('锥角边缘：同侧发射，角度≤70.5°，dx=vx·0.5±12%且≥150px', async ({ page }) => {
    // 右侧进入，瞄准右侧边缘(+70° from vertical)
    // 注：±12%容差考虑离散步进的帧对齐误差
    
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
      
      // 前进恰好30步(0.5s)
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
    
    // 断言 dx = vx*0.5 ±12% (离散步进)
    const lowerBound = result.predictedDx * 0.88;
    const upperBound = result.predictedDx * 1.12;
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

  test('vx保持：发射后0.6s空中时，无输入时vx保持±2%', async ({ page }) => {
    // 验证修复：launchInputLockS结束后vx不被清零
    // 在落地前(0.55-0.65s)采样
    // 从右向左发射，避免撞墙
    
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      // 从右侧向左发射，避免撞右墙(x=1200)
      window.__TEST_API__.placeAnchorAt(1100 / 32, 768 / 32);
      scene.madman.setPosition(1215, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('left');
      window.__TEST_API__.step(100);
      
      // 瞄准左侧70°，使vx < 0
      const dirX = -0.9397; // -sin(70°) 向左
      const dirY = -0.342; // -cos(70°)
      window.__TEST_API__.setAimDirection(dirX, dirY);
      window.__TEST_API__.setConsume(false);
      window.__TEST_API__.step(16.67);
      window.__TEST_API__.step(300);
      
      const launchVx = scene.lastLaunch.vx;
      
      // 前进到0.6s（36帧），记录关键帧
      const logs: string[] = [];
      for (let i = 0; i < 36; i++) {
        window.__TEST_API__.step(16.67);
        if (i === 29 || i === 30 || i === 35) {
          logs.push(`[${i+1}] vx=${scene.madman.body.velocity.x.toFixed(1)} launchAirTime=${scene.launchAirTime.toFixed(3)} blocked.down=${scene.madman.body.blocked.down}`);
        }
      }
      
      const body = scene.madman.body;
      const airborneVx = body.velocity.x;
      const isAirborne = !body.blocked.down;
      const airborneRatio = airborneVx / launchVx;
      const launchAirTime = scene.launchAirTime;
      
      // 继续到落地
      let landingFrame = -1;
      for (let i = 0; i < 30; i++) {
        window.__TEST_API__.step(16.67);
        if (body.blocked.down && landingFrame === -1) {
          landingFrame = i + 37; // 36帧到0.6s + 当前帧
          logs.push(`[${landingFrame}] LANDED launchAirTime=${scene.launchAirTime.toFixed(3)}`);
        }
        if (landingFrame > 0 && i > landingFrame - 37 + 3) break; // 落地后3帧
      }
      
      const landedVx = body.velocity.x;
      const isLanded = body.blocked.down;
      const landedLaunchAirTime = scene.launchAirTime;
      
      return { 
        launchVx, 
        airborneVx, 
        isAirborne, 
        airborneRatio,
        landedVx,
        isLanded,
        launchAirTime,
        landedLaunchAirTime,
        logs: logs.join('\n')
      };
    });
    
    console.log('vx保持测试:');
    console.log('  发射vx:', result.launchVx.toFixed(1));
    console.log('  0.6s空中vx:', result.airborneVx.toFixed(1), 'blocked.down:', !result.isAirborne);
    console.log('  空中比例:', result.airborneRatio.toFixed(3));
    console.log('  落地后vx:', result.landedVx.toFixed(1), 'blocked.down:', result.isLanded);
    console.log('  期望空中: 0.98-1.02 (±2%), 落地后: 0');
    console.log('  launchAirTime在0.6s:', result.launchAirTime.toFixed(3));
    console.log('  launchAirTime落地后:', result.landedLaunchAirTime.toFixed(3));
    console.log('\n关键帧日志:');
    console.log(result.logs);
    
    // 断言0.6s时仍在空中
    expect(result.isAirborne).toBe(true);
    
    // 断言空中vx保持在±2%内
    expect(result.airborneRatio).toBeGreaterThanOrEqual(0.98);
    expect(result.airborneRatio).toBeLessThanOrEqual(1.02);
    
    // 断言落地后vx归零（正确的地面行为）
    expect(result.isLanded).toBe(true);
    expect(Math.abs(result.landedVx)).toBeLessThan(5);
  });
});
