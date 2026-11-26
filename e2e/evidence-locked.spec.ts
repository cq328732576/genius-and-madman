/**
 * 锁定证据捕获
 */
import { test } from '@playwright/test';

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
    await page.evaluate(() => {
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
    });
    
    await page.waitForTimeout(200);
    
    // 尝试放置第3个锚点C（触发使用中徽标）
    await page.mouse.move(1000, 768);
    await page.mouse.down();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: 'docs/evidence/04-locked-hint.png' });
    await page.mouse.up();
  });

  test('04b-only-locked: 唯一锚点锁定放置失败', async ({ page }) => {
    await page.evaluate(() => {
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
    });
    
    await page.waitForTimeout(200);
    
    // 尝试放置第2个锚点（应失败，显示使用中徽标）
    await page.mouse.move(900, 768);
    await page.mouse.down();
    await page.waitForTimeout(500);
    
    await page.screenshot({ path: 'docs/evidence/04b-only-locked.png' });
    await page.mouse.up();
  });
});
