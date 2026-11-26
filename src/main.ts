/**
 * 游戏主入口
 */

import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS, // 强制使用 Canvas 渲染器（Playwright 兼容）
  width: 1920,
  height: 1080,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  canvas: undefined,
  canvasStyle: undefined,
  context: undefined,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 500 },
      debug: false,
    },
  },
  dom: {
    createContainer: true,
  },
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    preserveDrawingBuffer: true, // E2E 截图必需
  },
};

// 创建游戏实例
const game = new Phaser.Game(config);

// 测试钩子 API（仅用于 E2E 测试）
declare global {
  interface Window {
    __GAME__: Phaser.Game;
    __TEST_API__: {
      placeAnchor: (x: number, y: number) => boolean;
      placeAnchorAt: (ux: number, uy: number) => { success: boolean; reason?: string };
      lockAnchor: (index: number) => boolean;
      setMadmanPosition: (x: number, y: number) => void;
      setGeniusPosition: (x: number, y: number) => void;
      step: (ms: number) => void;
      triggerDash: (direction: 'left' | 'right') => void;
      setHoldDash: (hold: boolean) => void;
      freeze: () => void;
      unfreeze: () => void;
      getState: () => any;
      getAnchors: () => any[];
      // Phase 2: 新增测试钩子
      setAimDirection: (x: number, y: number) => void;
      setConsume: (consume: boolean) => void;
      pressArrow: (direction: 'up' | 'down' | 'left' | 'right') => void;
      getTrajectoryPoints: () => any[];
    };
  }
}

window.__GAME__ = game;

// 测试 API（场景创建后初始化）
window.__TEST_API__ = {
  placeAnchor: (x: number, y: number) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene || !scene.anchorSystem) return false;
    const anchor = scene.anchorSystem.placeAnchor(
      { x: x / 32, y: y / 32 },
      'ground'
    );
    if (anchor) {
      scene.createAnchorSprite(anchor);
      return true;
    }
    return false;
  },
  placeAnchorAt: (ux: number, uy: number) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return { success: false, reason: 'no_scene' };
    return scene.placeAnchorAtPosition({ x: ux, y: uy });
  },
  lockAnchor: (index: number) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene || !scene.anchorSystem) return false;
    const anchors = scene.anchorSystem.getAnchors();
    if (index >= anchors.length) return false;
    return scene.anchorSystem.lockAnchor(anchors[index].id);
  },
  setMadmanPosition: (x: number, y: number) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene || !scene.madman) return;
    scene.madman.setPosition(x, y);
    scene.madman.setVelocity(0, 0);
  },
  setGeniusPosition: (x: number, y: number) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene || !scene.genius) return;
    scene.genius.setPosition(x, y);
    scene.genius.setVelocity(0, 0);
  },
  // 步进游戏帧（固定时间步长，包含物理引擎）
  step: (ms: number) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return;
    const dt = 16.67; // 60 FPS (毫秒)
    const steps = Math.ceil(ms / dt);
    for (let i = 0; i < steps; i++) {
      // 使用world.update()而不是step()
      scene.physics.world.update(0, dt);
      // 手动同步sprite位置 = body中心
      if (scene.genius.body) {
        scene.genius.x = scene.genius.body.center.x;
        scene.genius.y = scene.genius.body.center.y;
      }
      if (scene.madman.body) {
        scene.madman.x = scene.madman.body.center.x;
        scene.madman.y = scene.madman.body.center.y;
      }
    }
  },
  // 触发冲刺（模拟按键并步进）
  triggerDash: (direction: 'left' | 'right') => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return;
    
    // 设置方向键状态
    if (direction === 'left') {
      scene.cursors.left.isDown = true;
      scene.cursors.right.isDown = false;
    } else {
      scene.cursors.left.isDown = false;
      scene.cursors.right.isDown = true;
    }
    
    // 设置 Shift 状态
    scene.shiftKey.isDown = true;
    scene.dashCooldown = 0; // 确保可以冲刺
    
    // 步进一帧让 updateMadmanMovement 调用 tryDash
    scene.update(0, 16.67);
    
    // 清除方向键但保持 Shift（用于瞄准窗口）
    scene.cursors.left.isDown = false;
    scene.cursors.right.isDown = false;
    scene.shiftKey.isDown = false;
  },
  // 设置是否按住冲刺键（用于测试延长窗口）
  setHoldDash: (hold: boolean) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return;
    scene.testHoldDash = hold;
  },
  // 冻结游戏状态（用于截图）
  freeze: () => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return;
    scene.frozen = true;
    scene.physics.world.pause();
    scene.time.paused = true;
    scene.tweens.pauseAll();
    // 强制更新HUD
    if (scene.updateDebugPanel) scene.updateDebugPanel();
    // 确保"使用中"徽标在冻结时可见
    if (scene.snapBadge && scene.snapBadge.texture.key === 'snap_badge_inuse_zh_g') {
      scene.snapBadge.setVisible(true);
    }
  },
  // 解冻游戏状态
  unfreeze: () => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return;
    scene.frozen = false;
    scene.physics.world.resume();
    scene.time.paused = false;
    scene.tweens.resumeAll();
  },
  // 获取游戏状态
  getState: () => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return null;
    
    // 获取HUD文本
    let hudText = '';
    if (scene.debugPanel && scene.debugPanel.text) {
      hudText = scene.debugPanel.text;
    }
    
    // Phase 2: 计算三个角度值和发射速度
    let rawAngle = 0;
    let clampedAngle = 0;
    let finalAngle = 0;
    let launchSpeed = 0;
    
    if (scene.isSnapped && scene.aimDirection) {
      const angles = scene.anchorSystem.calculateAimAngles(
        scene.incomingDashDir,
        scene.aimDirection,
        { x: 0, y: -1 }
      );
      rawAngle = angles.rawAngle;
      clampedAngle = angles.clampedAngle;
      finalAngle = angles.finalAngle;
      
      const launchVelocity = scene.anchorSystem.calculateLaunchVelocity(
        scene.incomingDashDir,
        scene.aimDirection,
        scene.consumeAnchor,
        { x: 0, y: -1 }
      );
      // calculateLaunchVelocity返回值已经是u/s，不需要转换
      launchSpeed = Math.sqrt(launchVelocity.x * launchVelocity.x + launchVelocity.y * launchVelocity.y);
    }
    
    return {
      isSnapped: scene.isSnapped,
      snappedAnchorId: scene.snappedAnchorId,
      aimWindowTimer: scene.aimWindowTimer,
      dashCooldown: scene.dashCooldown,
      madmanX: scene.madman.x,
      madmanY: scene.madman.y,
      madmanVelX: scene.madman.body.velocity.x,
      madmanVelY: scene.madman.body.velocity.y,
      anchorsCount: scene.anchorSystem.getAnchors().length,
      badgeVisible: scene.snapBadge?.visible || false,
      badgeTexture: scene.snapBadge?.texture.key || '',
      inUseBadgeVisible: scene.snapBadge?.visible && scene.snapBadge?.texture.key === 'snap_badge_inuse_zh_g',
      hudText,
      // Phase 2: 新增状态
      rawAngle,
      clampedAngle,
      finalAngle,
      launchSpeed,
      lastLaunchSpeed: scene.lastLaunchSpeed,
      consumeAnchor: scene.consumeAnchor,
      trajectoryPointsLength: scene.trajectoryDots.length,
      // 环状态（从第一个锚点获取）
      ringVisible: (() => {
        const anchors = scene.anchorSystem.getAnchors();
        if (anchors.length === 0) return false;
        const container = scene.anchorSprites.get(anchors[0].id);
        const ring = container?.getData('snapRing');
        return ring?.visible || false;
      })(),
      ringTextureKey: (() => {
        const anchors = scene.anchorSystem.getAnchors();
        if (anchors.length === 0) return '';
        const container = scene.anchorSprites.get(anchors[0].id);
        const ring = container?.getData('snapRing');
        return ring?.texture?.key || '';
      })(),
      ringDisplayWidth: (() => {
        const anchors = scene.anchorSystem.getAnchors();
        if (anchors.length === 0) return 0;
        const container = scene.anchorSprites.get(anchors[0].id);
        const ring = container?.getData('snapRing');
        return ring?.displayWidth || 0;
      })(),
    };
  },
  getAnchors: () => {
    const scene = game.scene.scenes[0] as any;
    if (!scene || !scene.anchorSystem) return [];
    return scene.anchorSystem.getAnchors();
  },
  // Phase 2: 新增测试钩子
  setAimDirection: (x: number, y: number) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return;
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) {
      scene.aimDirection = { x: x / len, y: y / len };
    }
  },
  setConsume: (consume: boolean) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return;
    scene.consumeAnchor = consume;
    scene.cKeyDown = consume;
  },
  pressArrow: (direction: 'up' | 'down' | 'left' | 'right') => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return;
    
    // 设置方向键状态
    scene.cursors.up.isDown = direction === 'up';
    scene.cursors.down.isDown = direction === 'down';
    scene.cursors.left.isDown = direction === 'left';
    scene.cursors.right.isDown = direction === 'right';
    
    // 步进一帧让场景更新
    scene.update(0, 16.67);
    
    // 清除方向键状态
    scene.cursors.up.isDown = false;
    scene.cursors.down.isDown = false;
    scene.cursors.left.isDown = false;
    scene.cursors.right.isDown = false;
  },
  getTrajectoryPoints: () => {
    const scene = game.scene.scenes[0] as any;
    if (!scene) return [];
    return scene.trajectoryDots.length;
  },
};

// 导出用于测试
export { game };

// 全局暴露用于 e2e 测试
(window as any).__GAME__ = game;
