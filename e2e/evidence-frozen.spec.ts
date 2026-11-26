/**
 * 冻结证据捕获 - 确保HUD和徽标在截图中可见
 */
import { test, expect } from '@playwright/test';

// 证据路径：UPDATE_EVIDENCE=1时写入docs/evidence/，否则写入test-results/
const evidencePath = (filename: string) => 
  process.env.UPDATE_EVIDENCE === '1' 
    ? `docs/evidence/${filename}` 
    : `test-results/evidence-${filename}`;
import * as fs from 'fs';
import * as crypto from 'crypto';

test.describe('冻结证据捕获', () => {
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

  test('04-locked-hint: A锁定B替换（冻结）', async ({ page }) => {
    // 记录旧MD5
    const oldPath = evidencePath('04-locked-hint.png');
    let oldMd5 = '';
    if (fs.existsSync(oldPath)) {
      const oldData = fs.readFileSync(oldPath);
      oldMd5 = crypto.createHash('md5').update(oldData).digest('hex');
    }
    
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 放置A和B
      window.__TEST_API__.placeAnchorAt(400 / 32, 768 / 32);
      window.__TEST_API__.placeAnchorAt(700 / 32, 768 / 32);
      
      // 疯子吸附到A
      scene.madman.setPosition(400 - 0.6 * 32 - 96, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(16.67);
      
      return window.__TEST_API__.getState();
    });
    
    console.log('04 state after snap:', result);
    expect(result.isSnapped).toBe(true);
    
    // 放置第3个（触发使用中徽标）
    await page.evaluate(() => {
      window.__TEST_API__.placeAnchorAt(1000 / 32, 768 / 32);
    });
    
    await page.waitForTimeout(200);
    
    // 冻结游戏
    await page.evaluate(() => window.__TEST_API__.freeze());
    
    // 等待2个动画帧
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    
    // 获取冻结后状态
    const frozenState = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('04 frozen state:', frozenState);
    
    // 验证状态
    expect(frozenState.isSnapped).toBe(true);
    expect(frozenState.hudText).toContain('是否吸附: 是');
    
    // 截图
    await page.screenshot({ path: evidencePath('04-locked-hint.png') });
    
    // 验证MD5不同
    const newData = fs.readFileSync(oldPath);
    const newMd5 = crypto.createHash('md5').update(newData).digest('hex');
    expect(newMd5).not.toBe(oldMd5);
    console.log('04 MD5:', oldMd5, '->', newMd5);
    
    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('04b-only-locked: 唯一锚点锁定（冻结）', async ({ page }) => {
    const oldPath = evidencePath('04b-only-locked.png');
    let oldMd5 = '';
    if (fs.existsSync(oldPath)) {
      const oldData = fs.readFileSync(oldPath);
      oldMd5 = crypto.createHash('md5').update(oldData).digest('hex');
    }
    
    const result = await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      
      // 临时设置maxAnchors=1
      scene.anchorSystem.config.genius.maxAnchors = 1;
      
      // 放置A
      window.__TEST_API__.placeAnchorAt(500 / 32, 768 / 32);
      
      // 疯子吸附到A
      scene.madman.setPosition(500 - 0.6 * 32 - 96, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(16.67);
      
      return window.__TEST_API__.getState();
    });
    
    console.log('04b state after snap:', result);
    expect(result.isSnapped).toBe(true);
    
    // 尝试放置第2个（失败，显示使用中徽标）
    await page.evaluate(() => {
      const resultB = window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      console.log('04b placement result:', resultB);
    });
    
    await page.waitForTimeout(200);
    
    // 冻结游戏
    await page.evaluate(() => window.__TEST_API__.freeze());
    
    // 等待2个动画帧
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    
    // 获取冻结后状态
    const frozenState = await page.evaluate(() => window.__TEST_API__.getState());
    console.log('04b frozen state:', frozenState);
    
    // 验证状态
    expect(frozenState.isSnapped).toBe(true);
    expect(frozenState.hudText).toContain('是否吸附: 是');
    expect(frozenState.inUseBadgeVisible).toBe(true);
    
    // 截图
    await page.screenshot({ path: evidencePath('04b-only-locked.png') });
    
    // 验证MD5不同
    const newData = fs.readFileSync(oldPath);
    const newMd5 = crypto.createHash('md5').update(newData).digest('hex');
    expect(newMd5).not.toBe(oldMd5);
    console.log('04b MD5:', oldMd5, '->', newMd5);
    
    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('05-snap-success（冻结）', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(16.67);
    });
    
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    
    const frozenState = await page.evaluate(() => window.__TEST_API__.getState());
    expect(frozenState.isSnapped).toBe(true);
    expect(frozenState.hudText).toContain('是否吸附: 是');
    
    await page.screenshot({ path: evidencePath('05-snap-success.png') });
    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('06a-aim-window-base（冻结）', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(false);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(200);
    });
    
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    
    const frozenState = await page.evaluate(() => window.__TEST_API__.getState());
    expect(frozenState.isSnapped).toBe(true);
    expect(frozenState.hudText).toContain('是否吸附: 是');
    
    await page.screenshot({ path: evidencePath('06a-aim-window-base.png') });
    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });

  test('06b-aim-window-extended（冻结）', async ({ page }) => {
    await page.evaluate(() => {
      const scene = window.__GAME__.scene.scenes[0] as any;
      window.__TEST_API__.placeAnchorAt(900 / 32, 768 / 32);
      scene.madman.setPosition(785, 768);
      scene.dashCooldown = 0;
      window.__TEST_API__.setHoldDash(true);
      window.__TEST_API__.triggerDash('right');
      window.__TEST_API__.step(450);
    });
    
    await page.evaluate(() => window.__TEST_API__.freeze());
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    
    const frozenState = await page.evaluate(() => window.__TEST_API__.getState());
    expect(frozenState.isSnapped).toBe(true);
    expect(frozenState.hudText).toContain('是否吸附: 是');
    
    await page.screenshot({ path: evidencePath('06b-aim-window-extended.png') });
    await page.evaluate(() => window.__TEST_API__.unfreeze());
  });
});
