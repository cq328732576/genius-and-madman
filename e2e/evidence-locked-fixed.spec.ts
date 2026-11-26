/**
 * 锁定证据捕获 - 修复版本
 */
import { test, expect } from '@playwright/test';

test.describe('锁定证据', () => {
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

  test('04-locked-hint: A锁定B替换', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 放置锚点A和B
      window.__TEST_API__.placeAnchorAt(400 / 32, 768 / 32);
      window.__TEST_API__.placeAnchorAt(700 / 32, 768 / 32);
      
      // 疯子距离A 3u
      scene.madman.setPosition(400 - 0.6 * 32 - 96, 768);
      scene.dashCooldown = 0;
      
      // 吸附到A
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(16.67); // 1帧
      
      return window.__TEST_API__.getState();
    });
    
    console.log('04 state after snap:', result);
    
    // 验证吸附
    expect(result.isSnapped).toBe(true);
    
    // 等待徽标稳定
    await page.waitForTimeout(200);
    
    // 尝试放置第3个锚点C（触发使用中徽标）
    await page.evaluate(() => {
      window.__TEST_API__.placeAnchorAt(1000 / 32, 768 / 32);
    });
    
    // 等待徽标显示
    await page.waitForTimeout(300);
    
    await page.screenshot({ path: 'docs/evidence/04-locked-hint.png' });
  });

  test('04b-only-locked: 唯一锚点锁定放置失败', async ({ page }) => {
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 临时设置maxAnchors=1
      scene.anchorSystem.config.genius.maxAnchors = 1;
      
      // 放置锚点A
      window.__TEST_API__.placeAnchorAt(500 / 32, 768 / 32);
      
      // 疯子距离A 3u
      scene.madman.setPosition(500 - 0.6 * 32 - 96, 768);
      scene.dashCooldown = 0;
      
      // 吸附到A
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(16.67); // 1帧
      
      return window.__TEST_API__.getState();
    });
    
    console.log('04b state after snap:', result);
    
    // 验证吸附
    expect(result.isSnapped).toBe(true);
    
    // 等待徽标稳定
    await page.waitForTimeout(200);
    
    // 尝试放置第2个锚点（应失败，显示使用中徽标）
    await page.evaluate(() => {
      const resultB = window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      console.log('04b placement result:', resultB);
      return resultB;
    });
    
    // 等待徽标显示
    await page.waitForTimeout(300);
    
    await page.screenshot({ path: 'docs/evidence/04b-only-locked.png' });
  });
});
