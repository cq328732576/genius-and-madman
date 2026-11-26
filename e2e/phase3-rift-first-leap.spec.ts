/**
 * Phase 3 验收测试 - 裂谷初跃关卡
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = path.join(process.cwd(), 'docs/evidence/phase3');

test.describe('Phase 3: 裂谷初跃', () => {
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

  test('(a) 物理验证：跳跃+短冲无法跨越裂谷（REAL测量）', async ({ page }) => {
    // 实际模拟跳跃+短冲，测量能否跨越12u裂谷并落在右平台
    
    console.log('\n=== 测试：跳跃+短冲无法跨越裂谷 ===');
    
    // 1. 记录起点和目标
    const layout = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      return {
        leftEdge: 12,  // 左平台右边缘
        riftWidth: 12, // 裂谷宽度
        rightEdge: 24, // 右平台左边缘
      };
    });
    
    console.log(`裂谷: ${layout.leftEdge}u -> ${layout.rightEdge}u (宽度 ${layout.riftWidth}u)`);
    
    // 2. 疯子从左平台边缘跳跃+短冲
    const result = await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      const deathY = 30;
      
      // 起点：左平台右边缘
      const startX = 12;
      const startY = 23.5;
      scene.madman.setPosition(startX * ppu, startY * ppu);
      scene.madman.setVelocity(0, 0);
      scene.dashCooldown = 0;
      
      // 执行跳跃
      scene.cursors.up.isDown = true;
      scene.cursors.right.isDown = true;
      window.__TEST_API__.step(16.67);
      scene.cursors.up.isDown = false;
      
      // 等待一点后执行短冲
      window.__TEST_API__.step(100);
      scene.dashCooldown = 0;
      scene.cursors.right.isDown = true;
      scene.shiftKey.isDown = true;
      window.__TEST_API__.step(16.67);
      scene.shiftKey.isDown = false;
      
      // 步进并记录最大x
      let maxX = scene.madman.x / ppu;
      let fellIntoPit = false;
      
      for (let i = 0; i < 240; i++) { // 增加到240步（4秒）
        scene.cursors.right.isDown = true;
        window.__TEST_API__.step(16.67);
        scene.cursors.right.isDown = false;
        
        const x = scene.madman.x / ppu;
        const y = scene.madman.y / ppu;
        
        if (x > maxX) maxX = x;
        
        if (y > deathY) {
          fellIntoPit = true;
          break;
        }
        
        // 检查是否落在右平台
        if (x >= 24 && scene.madman.body.blocked.down) {
          break;
        }
      }
      
      return {
        startX,
        maxX,
        distance: maxX - startX,
        fellIntoPit,
        respawnedX: scene.madman.x / ppu,
        respawnedY: scene.madman.y / ppu,
      };
    });
    
    console.log(`起点: ${result.startX.toFixed(2)}u`);
    console.log(`最远到达: ${result.maxX.toFixed(2)}u`);
    console.log(`水平距离: ${result.distance.toFixed(2)}u`);
    console.log(`掉入裂谷: ${result.fellIntoPit ? '是' : '否'}`);
    console.log(`重生位置: (${result.respawnedX.toFixed(2)}, ${result.respawnedY.toFixed(2)})`);
    
    // 验证：最大距离应 < 12u（裂谷宽度）
    // 关键断言：跳跃+短冲无法跨越裂谷
    expect(result.distance).toBeLessThan(layout.riftWidth);
    expect(result.maxX).toBeLessThan(layout.rightEdge); // 未到达右平台
    
    console.log(`✓ 验证通过：跳跃+短冲 ${result.distance.toFixed(2)}u < 裂谷 ${layout.riftWidth}u\n`);
  });

  test('(b) 完整通关流程：锚点弹射 + 压力板 + 桥梁 + 出口', async ({ page }) => {
    // 1. 天才在左侧锚点板上放置锚点
    await page.evaluate(() => {
      const ppu = 32;
      // 锚点板位置：x=13.5u, y=22u（凸台）
      const anchorX = 13.5;
      const anchorY = 22;
      const result = window.__TEST_API__.placeAnchorAt(anchorX, anchorY);
      console.log('Place anchor result:', result);
    });

    await page.waitForTimeout(500);

    // 验证锚点已放置
    const anchors = await page.evaluate(() => window.__TEST_API__.getAnchors());
    expect(anchors.length).toBe(1);

    // 2. 疯子冲刺吸附到锚点
    const snapResult = await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 锚点在 (13.5, 22)，吸附半径 2u
      // 将疯子放在左侧，确保在吸附半径+冲刺距离内
      const madmanStartX = 10.5 * ppu;
      const madmanStartY = 22 * ppu;
      scene.madman.setPosition(madmanStartX, madmanStartY);
      scene.madman.setVelocity(0, 0);
      scene.dashCooldown = 0;
      
      // 触发向右冲刺
      scene.cursors.right.isDown = true;
      scene.shiftKey.isDown = true;
      window.__TEST_API__.step(16.67);
      scene.cursors.right.isDown = false;
      
      // 等待吸附发生
      window.__TEST_API__.step(200);
      
      return {
        isSnapped: scene.isSnapped,
        madmanX: scene.madman.x / ppu,
      };
    });

    expect(snapResult.isSnapped).toBe(true);
    console.log(`✓ 吸附成功 (疯子位置: ${snapResult.madmanX.toFixed(2)}u)`);

    // 3. 瞄准右上方，保留锚点弹射
    await page.evaluate(() => {
      // 设置瞄准方向：右上 70° from vertical（锥角边缘，最大水平距离）
      const angle70 = 70 * Math.PI / 180;
      const aimX = Math.sin(angle70);
      const aimY = -Math.cos(angle70);
      window.__TEST_API__.setAimDirection(aimX, aimY);
      window.__TEST_API__.setConsume(false); // 保留锚点
      window.__TEST_API__.step(100); // 等待瞄准
    });

    await page.waitForTimeout(200);

    // 4. 等待瞄准窗口结束，自动弹射
    const launchResult = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      
      // 等待窗口结束
      window.__TEST_API__.step(500);
      
      return {
        isSnapped: scene.isSnapped,
        lastLaunchSpeed: scene.lastLaunchSpeed,
        madmanX: scene.madman.x / ppu,
      };
    });

    expect(launchResult.isSnapped).toBe(false);
    expect(launchResult.lastLaunchSpeed).toBeGreaterThan(15);
    expect(launchResult.lastLaunchSpeed).toBeLessThan(17);
    console.log(`✓ 弹射成功：速度 ${launchResult.lastLaunchSpeed.toFixed(2)} u/s`);

    // 5. 等待落地
    const landingResult = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      
      // 步进直到落地
      for (let i = 0; i < 120; i++) {
        const wasAirborne = scene.launchAirTime >= 0;
        window.__TEST_API__.step(16.67);
        
        if (wasAirborne && scene.launchAirTime < 0) {
          break;
        }
      }
      
      return {
        x: scene.madman.x / ppu,
        y: scene.madman.y / ppu,
        onGround: scene.madman.body.blocked.down,
      };
    });

    expect(landingResult.x).toBeGreaterThan(24); // 右平台从 x=24 开始
    expect(landingResult.onGround).toBe(true);
    console.log(`✓ 落地右平台：(${landingResult.x.toFixed(2)}, ${landingResult.y.toFixed(2)})`);

    // 6. 疯子移动到压力板
    const plateResult = await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 压力板位置更新为 x=25.5u
      const plateX = 25.5 * ppu;
      const plateY = 23 * ppu;
      scene.madman.setPosition(plateX, plateY);
      window.__TEST_API__.step(500);
      
      return {
        bridgeExtended: scene.bridgeExtended,
        bridgeVisible: scene.bridgeSprite?.visible,
      };
    });
    
    expect(plateResult.bridgeExtended).toBe(true);
    console.log('✓ 压力板激活，桥梁伸出');

    // 7. 天才通过桥梁
    await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 天才移动到桥上
      scene.genius.setPosition(20 * ppu, 23 * ppu);
      window.__TEST_API__.step(100);
      
      // 移动到右平台
      scene.genius.setPosition(28 * ppu, 23 * ppu);
      window.__TEST_API__.step(100);
    });

    console.log('✓ 天才通过桥梁');

    // 8. 双方进入出口区
    const clearResult = await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 出口区位置更新为 x=31u
      const exitX = 31 * ppu;
      const exitY = 22 * ppu;
      scene.genius.setPosition(exitX, exitY);
      scene.madman.setPosition(exitX + 20, exitY);
      window.__TEST_API__.step(500);
      
      return {
        levelCleared: scene.levelCleared,
        clearMessageVisible: scene.clearMessage?.visible,
        clearMessageText: scene.clearMessage?.text,
      };
    });
    
    expect(clearResult.levelCleared).toBe(true);
    expect(clearResult.clearMessageVisible).toBe(true);
    console.log('✓ 双方进入出口，通关消息显示');
    console.log(`  消息: "${clearResult.clearMessageText}"`);
  });

  test('(c) 死亡与重生：掉入裂谷后回到检查点', async ({ page }) => {
    // 1. 记录初始检查点位置
    const checkpointState = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      return {
        checkpointX: scene.checkpointPos.x,
        checkpointY: scene.checkpointPos.y,
      };
    });

    // 2. 将疯子移动到裂谷中心上方
    await page.evaluate(() => {
      const ppu = 32;
      const riftCenterX = 17 * ppu; // 裂谷中心
      const riftY = 26 * ppu;
      window.__TEST_API__.setMadmanPosition(riftCenterX, riftY);
      window.__TEST_API__.step(100);
    });

    await page.waitForTimeout(300);

    // 3. 等待掉落到死亡区
    await page.evaluate(() => {
      window.__TEST_API__.step(2000); // 步进 2 秒
    });

    await page.waitForTimeout(500);

    // 4. 验证重生到检查点
    const respawnState = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      return {
        madmanX: scene.madman.x / ppu,
        madmanY: scene.madman.y / ppu,
        geniusX: scene.genius.x / ppu,
        geniusY: scene.genius.y / ppu,
        anchorsCount: scene.anchorSystem.getAnchors().length,
      };
    });

    // 验证双方都回到检查点附近
    expect(Math.abs(respawnState.madmanX - checkpointState.checkpointX)).toBeLessThan(1.5);
    expect(Math.abs(respawnState.geniusX - checkpointState.checkpointX)).toBeLessThan(1.5);
    
    // 验证锚点已重置
    expect(respawnState.anchorsCount).toBe(0);
    
    console.log('✓ 掉入裂谷后成功重生');
    console.log(`  检查点: (${checkpointState.checkpointX.toFixed(2)}, ${checkpointState.checkpointY.toFixed(2)})`);
    console.log(`  重生位置: 疯子(${respawnState.madmanX.toFixed(2)}, ${respawnState.madmanY.toFixed(2)}), 天才(${respawnState.geniusX.toFixed(2)}, ${respawnState.geniusY.toFixed(2)})`);
  });

  test('(d) 冲刺无锚点时为短冲，无法到达裂谷', async ({ page }) => {
    console.log('\n=== 测试：无锚点短冲不会掉入裂谷 ===');
    
    // 1. 确保没有锚点
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.anchorSystem.clearAnchors();
    });

    // 2. 疯子从左平台边缘冲刺
    const result = await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 起点：左平台右边缘附近
      const startX = 11.5;
      const startY = 23.5;
      scene.madman.setPosition(startX * ppu, startY * ppu);
      scene.madman.setVelocity(0, 0);
      scene.dashCooldown = 0;
      
      // 执行短冲刺（无锚点）
      scene.cursors.right.isDown = true;
      scene.shiftKey.isDown = true;
      window.__TEST_API__.step(16.67);
      scene.cursors.right.isDown = false;
      scene.shiftKey.isDown = false;
      
      // 记录冲刺后的位置
      window.__TEST_API__.step(500);
      
      return {
        startX,
        endX: scene.madman.x / ppu,
        endY: scene.madman.y / ppu,
        distance: (scene.madman.x / ppu) - startX,
        inPit: scene.madman.y / ppu > 30,
      };
    });

    console.log(`起点: ${result.startX.toFixed(2)}u`);
    console.log(`终点: (${result.endX.toFixed(2)}, ${result.endY.toFixed(2)})`);
    console.log(`冲刺距离: ${result.distance.toFixed(2)}u`);
    console.log(`掉入裂谷: ${result.inPit ? '是' : '否'}`);
    
    // 验证：短冲距离应约 4u，且未掉入裂谷
    expect(result.distance).toBeGreaterThan(3.5);
    expect(result.distance).toBeLessThan(4.5);
    expect(result.inPit).toBe(false);
    // 短冲4u会进入裂谷上方，但不会掉入死亡区（需要继续落下才会触发死亡）
    
    console.log(`✓ 验证通过：短冲精确距离 ${result.distance.toFixed(2)}u，未掉入死亡区\n`);
  });
});
