/**
 * 游戏主场景
 * 集成 AnchorSystem 核心逻辑与 Phaser 渲染
 */

import Phaser from 'phaser';
import { AnchorSystem, Vec2, Surface, AnchorState, Anchor } from '../engine/anchorSystem';
import { tuning } from '../config/tuning';

export class GameScene extends Phaser.Scene {
  private anchorSystem!: AnchorSystem;
  private surfaces: Surface[] = [];

  // 角色
  private genius!: Phaser.Physics.Arcade.Sprite;
  private madman!: Phaser.Physics.Arcade.Sprite;

  // 输入
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: any;
  private mousePointer!: Phaser.Input.Pointer;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  // 状态
  private isAiming = false;
  private currentAimPos: Vec2 | null = null;
  private isDashing = false;
  private isSnapped = false;
  private snappedAnchorId: string | null = null;
  private aimWindowTimer = 0;
  private dashCooldown = 0;
  private consumeAnchor = false;

  // 渲染对象
  private anchorSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private aimRay: Phaser.GameObjects.Graphics | null = null;
  private aimReticle: Phaser.GameObjects.Image | null = null;
  private trajectoryLine: Phaser.GameObjects.Graphics | null = null;
  private snapBadge: Phaser.GameObjects.Text | null = null;

  // 调试面板
  private debugPanel: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.anchorSystem = new AnchorSystem(tuning);

    // 创建测试关卡
    this.createTestLevel();

    // 创建角色
    this.createCharacters();

    // 设置输入
    this.setupInput();

    // 创建图形对象
    this.aimRay = this.add.graphics();
    this.trajectoryLine = this.add.graphics();

    // 调试面板
    if (tuning.debug.enabled) {
      this.createDebugPanel();
    }

    // 设置相机
    this.cameras.main.setBounds(0, 0, 1920, 1080);
    this.cameras.main.startFollow(this.madman, true, 0.1, 0.1);
  }

  private createTestLevel() {
    const ppu = tuning.world.pixelsPerUnit;

    // 创建地面
    const ground = this.add.rectangle(640, 800, 1280, 64, 0x4a4a4a);
    this.physics.add.existing(ground, true);

    this.surfaces.push({
      id: 'ground',
      isAttachable: true,
      points: [
        { x: 0, y: 25 },
        { x: 40, y: 25 },
        { x: 40, y: 27 },
        { x: 0, y: 27 },
      ],
    });

    // 创建墙壁
    const wall = this.add.rectangle(1200, 600, 64, 400, 0x6a6a6a);
    this.physics.add.existing(wall, true);

    this.surfaces.push({
      id: 'wall',
      isAttachable: true,
      points: [
        { x: 36, y: 6 },
        { x: 38, y: 6 },
        { x: 38, y: 18.5 },
        { x: 36, y: 18.5 },
      ],
    });

    // 创建平台（可附着）
    const platform1 = this.add.rectangle(400, 600, 192, 32, 0x5a9a5a);
    this.physics.add.existing(platform1, true);

    this.surfaces.push({
      id: 'platform1',
      isAttachable: true,
      points: [
        { x: 9.5, y: 18 },
        { x: 15.5, y: 18 },
        { x: 15.5, y: 19 },
        { x: 9.5, y: 19 },
      ],
    });

    // 创建不可附着平台（红色）
    const platform2 = this.add.rectangle(800, 500, 192, 32, 0x9a5a5a);
    this.physics.add.existing(platform2, true);

    // 添加标签
    this.add.text(400, 630, '可附着', {
      fontSize: '16px',
      color: '#fff',
    }).setOrigin(0.5);

    this.add.text(800, 530, '不可附着', {
      fontSize: '16px',
      color: '#fff',
    }).setOrigin(0.5);

    // 裂谷（深色背景表示）
    this.add.rectangle(600, 750, 400, 100, 0x2a2a2a);
    this.add.text(600, 750, '裂谷', {
      fontSize: '24px',
      color: '#888',
    }).setOrigin(0.5);
  }

  private createCharacters() {
    const ppu = tuning.world.pixelsPerUnit;
    const charHeight = tuning.world.characterHeight * ppu;

    // 天才（蓝色）
    this.genius = this.physics.add.sprite(200, 750, '');
    this.genius.setDisplaySize(charHeight * 0.5, charHeight);
    this.genius.setTint(0x2fd5ff);
    this.physics.world.enable(this.genius);
    this.genius.body!.setCollideWorldBounds(true);

    // 疯子（橙色）
    this.madman = this.physics.add.sprite(300, 750, '');
    this.madman.setDisplaySize(charHeight * 0.5, charHeight);
    this.madman.setTint(0xff8a1f);
    this.physics.world.enable(this.madman);
    this.madman.body!.setCollideWorldBounds(true);

    // 添加标签
    this.add.text(0, 0, '天才', {
      fontSize: '14px',
      color: '#fff',
      backgroundColor: '#0004',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);

    this.add.text(0, 0, '疯子', {
      fontSize: '14px',
      color: '#fff',
      backgroundColor: '#0004',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.shiftKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );

    this.mousePointer = this.input.activePointer;

    // 鼠标点击放置锚点
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.isAiming = true;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isAiming && this.currentAimPos) {
        this.tryPlaceAnchor();
      }
      this.isAiming = false;
    });
  }

  private createDebugPanel() {
    this.debugPanel = this.add.text(10, 10, '', {
      fontSize: '12px',
      color: '#fff',
      backgroundColor: '#0008',
      padding: { x: 8, y: 8 },
      fontFamily: 'monospace',
    });
    this.debugPanel.setScrollFactor(0);
    this.debugPanel.setDepth(1000);
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;

    // 更新冷却
    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt;
    }

    // 更新瞄准
    if (this.isAiming) {
      this.updateAiming();
    } else {
      this.clearAiming();
    }

    // 更新角色移动
    this.updateGeniusMovement();
    this.updateMadmanMovement(dt);

    // 更新锚点渲染
    this.updateAnchorSprites();

    // 更新调试面板
    if (this.debugPanel) {
      this.updateDebugPanel();
    }
  }

  private updateAiming() {
    const ppu = tuning.world.pixelsPerUnit;
    const geniusPos = this.pixelsToUnits(this.genius.x, this.genius.y);
    const worldPoint = this.input.activePointer.positionToCamera(
      this.cameras.main
    ) as Phaser.Math.Vector2;
    const targetPos = this.pixelsToUnits(worldPoint.x, worldPoint.y);

    this.currentAimPos = targetPos;

    // 验证放置
    const validation = this.anchorSystem.validatePlacement(
      geniusPos,
      targetPos,
      this.surfaces
    );

    // 渲染瞄准射线
    this.aimRay!.clear();
    const color = validation.valid ? 0x2fd5ff : 0xff4d6d;
    const alpha = validation.valid ? 0.8 : 0.5;

    this.aimRay!.lineStyle(2, color, alpha);
    this.aimRay!.beginPath();
    this.aimRay!.moveTo(this.genius.x, this.genius.y);
    this.aimRay!.lineTo(worldPoint.x, worldPoint.y);
    this.aimRay!.strokePath();

    // 渲染准星
    if (!this.aimReticle) {
      this.aimReticle = this.add.circle(0, 0, 16);
    }
    this.aimReticle.setPosition(worldPoint.x, worldPoint.y);
    this.aimReticle.setStrokeStyle(2, color, alpha);
    this.aimReticle.setVisible(true);

    // 显示失败原因
    if (!validation.valid && validation.reason === 'locked_anchor') {
      if (!this.snapBadge) {
        this.snapBadge = this.add.text(0, 0, '锚点正在被使用', {
          fontSize: '14px',
          color: '#fff',
          backgroundColor: '#f004',
          padding: { x: 8, y: 4 },
        });
      }
      this.snapBadge.setPosition(worldPoint.x, worldPoint.y - 40);
      this.snapBadge.setOrigin(0.5);
      this.snapBadge.setVisible(true);
    } else if (this.snapBadge) {
      this.snapBadge.setVisible(false);
    }
  }

  private clearAiming() {
    if (this.aimRay) {
      this.aimRay.clear();
    }
    if (this.aimReticle) {
      this.aimReticle.setVisible(false);
    }
    this.currentAimPos = null;
  }

  private tryPlaceAnchor() {
    if (!this.currentAimPos) return;

    const geniusPos = this.pixelsToUnits(this.genius.x, this.genius.y);
    const validation = this.anchorSystem.validatePlacement(
      geniusPos,
      this.currentAimPos,
      this.surfaces
    );

    if (validation.valid && validation.position && validation.surfaceId) {
      const anchor = this.anchorSystem.placeAnchor(
        validation.position,
        validation.surfaceId
      );

      if (anchor) {
        this.createAnchorSprite(anchor);
      }
    }
  }

  private createAnchorSprite(anchor: Anchor) {
    const ppu = tuning.world.pixelsPerUnit;
    const pos = this.unitsToPixels(anchor.position.x, anchor.position.y);

    const container = this.add.container(pos.x, pos.y);

    // 光圈（六边形）
    const halo = this.add.graphics();
    this.updateAnchorHalo(halo, anchor.state);
    container.add(halo);

    // 吸附半径环
    const snapRing = this.add.circle(0, 0, tuning.madman.snapRadius * ppu);
    snapRing.setStrokeStyle(2, 0xff8a1f, 0.3);
    snapRing.setVisible(false);
    container.add(snapRing);

    container.setData('halo', halo);
    container.setData('snapRing', snapRing);

    this.anchorSprites.set(anchor.id, container);
  }

  private updateAnchorHalo(
    graphics: Phaser.GameObjects.Graphics,
    state: AnchorState
  ) {
    graphics.clear();

    const color = state === AnchorState.Locked ? 0x8fa3bf : 0x2fd5ff;
    const alpha = state === AnchorState.Locked ? 0.5 : 1.0;

    // 绘制六边形
    graphics.lineStyle(3, color, alpha);
    const radius = 32;
    graphics.beginPath();
    for (let i = 0; i <= 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }
    graphics.closePath();
    graphics.strokePath();

    // 中心点
    graphics.fillStyle(color, alpha);
    graphics.fillCircle(0, 0, 4);
  }

  private updateAnchorSprites() {
    const anchors = this.anchorSystem.getAnchors();

    // 移除不存在的锚点精灵
    for (const [id, sprite] of this.anchorSprites) {
      if (!anchors.find((a) => a.id === id)) {
        sprite.destroy();
        this.anchorSprites.delete(id);
      }
    }

    // 更新锚点状态
    for (const anchor of anchors) {
      const sprite = this.anchorSprites.get(anchor.id);
      if (sprite) {
        const halo = sprite.getData('halo') as Phaser.GameObjects.Graphics;
        this.updateAnchorHalo(halo, anchor.state);
      }
    }
  }

  private updateGeniusMovement() {
    const speed = 200;
    const body = this.genius.body as Phaser.Physics.Arcade.Body;

    if (this.wasdKeys.left.isDown) {
      body.setVelocityX(-speed);
    } else if (this.wasdKeys.right.isDown) {
      body.setVelocityX(speed);
    } else {
      body.setVelocityX(0);
    }
  }

  private updateMadmanMovement(dt: number) {
    const speed = 200;
    const body = this.madman.body as Phaser.Physics.Arcade.Body;

    // 吸附状态
    if (this.isSnapped) {
      this.aimWindowTimer += dt;

      // 瞄准窗口超时
      const maxWindow = this.shiftKey.isDown
        ? tuning.madman.aimWindowMax
        : tuning.madman.aimWindowBase;

      if (this.aimWindowTimer >= maxWindow || !this.shiftKey.isDown) {
        this.launchFromAnchor();
      }

      return;
    }

    // 正常移动
    if (this.cursors.left!.isDown) {
      body.setVelocityX(-speed);
    } else if (this.cursors.right!.isDown) {
      body.setVelocityX(speed);
    } else {
      body.setVelocityX(0);
    }

    // 冲刺
    if (this.shiftKey.isDown && this.dashCooldown <= 0) {
      this.tryDash();
    }
  }

  private tryDash() {
    const ppu = tuning.world.pixelsPerUnit;
    const madmanPos = this.pixelsToUnits(this.madman.x, this.madman.y);

    // 确定冲刺方向
    let direction: Vec2 = { x: 1, y: 0 };
    if (this.cursors.left!.isDown) {
      direction = { x: -1, y: 0 };
    } else if (this.cursors.right!.isDown) {
      direction = { x: 1, y: 0 };
    }

    // 检查吸附
    const dashPath = {
      start: madmanPos,
      direction,
      distance: tuning.madman.shortDashDistance,
    };

    const snapResult = this.anchorSystem.checkSnapAlongPath(dashPath);

    if (snapResult.snapped && snapResult.hoverPoint) {
      // 吸附成功
      this.isSnapped = true;
      this.snappedAnchorId = snapResult.anchorId!;
      this.aimWindowTimer = 0;
      this.anchorSystem.lockAnchor(snapResult.anchorId!);

      // 移动到悬停点
      const hoverPixels = this.unitsToPixels(
        snapResult.hoverPoint.x,
        snapResult.hoverPoint.y
      );
      this.madman.setPosition(hoverPixels.x, hoverPixels.y);
      this.madman.setVelocity(0, 0);
    } else {
      // 短冲刺
      this.performShortDash(direction);
      this.showMissBadge();
    }

    this.dashCooldown = tuning.madman.dashCooldown;
  }

  private performShortDash(direction: Vec2) {
    const ppu = tuning.world.pixelsPerUnit;
    const distance = tuning.madman.shortDashDistance * ppu;
    this.madman.setVelocity(direction.x * distance * 10, direction.y * distance * 10);

    // 短时间后停止
    this.time.delayedCall(100, () => {
      this.madman.setVelocity(0, 0);
    });
  }

  private launchFromAnchor() {
    if (!this.snappedAnchorId) return;

    const anchor = this.anchorSystem.getAnchor(this.snappedAnchorId);
    if (!anchor) return;

    const ppu = tuning.world.pixelsPerUnit;
    const madmanPos = this.pixelsToUnits(this.madman.x, this.madman.y);

    // 计算接近方向
    const approachDir: Vec2 = {
      x: anchor.position.x - madmanPos.x,
      y: anchor.position.y - madmanPos.y,
    };
    const len = Math.sqrt(approachDir.x ** 2 + approachDir.y ** 2);
    if (len > 0) {
      approachDir.x /= len;
      approachDir.y /= len;
    }

    // 计算输入方向
    let inputDir: Vec2 | null = null;
    if (this.cursors.up!.isDown || this.cursors.down!.isDown ||
        this.cursors.left!.isDown || this.cursors.right!.isDown) {
      inputDir = {
        x: (this.cursors.right!.isDown ? 1 : 0) - (this.cursors.left!.isDown ? 1 : 0),
        y: (this.cursors.down!.isDown ? 1 : 0) - (this.cursors.up!.isDown ? 1 : 0),
      };
    }

    // 计算弹射速度
    const velocity = this.anchorSystem.calculateLaunchVelocity(
      approachDir,
      inputDir,
      this.consumeAnchor
    );

    // 应用速度
    this.madman.setVelocity(velocity.x * ppu, velocity.y * ppu);

    // 解锁或移除锚点
    if (this.consumeAnchor) {
      this.anchorSystem.removeAnchor(this.snappedAnchorId);
      const sprite = this.anchorSprites.get(this.snappedAnchorId);
      if (sprite) {
        sprite.destroy();
        this.anchorSprites.delete(this.snappedAnchorId);
      }
    } else {
      this.anchorSystem.unlockAnchor(this.snappedAnchorId);
    }

    this.isSnapped = false;
    this.snappedAnchorId = null;
  }

  private showMissBadge() {
    if (!this.snapBadge) {
      this.snapBadge = this.add.text(0, 0, '未吸附', {
        fontSize: '16px',
        color: '#fff',
        backgroundColor: '#f808',
        padding: { x: 8, y: 4 },
      });
    }

    this.snapBadge.setPosition(this.madman.x, this.madman.y - 60);
    this.snapBadge.setOrigin(0.5);
    this.snapBadge.setVisible(true);

    this.time.delayedCall(1000, () => {
      if (this.snapBadge) {
        this.snapBadge.setVisible(false);
      }
    });
  }

  private updateDebugPanel() {
    const anchors = this.anchorSystem.getAnchors();
    const lines = [
      `锚点数: ${anchors.length}/${tuning.genius.maxAnchors}`,
      `冲刺冷却: ${this.dashCooldown.toFixed(2)}s`,
      `是否吸附: ${this.isSnapped ? '是' : '否'}`,
      `瞄准窗口: ${this.isSnapped ? this.aimWindowTimer.toFixed(2) : '-'}s`,
      '',
      '操作:',
      '  天才: WASD 移动, 鼠标点击放置锚点',
      '  疯子: 方向键移动, Shift 冲刺',
      '',
      '调参:',
      `  吸附半径: ${tuning.madman.snapRadius} 单位`,
      `  短冲距离: ${tuning.madman.shortDashDistance} 单位`,
      `  弹射初速: ${tuning.madman.launchSpeedBase} 单位/秒`,
    ];

    this.debugPanel!.setText(lines.join('\n'));
  }

  private pixelsToUnits(px: number, py: number): Vec2 {
    const ppu = tuning.world.pixelsPerUnit;
    return { x: px / ppu, y: py / ppu };
  }

  private unitsToPixels(ux: number, uy: number): { x: number; y: number } {
    const ppu = tuning.world.pixelsPerUnit;
    return { x: ux * ppu, y: uy * ppu };
  }
}
