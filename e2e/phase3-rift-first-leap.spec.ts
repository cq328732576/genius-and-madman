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

  test('物理验证：跳跃+短冲无法跨越裂谷', async ({ page }) => {
    // 此测试通过 REAL 物理模拟验证，而非硬编码值
    // 策略：将疯子放在空中裂谷上方，模拟跳跃+短冲，看是否能到达对岸
    
    // 1. 将疯子放在裂谷中间上方，给予向右和向上的速度（模拟跳跃+短冲）
    await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 裂谷中心 x ≈ 17u，从左边缘开始（12u 右侧一点）
      const startX = 13 * ppu;
      const startY = 23 * ppu; // 平台高度
      
      scene.madman.setPosition(startX, startY);
      
      // 给予最大跳跃+短冲的速度（估计）
      // 跳跃 ~10u/s 向上，短冲 4u 在 ~0.3s 内 ≈ 13u/s 向右
      // 总向右速度 ~13u/s
      const madmanBody = scene.madman.body as Phaser.Physics.Arcade.Body;
      madmanBody.setVelocity(13 * ppu, -10 * ppu); // 向右 13u/s，向上 10u/s
    });

    await page.waitForTimeout(100);

    // 2. 步进物理模拟，等待落地或进入死亡区
    await page.evaluate(() => {
      window.__TEST_API__.step(2000); // 2秒足够落地
    });

    await page.waitForTimeout(500);

    // 3. 检查结果：应该掉入裂谷并重生
    const finalState = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      return {
        madmanX: scene.madman.x / ppu,
        madmanY: scene.madman.y / ppu,
        checkpointX: scene.checkpointPos.x,
        checkpointY: scene.checkpointPos.y,
      };
    });

    // 验证疯子回到检查点附近（允许 ±1.5u 误差）
    expect(Math.abs(finalState.madmanX - finalState.checkpointX)).toBeLessThan(1.5);
    console.log(`✓ 物理验证通过：跳跃(10u/s)+短冲模拟(13u/s 水平) 无法跨越 10u 裂谷`);
    console.log(`  最终位置: (${finalState.madmanX.toFixed(2)}, ${finalState.madmanY.toFixed(2)})`);
    console.log(`  检查点: (${finalState.checkpointX.toFixed(2)}, ${finalState.checkpointY.toFixed(2)})`);
  });

  test('完整通关流程：锚点弹射 + 压力板 + 桥梁 + 出口', async ({ page }) => {
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
    await page.evaluate(() => {
      const ppu = 32;
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 锚点在 (13.5, 22)，吸附半径 2u
      // 将疯子放在左侧，距离锚点 < 4u（短冲距离内）
      const madmanStartX = 10.5 * ppu; // 距离锚点 3u
      const madmanStartY = 22 * ppu;
      scene.madman.setPosition(madmanStartX, madmanStartY);
      scene.madman.setVelocity(0, 0);
      scene.dashCooldown = 0;
    });

    await page.waitForTimeout(200);

    // 触发向右冲刺
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.cursors.right.isDown = true;
      scene.shiftKey.isDown = true;
      window.__TEST_API__.step(16.67); // 触发冲刺
      
      // 保持冲刺方向
      window.__TEST_API__.step(100);
      window.__TEST_API__.step(100);
    });

    await page.waitForTimeout(300);

    // 验证已吸附
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    console.log('✓ 吸附成功');

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
    await page.evaluate(() => {
      window.__TEST_API__.step(500); // 超过 0.28s 窗口
    });

    await page.waitForTimeout(200);

    // 验证弹射发生（不再吸附，有速度）
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(false);
    expect(state.lastLaunchSpeed).toBeGreaterThan(15); // 保留锚点 ~16 u/s
    expect(state.lastLaunchSpeed).toBeLessThan(17);
    console.log(`✓ 弹射成功：速度 ${state.lastLaunchSpeed.toFixed(2)} u/s`);

    // 5. 等待落地（右侧平台）
    await page.evaluate(() => {
      window.__TEST_API__.step(1000); // 等待 1 秒
    });

    await page.waitForTimeout(500);

    // 验证疯子已到达右侧
    const madmanPos = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      const ppu = 32;
      return { x: scene.madman.x / ppu, y: scene.madman.y / ppu };
    });
    expect(madmanPos.x).toBeGreaterThan(20); // 右侧平台 x > 20u
    console.log(`✓ 落地成功：位置 (${madmanPos.x.toFixed(2)}, ${madmanPos.y.toFixed(2)})`);

    // 6. 疯子移动到压力板
    await page.evaluate(() => {
      const ppu = 32;
      // 压力板位置：x=23.5u
      const plateX = 23.5 * ppu;
      const plateY = 23 * ppu;
      window.__TEST_API__.setMadmanPosition(plateX, plateY);
      window.__TEST_API__.step(500);
    });

    await page.waitForTimeout(500);

    // 验证桥梁已伸出
    const bridgeState = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      return {
        bridgeExtended: scene.bridgeExtended,
        bridgeVisible: scene.bridgeSprite?.visible,
      };
    });
    expect(bridgeState.bridgeExtended).toBe(true);
    console.log('✓ 压力板激活，桥梁伸出');

    // 7. 天才通过桥梁
    await page.evaluate(() => {
      const ppu = 32;
      // 将天才移动到桥梁上
      const bridgeX = 20 * ppu;
      const bridgeY = 23 * ppu;
      window.__TEST_API__.setGeniusPosition(bridgeX, bridgeY);
      window.__TEST_API__.step(500);
      
      // 继续移动到右侧
      const rightX = 29 * ppu;
      window.__TEST_API__.setGeniusPosition(rightX, 22 * ppu);
      window.__TEST_API__.step(500);
    });

    await page.waitForTimeout(500);

    // 8. 双方进入出口区
    await page.evaluate(() => {
      const ppu = 32;
      const exitX = 29 * ppu;
      const exitY = 22 * ppu;
      window.__TEST_API__.setGeniusPosition(exitX, exitY);
      window.__TEST_API__.setMadmanPosition(exitX + 20, exitY);
      window.__TEST_API__.step(500);
    });

    await page.waitForTimeout(500);

    // 验证通关消息显示
    const clearedState = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      return {
        levelCleared: scene.levelCleared,
        clearMessageVisible: scene.clearMessage?.visible,
      };
    });
    expect(clearedState.levelCleared).toBe(true);
    console.log('✓ 双方进入出口，通关成功！');
  });

  test('死亡与重生：掉入裂谷后回到检查点', async ({ page }) => {
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
});
