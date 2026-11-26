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

    // 3. 瞄准右上方（70° from vertical）并记录发射瞬间位置
    const launchData = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      
      const angle70 = 70 * Math.PI / 180;
      const aimX = Math.sin(angle70);
      const aimY = -Math.cos(angle70);
      window.__TEST_API__.setAimDirection(aimX, aimY);
      window.__TEST_API__.setConsume(false); // 保留锚点
      window.__TEST_API__.step(100);
      
      // 等待发射窗口结束，记录发射瞬间数据
      window.__TEST_API__.step(500);
      
      return {
        launchSpeed: scene.lastLaunchSpeed,
        launchVx: scene.lastLaunch.vx,
        launchVy: scene.lastLaunch.vy,
        launchX: scene.lastLaunch.x / ppu,
        launchY: scene.lastLaunch.y / ppu,
      };
    });

    console.log('发射瞬间数据:');
    console.log(`  速度: ${launchData.launchSpeed.toFixed(2)} u/s`);
    console.log(`  Vx: ${(launchData.launchVx / 32).toFixed(2)} u/s`);
    console.log(`  Vy: ${(launchData.launchVy / 32).toFixed(2)} u/s`);
    console.log(`  发射点: (${launchData.launchX.toFixed(2)}, ${launchData.launchY.toFixed(2)})\n`);

    // 4. 步进物理模拟直到落地
    const landingData = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      
      let steps = 0;
      const maxSteps = 180;
      
      while (steps < maxSteps) {
        const wasAirborne = scene.launchAirTime >= 0;
        window.__TEST_API__.step(16.67);
        steps++;
        
        if (wasAirborne && scene.launchAirTime < 0) {
          break;
        }
      }
      
      return {
        landingX: scene.madman.x / ppu,
        landingY: scene.madman.y / ppu,
        steps,
        flightTimeS: (steps * 16.67) / 1000,
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

  test('测量：跳跃+短冲的最大水平距离（从左平台边缘）', async ({ page }) => {
    console.log('\n=== 测量跳跃+短冲最大距离（从左平台边缘 x=12u）===\n');
    
    const LEFT_PLATFORM_EDGE = 12;
    
    // 1. 将疯子放在左平台右边缘
    const startData = await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      const startX = 12; // 左平台右边缘
      const startY = 23.5; // 平台表面上方
      
      scene.madman.setPosition(startX * ppu, startY * ppu);
      scene.madman.setVelocity(0, 0);
      scene.dashCooldown = 0;
      
      return { startX, startY };
    });

    console.log(`起始位置（平台边缘）: (${startData.startX.toFixed(2)}, ${startData.startY.toFixed(2)})\n`);

    // 2. 执行跳跃+短冲组合，记录最大到达点
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      const deathY = 30;
      const startX = 12;
      
      // 跳跃
      scene.cursors.up.isDown = true;
      scene.cursors.right.isDown = true;
      window.__TEST_API__.step(16.67);
      scene.cursors.up.isDown = false;
      
      // 等待一点
      window.__TEST_API__.step(100);
      
      // 短冲刺
      scene.dashCooldown = 0;
      scene.cursors.right.isDown = true;
      scene.shiftKey.isDown = true;
      window.__TEST_API__.step(16.67);
      scene.shiftKey.isDown = false;
      
      // 步进并记录最大x
      let maxX = scene.madman.x / ppu;
      let maxXY = scene.madman.y / ppu;
      let steps = 0;
      const maxSteps = 240;
      
      let hasLanded = false;
      
      while (steps < maxSteps) {
        // 不继续按右键，只让物理运行
        window.__TEST_API__.step(16.67);
        
        const x = scene.madman.x / ppu;
        const y = scene.madman.y / ppu;
        
        // 只在空中时更新 maxX
        if (!hasLanded && x > maxX) {
          maxX = x;
          maxXY = y;
        }
        
        // 检查死亡区
        if (y > deathY) {
          break;
        }
        
        // 检查第一次落地
        if (!hasLanded && scene.madman.body.blocked.down) {
          hasLanded = true;
          // 记录落地时的 x 作为最终 maxX
          maxX = x;
          maxXY = y;
          break; // 落地后停止测量
        }
        
        steps++;
      }
      
      return {
        startX,
        maxX,
        maxXY,
        rangeFromEdge: maxX - startX,
        finalY: scene.madman.y / ppu,
        steps,
        respawned: scene.madman.x / ppu < 10,
      };
    });

    console.log('结果:');
    console.log(`  起始 x（边缘）: ${result.startX.toFixed(2)} u`);
    console.log(`  最大到达 x: ${result.maxX.toFixed(2)} u (y=${result.maxXY.toFixed(2)})`);
    console.log(`  **从左平台边缘(x=${LEFT_PLATFORM_EDGE})到最大x: ${result.rangeFromEdge.toFixed(2)} u** ⭐`);
    console.log(`  最终 y: ${result.finalY.toFixed(2)} u`);
    console.log(`  是否重生: ${result.respawned ? '是（掉入裂谷）' : '否'}\n`);

    console.log('=== 测量完成 ===\n');
    
    // 验证边界
    const riftWidth = 10.0;
    const rightPlatformEdge = 22; // 左边缘(12) + 裂谷(10) = 22
    expect(result.rangeFromEdge).toBeLessThan(riftWidth); // 跳跃+短冲无法跨越
    expect(result.maxX).toBeLessThan(rightPlatformEdge); // 未到达右平台
    console.log(`✓ 断言: 跳跃+短冲 ${result.rangeFromEdge.toFixed(2)}u < 裂谷${riftWidth}u，未到达右平台边缘(x=${rightPlatformEdge})\n`);
  });
});
