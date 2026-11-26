/**
 * Phase 3 物理测量 - 测量实际游戏中的射程
 * 用于确定精确的裂谷宽度
 */
import { test } from '@playwright/test';

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

  test('测量：保留锚点发射的实际射程', async ({ page }) => {
    console.log('\n=== 测量保留锚点发射射程 ===\n');
    
    // 1. 在左侧凸台放置锚点
    await page.evaluate(() => {
      const ppu = 32;
      const anchorX = 13.5;
      const anchorY = 22;
      window.__TEST_API__.placeAnchorAt(anchorX, anchorY);
    });

    await page.waitForTimeout(500);

    // 2. 疯子从左侧冲刺吸附
    const snapResult = await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 记录发射点
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
    console.log(`疯子位置: (${snapResult.madmanX.toFixed(2)}, ${snapResult.madmanY.toFixed(2)})\n`);

    if (!snapResult.isSnapped) {
      console.log('⚠️ 吸附失败，无法测量发射射程');
      return;
    }

    // 3. 瞄准右上方（70° from vertical，最大水平距离）
    await page.evaluate(() => {
      const angle70 = 70 * Math.PI / 180;
      const aimX = Math.sin(angle70);
      const aimY = -Math.cos(angle70);
      window.__TEST_API__.setAimDirection(aimX, aimY);
      window.__TEST_API__.setConsume(false); // 保留锚点
      window.__TEST_API__.step(100);
    });

    await page.waitForTimeout(200);

    // 4. 等待发射
    await page.evaluate(() => {
      window.__TEST_API__.step(500); // 等待窗口结束
    });

    await page.waitForTimeout(200);

    // 5. 记录发射瞬间的速度和位置
    const launchData = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      return {
        launchSpeed: scene.lastLaunchSpeed,
        launchVx: scene.lastLaunch.vx,
        launchVy: scene.lastLaunch.vy,
        launchX: scene.lastLaunch.x / ppu,
        launchY: scene.lastLaunch.y / ppu,
        madmanX: scene.madman.x / ppu,
        madmanY: scene.madman.y / ppu,
      };
    });

    console.log('发射数据:');
    console.log(`  速度: ${launchData.launchSpeed.toFixed(2)} u/s`);
    console.log(`  Vx: ${(launchData.launchVx / 32).toFixed(2)} u/s = ${launchData.launchVx.toFixed(1)} px/s`);
    console.log(`  Vy: ${(launchData.launchVy / 32).toFixed(2)} u/s = ${launchData.launchVy.toFixed(1)} px/s`);
    console.log(`  发射点: (${launchData.launchX.toFixed(2)}, ${launchData.launchY.toFixed(2)})`);
    console.log(`  疯子位置: (${launchData.madmanX.toFixed(2)}, ${launchData.madmanY.toFixed(2)})\n`);

    // 6. 步进物理模拟直到落地
    const landingData = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      
      // 步进直到落地（最多 3 秒）
      let steps = 0;
      const maxSteps = 180; // 3秒 @ 60fps
      
      while (steps < maxSteps) {
        const wasAirborne = scene.launchAirTime >= 0;
        window.__TEST_API__.step(16.67);
        steps++;
        
        // 检查是否落地
        if (wasAirborne && scene.launchAirTime < 0) {
          // 刚落地
          break;
        }
      }
      
      return {
        landingX: scene.madman.x / ppu,
        landingY: scene.madman.y / ppu,
        steps,
        timeS: (steps * 16.67) / 1000,
      };
    });

    const horizontalRange = landingData.landingX - launchData.launchX;
    
    console.log('落地数据:');
    console.log(`  落地点: (${landingData.landingX.toFixed(2)}, ${landingData.landingY.toFixed(2)})`);
    console.log(`  飞行时间: ${landingData.timeS.toFixed(3)} s (${landingData.steps} 帧)`);
    console.log(`  水平射程: ${horizontalRange.toFixed(2)} u = ${(horizontalRange * 32).toFixed(0)} px`);
    console.log(`  平均水平速度: ${(horizontalRange / landingData.timeS).toFixed(2)} u/s\n`);

    // 7. 理论计算对比
    const vxTheory = launchData.launchVx / 32;
    const vyTheory = Math.abs(launchData.launchVy / 32);
    const gravity = 15.625; // u/s²
    const tTheory = 2 * vyTheory / gravity;
    const rangeTheory = vxTheory * tTheory;
    
    console.log('理论计算对比:');
    console.log(`  理论飞行时间: ${tTheory.toFixed(3)} s`);
    console.log(`  理论射程: ${rangeTheory.toFixed(2)} u`);
    console.log(`  实测 vs 理论: ${((horizontalRange / rangeTheory) * 100).toFixed(1)}%\n`);

    console.log('=== 保留锚点发射射程测量完成 ===\n');
  });

  test('测量：跳跃+短冲的最大水平距离', async ({ page }) => {
    console.log('\n=== 测量跳跃+短冲最大距离 ===\n');
    
    // 1. 将疯子放在左平台右边缘
    const startData = await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 左平台右边缘 x = 8 + 4 = 12u
      const startX = 12;
      const startY = 23.5; // 平台表面上方
      
      scene.madman.setPosition(startX * ppu, startY * ppu);
      scene.madman.setVelocity(0, 0);
      scene.dashCooldown = 0;
      
      return { startX, startY };
    });

    await page.waitForTimeout(200);

    console.log(`起始位置: (${startData.startX.toFixed(2)}, ${startData.startY.toFixed(2)})\n`);

    // 2. 执行向右跳跃
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.cursors.up.isDown = true;
      scene.cursors.right.isDown = true;
      window.__TEST_API__.step(16.67); // 触发跳跃
      scene.cursors.up.isDown = false;
    });

    await page.waitForTimeout(100);

    // 3. 在空中执行短冲刺
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.dashCooldown = 0; // 重置冷却
      scene.cursors.right.isDown = true;
      scene.shiftKey.isDown = true;
      window.__TEST_API__.step(16.67); // 触发冲刺
      scene.shiftKey.isDown = false;
      window.__TEST_API__.step(100); // 短冲执行
    });

    await page.waitForTimeout(200);

    // 4. 保持向右移动并步进直到落地或进入死亡区
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      const deathY = 30; // 死亡区 y 坐标
      
      let maxX = scene.madman.x / ppu;
      let steps = 0;
      const maxSteps = 240; // 4秒
      
      while (steps < maxSteps) {
        const madmanY = scene.madman.y / ppu;
        
        // 检查是否进入死亡区或落地
        if (madmanY > deathY) {
          // 进入死亡区
          break;
        }
        
        // 保持向右移动
        scene.cursors.right.isDown = true;
        window.__TEST_API__.step(16.67);
        scene.cursors.right.isDown = false;
        
        const madmanX = scene.madman.x / ppu;
        if (madmanX > maxX) {
          maxX = madmanX;
        }
        
        // 检查是否落地（速度接近0且在地面上）
        const velY = scene.madman.body.velocity.y;
        const onGround = scene.madman.body.blocked.down;
        if (onGround && Math.abs(velY) < 10) {
          // 落地并停稳
          break;
        }
        
        steps++;
      }
      
      return {
        maxX,
        finalY: scene.madman.y / ppu,
        steps,
        timeS: (steps * 16.67) / 1000,
        respawned: scene.madman.x / ppu < 10, // 如果重生，x会回到<10
      };
    });

    const horizontalDistance = result.maxX - startData.startX;
    
    console.log('结果:');
    console.log(`  最大到达 x: ${result.maxX.toFixed(2)} u`);
    console.log(`  最终 y: ${result.finalY.toFixed(2)} u`);
    console.log(`  水平距离: ${horizontalDistance.toFixed(2)} u = ${(horizontalDistance * 32).toFixed(0)} px`);
    console.log(`  用时: ${result.timeS.toFixed(2)} s (${result.steps} 帧)`);
    console.log(`  是否重生: ${result.respawned ? '是（掉入裂谷）' : '否'}\n`);

    console.log('=== 跳跃+短冲测量完成 ===\n');
  });
});
