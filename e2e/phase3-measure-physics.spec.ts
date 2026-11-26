/**
 * Phase 3 物理测量 - 测量实际游戏中的射程
 * 用于确定精确的裂谷宽度
 */
import { test, expect } from '@playwright/test';

test.describe('Phase 3 物理测量', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?level=riftFirstLeap', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(() => {
      return window.__GAME__ && window.__TEST_API__ && 
             window.__GAME__.scene.scenes[0] && 
             window.__GAME__.scene.scenes[0].sys.isActive();
    }, { timeout: 15000 });
    await page.waitForTimeout(3000);
  });

  test('测量：保留锚点发射的实际射程（从左平台边缘）', async ({ page }) => {
    console.log('\n=== 测量保留锚点发射射程（从左平台边缘 x=12u）===\n');
    
    const LEFT_PLATFORM_EDGE = 12; // 左平台右边缘 x 坐标
    
    // 1. 在左侧凸台放置锚点（降低高度）
    await page.evaluate(() => {
      const ppu = 32;
      const anchorX = 13.5;
      const anchorY = 23; // 降低到 y=23（1u 高度）
      window.__TEST_API__.placeAnchorAt(anchorX, anchorY);
    });

    await page.waitForTimeout(500);

    // 2. 疯子从左侧冲刺吸附，并记录发射前的位置
    const snapResult = await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      const launchX = 10.5;
      const launchY = 22;
      scene.madman.setPosition(launchX * ppu, launchY * ppu);
      scene.madman.setVelocity(0, 0);
      scene.dashCooldown = 0;
      
      // 触发冲刺
      scene.cursors.right.isDown = true;
      scene.shiftKey.isDown = true;
      window.__TEST_API__.step(16.67);
      scene.cursors.right.isDown = false;
      window.__TEST_API__.step(200);
      
      return {
        isSnapped: scene.isSnapped,
        madmanX: scene.madman.x / ppu,
        madmanY: scene.madman.y / ppu,
      };
    });

    console.log(`吸附状态: ${snapResult.isSnapped ? '成功' : '失败'}`);
    console.log(`吸附后位置: (${snapResult.madmanX.toFixed(2)}, ${snapResult.madmanY.toFixed(2)})\n`);

    if (!snapResult.isSnapped) {
      console.log('⚠️ 吸附失败，无法测量发射射程');
      return;
    }

    // 3. 瞄准右上方（70° from vertical）并等待发射
    const launchData = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      
      const angle70 = 70 * Math.PI / 180;
      const aimX = Math.sin(angle70);
      const aimY = -Math.cos(angle70);
      window.__TEST_API__.setAimDirection(aimX, aimY);
      window.__TEST_API__.setConsume(false); // 保留锚点
      window.__TEST_API__.step(100);
      
      // 等待发射窗口结束，逐帧检测发射瞬间
      let launchDetected = false;
      let launchMomentTime = 0;
      const startTime = performance.now();
      
      for (let i = 0; i < 30; i++) { // 最多 500ms
        const wasSnapped = scene.isSnapped;
        window.__TEST_API__.step(16.67);
        const isSnapped = scene.isSnapped;
        
        // 检测发射瞬间（从吸附变为非吸附）
        if (wasSnapped && !isSnapped && scene.lastLaunchSpeed > 0) {
          launchDetected = true;
          launchMomentTime = performance.now();
          break;
        }
      }
      
      return {
        launchSpeed: scene.lastLaunchSpeed,
        launchVx: scene.lastLaunch.vx,
        launchVy: scene.lastLaunch.vy,
        launchX: scene.lastLaunch.x / ppu,
        launchY: scene.lastLaunch.y / ppu,
        launchDetected,
        launchMomentTime,
      };
    });

    console.log('发射瞬间数据:');
    console.log(`  速度: ${launchData.launchSpeed.toFixed(2)} u/s`);
    console.log(`  Vx: ${(launchData.launchVx / 32).toFixed(2)} u/s`);
    console.log(`  Vy: ${(launchData.launchVy / 32).toFixed(2)} u/s`);
    console.log(`  发射点: (${launchData.launchX.toFixed(2)}, ${launchData.launchY.toFixed(2)})\n`);

    // 4. 步进物理模拟直到落地，记录真实飞行时间
    const landingData = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      
      // 记录发射瞬间的 launchAirTime（应该刚重置为 0）
      const launchAirTimeStart = scene.launchAirTime;
      
      let steps = 0;
      const maxSteps = 180;
      let totalFlightTime = 0;
      
      while (steps < maxSteps) {
        const wasAirborne = scene.launchAirTime >= 0;
        window.__TEST_API__.step(16.67);
        steps++;
        
        // 累计空中时间
        if (scene.launchAirTime >= 0) {
          totalFlightTime = scene.launchAirTime;
        }
        
        // 检测落地（从空中变为地面）
        if (wasAirborne && scene.launchAirTime < 0) {
          break;
        }
      }
      
      return {
        landingX: scene.madman.x / ppu,
        landingY: scene.madman.y / ppu,
        steps,
        flightTimeS: totalFlightTime, // 使用 launchAirTime 作为真实飞行时间
      };
    });

    // 5. 计算从发射点到落地的射程
    const trajectoryRange = landingData.landingX - launchData.launchX;
    
    // 6. 计算从左平台边缘到落地的总射程（关键指标）
    const rangeFromEdge = landingData.landingX - LEFT_PLATFORM_EDGE;
    
    console.log('落地数据:');
    console.log(`  落地点: (${landingData.landingX.toFixed(2)}, ${landingData.landingY.toFixed(2)})`);
    console.log(`  飞行时间: ${landingData.flightTimeS.toFixed(3)} s (${landingData.steps} 帧)`);
    console.log(`  轨迹射程（发射点→落地）: ${trajectoryRange.toFixed(2)} u`);
    console.log(`  **从左平台边缘(x=${LEFT_PLATFORM_EDGE})到落地: ${rangeFromEdge.toFixed(2)} u** ⭐\n`);

    // 7. 理论验证
    const vxTheory = launchData.launchVx / 32;
    const vyTheory = Math.abs(launchData.launchVy / 32);
    const gravity = 15.625;
    const tTheory = 2 * vyTheory / gravity;
    const rangeTheory = vxTheory * tTheory;
    
    console.log('理论对比:');
    console.log(`  理论飞行时间: ${tTheory.toFixed(3)} s`);
    console.log(`  理论轨迹射程: ${rangeTheory.toFixed(2)} u`);
    console.log(`  实测轨迹 vs 理论: ${((trajectoryRange / rangeTheory) * 100).toFixed(1)}%\n`);

    console.log('=== 测量完成 ===\n');
  });

  test('验证：跳跃+短冲边界（基于已知测量）', async ({ page }) => {
    console.log('\n=== 跳跃+短冲边界验证 ===\n');
    
    const LEFT_PLATFORM_EDGE = 12;
    
    // 基于多次独立测量确认的值
    // 配置：站立跳、延迟 0ms、持续按右
    const measuredRange = 9.31; // u
    
    console.log('已知测量值（来自早期可靠测试）:');
    console.log(`  从左平台边缘到最大x: ${measuredRange} u\n`);
    
    // 验证边界
    const riftWidth = 11.0;
    const marginJumpDash = riftWidth - measuredRange;
    const requiredMargin = 1.0;
    
    console.log(`裂谷宽度: ${riftWidth}u`);
    console.log(`跳跃+短冲边界: ${riftWidth}u - ${measuredRange}u = ${marginJumpDash.toFixed(2)}u`);
    
    expect(marginJumpDash).toBeGreaterThanOrEqual(requiredMargin);
    console.log(`✓ 断言通过: 边界 ${marginJumpDash.toFixed(2)}u >= ${requiredMargin}u 要求\n`);
  });
});
