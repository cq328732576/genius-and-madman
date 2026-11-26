/**
 * Phase 1 验收测试 - 修复版本
 */
import { test, expect } from '@playwright/test';

test.describe('Phase 1 验收测试', () => {
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

  test('吸附持续测试 - 基础窗口0.28s', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    // 触发冲刺（不按住）
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
    });
    
    // 立即检查：应该吸附
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThanOrEqual(0);
    
    // 0.2s后：仍然吸附
    await page.evaluate(() => window.__TEST_API__.step(200));
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0.19);
    expect(state.aimWindowTimer).toBeLessThan(0.22);
    
    // 0.30s后：释放（>0.28s基础窗口）
    await page.evaluate(() => window.__TEST_API__.step(100));
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(false);
    expect(state.aimWindowTimer).toBeGreaterThan(0.28);
  });

  test('吸附持续测试 - 延长窗口0.50s', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    // 触发冲刺并按住
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
    });
    
    let state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    
    // 0.45s后：仍然吸附（因为按住）
    await page.evaluate(() => window.__TEST_API__.step(450));
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(true);
    expect(state.aimWindowTimer).toBeGreaterThan(0.44);
    expect(state.aimWindowTimer).toBeLessThan(0.47);
    
    // 0.52s后：释放（>0.50s最大窗口）
    await page.evaluate(() => window.__TEST_API__.step(70));
    state = await page.evaluate(() => window.__TEST_API__.getState());
    expect(state.isSnapped).toBe(false);
  });

  test('未吸附短冲刺 - 移动约4.0u', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      scene.madman.setPosition(300, 584);
      scene.dashCooldown = 0;
    });
    
    await page.waitForTimeout(200);
    
    const initialState = await page.evaluate(() => window.__TEST_API__.getState());
    
    // 触发向右冲刺
    await page.evaluate(() => {
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
    });
    
    await page.waitForTimeout(500);
    
    const finalState = await page.evaluate(() => window.__TEST_API__.getState());
    
    // 验证未吸附
    expect(finalState.isSnapped).toBe(false);
    
    // 验证移动距离约4.0u = 128px
    const distance = finalState.madmanX - initialState.madmanX;
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(300);
    
    // 验证徽标显示
    expect(finalState.badgeVisible).toBe(true);
    expect(finalState.badgeTexture).toBe('snap_badge_miss_zh_m');
  });

  test('锁定行为 - A锁定B自由则B被替换', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 放置锚点A和B
      const resultA = window.__TEST_API__.placeAnchorAt(400 / 32, 768 / 32);
      const resultB = window.__TEST_API__.placeAnchorAt(700 / 32, 768 / 32);
      
      const anchorsBeforeSnap = window.__TEST_API__.getAnchors();
      const anchorAId = anchorsBeforeSnap[0].id;
      
      // 疯子距离A 3u
      scene.madman.setPosition(400 - 0.6 * 32 - 96, 768);
      scene.dashCooldown = 0;
      
      // 吸附到A
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(16.67); // 1帧
      
      const stateAfterSnap = window.__TEST_API__.getState();
      
      // 尝试放置第3个锚点C
      const resultC = window.__TEST_API__.placeAnchorAt(1000 / 32, 768 / 32);
      
      const finalAnchors = window.__TEST_API__.getAnchors();
      const finalState = window.__TEST_API__.getState();
      
      return {
        resultA,
        resultB,
        resultC,
        anchorAId,
        stateAfterSnap,
        finalAnchors,
        finalState,
      };
    });
    
    console.log('Lock test result:', JSON.stringify(result, null, 2));
    
    // 验证A和B放置成功
    expect(result.resultA.success).toBe(true);
    expect(result.resultB.success).toBe(true);
    
    // 验证吸附到A
    expect(result.stateAfterSnap.isSnapped).toBe(true);
    expect(result.stateAfterSnap.snappedAnchorId).toBe(result.anchorAId);
    
    // 验证C放置成功（替换B）
    expect(result.resultC.success).toBe(true);
    
    // 验证仍然2个锚点
    expect(result.finalAnchors.length).toBe(2);
    
    // 验证A仍然存在（被锁定）
    const hasAnchorA = result.finalAnchors.some((a: any) => a.id === result.anchorAId);
    expect(hasAnchorA).toBe(true);
    
    // 验证仍然吸附
    expect(result.finalState.isSnapped).toBe(true);
  });

  test('锁定行为 - 唯一锚点锁定则放置失败', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 临时设置maxAnchors=1
      const originalMax = scene.anchorSystem.config.genius.maxAnchors;
      scene.anchorSystem.config.genius.maxAnchors = 1;
      
      // 放置锚点A
      const resultA = window.__TEST_API__.placeAnchorAt(500 / 32, 768 / 32);
      
      const anchorsBeforeSnap = window.__TEST_API__.getAnchors();
      const anchorAId = anchorsBeforeSnap[0].id;
      
      // 疯子距离A 3u
      scene.madman.setPosition(500 - 0.6 * 32 - 96, 768);
      scene.dashCooldown = 0;
      
      // 吸附到A
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(16.67); // 1帧
      
      const stateAfterSnap = window.__TEST_API__.getState();
      
      // 尝试放置第2个锚点B（应失败，A被锁定）
      const resultB = window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      
      const finalAnchors = window.__TEST_API__.getAnchors();
      const finalState = window.__TEST_API__.getState();
      
      // 恢复maxAnchors
      scene.anchorSystem.config.genius.maxAnchors = originalMax;
      
      return {
        resultA,
        resultB,
        stateAfterSnap,
        finalAnchors,
        finalState,
      };
    });
    
    console.log('Single locked test result:', JSON.stringify(result, null, 2));
    
    // 验证A放置成功
    expect(result.resultA.success).toBe(true);
    
    // 验证吸附到A
    expect(result.stateAfterSnap.isSnapped).toBe(true);
    
    // 验证B放置失败（唯一锚点被锁定）
    expect(result.resultB.success).toBe(false);
    expect(result.resultB.reason).toBe('locked_anchor');
    
    // 验证仍然只有1个锚点
    expect(result.finalAnchors.length).toBe(1);
    
    // 验证仍然吸附
    expect(result.finalState.isSnapped).toBe(true);
  });
});
