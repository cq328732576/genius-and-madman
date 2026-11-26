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
      lockAnchor: (index: number) => boolean;
      snapToAnchor: (anchorIndex: number) => void;
      setMadmanPosition: (x: number, y: number) => void;
      setGeniusPosition: (x: number, y: number) => void;
      getAnchors: () => any[];
      isSnapped: () => boolean;
      getAimWindowTimer: () => number;
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
  lockAnchor: (index: number) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene || !scene.anchorSystem) return false;
    const anchors = scene.anchorSystem.getAnchors();
    if (index >= anchors.length) return false;
    return scene.anchorSystem.lockAnchor(anchors[index].id);
  },
  snapToAnchor: (anchorIndex: number) => {
    const scene = game.scene.scenes[0] as any;
    if (!scene || !scene.anchorSystem) return;
    const anchors = scene.anchorSystem.getAnchors();
    if (anchorIndex >= anchors.length) return;
    
    scene.isSnapped = true;
    scene.snappedAnchorId = anchors[anchorIndex].id;
    scene.aimWindowTimer = 0;
    scene.anchorSystem.lockAnchor(anchors[anchorIndex].id);
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
  getAnchors: () => {
    const scene = game.scene.scenes[0] as any;
    if (!scene || !scene.anchorSystem) return [];
    return scene.anchorSystem.getAnchors();
  },
  isSnapped: () => {
    const scene = game.scene.scenes[0] as any;
    return scene?.isSnapped || false;
  },
  getAimWindowTimer: () => {
    const scene = game.scene.scenes[0] as any;
    return scene?.aimWindowTimer || 0;
  },
};

// 导出用于测试
export { game };

// 全局暴露用于 e2e 测试
(window as any).__GAME__ = game;
