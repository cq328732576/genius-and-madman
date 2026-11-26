/**
 * 游戏主场景
 * 集成 AnchorSystem 核心逻辑与 Phaser 渲染
 */

import Phaser from 'phaser';
import { AnchorSystem, Vec2, Surface, AnchorState, Anchor } from '../engine/anchorSystem';
import { tuning } from '../config/tuning';
import { TuningPanel } from '../ui/TuningPanel';

export class GameScene extends Phaser.Scene {
  private anchorSystem!: AnchorSystem;
  private surfaces: Surface[] = [];
  private platforms!: Phaser.Physics.Arcade.StaticGroup;

  // 角色
  private genius!: Phaser.Physics.Arcade.Sprite;
  private madman!: Phaser.Physics.Arcade.Sprite;
  
  // 输入
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: any;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  // 状态
  private isAiming = false;
  private currentAimPos: Vec2 | null = null;
  private isSnapped = false;
  private snappedAnchorId: string | null = null;
  private aimWindowTimer = 0;
  private dashCooldown = 0;
  private _consumeAnchor = false; // Phase 2+: 锚点消耗机制（未使用）
  public testHoldDash = false; // E2E测试钩子：模拟按住冲刺键

  // 渲染对象
  private anchorSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private aimRayTiles: Phaser.GameObjects.Image[] = [];
  private aimReticle: Phaser.GameObjects.Image | null = null;
  private snapBadge: Phaser.GameObjects.Image | null = null;

  // 调试面板
  private debugPanel: Phaser.GameObjects.Text | null = null;
  private tuningPanel: TuningPanel | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // 创建角色纹理（简单彩色矩形，高度 1.8u）
    const ppu = 32; // 像素/单位
    const w = Math.floor(1.8 * ppu * 0.5); // 宽度 0.9u
    const h = Math.floor(1.8 * ppu); // 高度 1.8u
    
    // 天才（蓝色）
    const geniusGraphics = this.make.graphics({ x: 0, y: 0 });
    geniusGraphics.fillStyle(0x2fd5ff, 1);
    geniusGraphics.fillRect(0, 0, w, h);
    geniusGraphics.generateTexture('genius_char', w, h);
    geniusGraphics.destroy();
    
    // 疯子（橙色）
    const madmanGraphics = this.make.graphics({ x: 0, y: 0 });
    madmanGraphics.fillStyle(0xff8a1f, 1);
    madmanGraphics.fillRect(0, 0, w, h);
    madmanGraphics.generateTexture('madman_char', w, h);
    madmanGraphics.destroy();
    
    // 加载锚点光圈
    this.load.image('anchor_halo_ready_g', 'assets/anchor_halo_ready_g.png');
    this.load.image('anchor_halo_snap_g', 'assets/anchor_halo_snap_g.png');
    this.load.image('anchor_halo_locked_g', 'assets/anchor_halo_locked_g.png');

    // 加载锚点脉冲
    this.load.image('anchor_pulse_g', 'assets/anchor_pulse_g.png');

    // 加载瞄准射线和准星
    this.load.image('aim_ray_valid_g', 'assets/aim_ray_valid_g.png');
    this.load.image('aim_ray_forbidden_g', 'assets/aim_ray_forbidden_g.png');
    this.load.image('aim_reticle_valid_g', 'assets/aim_reticle_valid_g.png');
    this.load.image('aim_reticle_forbidden_g', 'assets/aim_reticle_forbidden_g.png');

    // 加载吸附半径环
    this.load.image('snap_ring_thin_m', 'assets/snap_ring_thin_m.png');
    this.load.image('snap_ring_inrange_m', 'assets/snap_ring_inrange_m.png');

    // 加载徽标
    this.load.image('snap_badge_snap_zh_m', 'assets/snap_badge_snap_zh_m.png');
    this.load.image('snap_badge_miss_zh_m', 'assets/snap_badge_miss_zh_m.png');
    this.load.image('snap_badge_inuse_zh_g', 'assets/snap_badge_inuse_zh_g.png');
  }

  create() {
    this.anchorSystem = new AnchorSystem(tuning);

    // 创建测试关卡
    this.createTestLevel();

    // 创建角色
    this.createCharacters();

    // 设置输入
    this.setupInput();

    // 准备瞄准射线图块池
    this.aimRayTiles = [];

    // 调试面板
    if (tuning.debug.enabled) {
      this.createDebugPanel();
      this.tuningPanel = new TuningPanel(this);
      
      // T 键切换调参面板
      this.input.keyboard!.on('keydown-T', () => {
        this.tuningPanel?.toggle();
      });
    }

    // 设置相机
    this.cameras.main.setBounds(0, 0, 1920, 1080);
    this.cameras.main.startFollow(this.madman, true, 0.1, 0.1);
  }

  private createTestLevel() {
    // 保存静态平台供碰撞检测
    this.platforms = this.physics.add.staticGroup();

    // 创建地面
    const ground = this.add.rectangle(640, 800, 1280, 64, 0x4a4a4a);
    this.platforms.add(ground);

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
    this.platforms.add(wall);

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
    this.platforms.add(platform1);

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
    this.platforms.add(platform2);

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
    const charHeight = tuning.world.characterHeight * ppu; // 1.8 * 32 = 58px

    // 平台1顶部 = 600 - 32/2 = 584
    const platform1Top = 584;

    // 天才（蓝色） - 站在左侧平台上
    this.genius = this.physics.add.sprite(400, platform1Top, 'genius_char');
    this.genius.setOrigin(0.5, 1); // 底部对齐
    const geniusBody = this.genius.body as Phaser.Physics.Arcade.Body;
    geniusBody.setCollideWorldBounds(true);
    geniusBody.setSize(charHeight * 0.5, charHeight);
    geniusBody.setOffset((charHeight * 0.5) / 4, 0); // 居中碰撞体

    // 疯子（橙色） - 站在左侧平台上
    this.madman = this.physics.add.sprite(500, platform1Top, 'madman_char');
    this.madman.setOrigin(0.5, 1); // 底部对齐
    const madmanBody = this.madman.body as Phaser.Physics.Arcade.Body;
    madmanBody.setCollideWorldBounds(true);
    madmanBody.setSize(charHeight * 0.5, charHeight);
    madmanBody.setOffset((charHeight * 0.5) / 4, 0); // 居中碰撞体

    // 添加碰撞检测
    this.physics.add.collider(this.genius, this.platforms);
    this.physics.add.collider(this.madman, this.platforms);

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

    // 鼠标点击放置锚点
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.isAiming = true;
      }
    });

    this.input.on('pointerup', (_pointer: Phaser.Input.Pointer) => {
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

  update(_time: number, delta: number) {
    const dt = delta / 1000;

    // 更新冷却（限制在 0 以上）
    if (this.dashCooldown > 0) {
      this.dashCooldown -= dt;
      if (this.dashCooldown < 0) {
        this.dashCooldown = 0;
      }
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

    // 渲染瞄准射线（使用可平铺的图块）
    const rayKey = validation.valid ? 'aim_ray_valid_g' : 'aim_ray_forbidden_g';
    const dx = worldPoint.x - this.genius.x;
    const dy = worldPoint.y - this.genius.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // 清除旧的射线图块
    this.aimRayTiles.forEach((tile) => tile.destroy());
    this.aimRayTiles = [];

    // 创建新的射线图块（每128px一块，缩放0.75）
    const tileWidth = 128 * 0.75;
    const numTiles = Math.ceil(distance / tileWidth);
    
    for (let i = 0; i < numTiles; i++) {
      const tile = this.add.image(0, 0, rayKey);
      tile.setOrigin(0, 0.5);
      tile.setScale(0.75);
      tile.setRotation(angle);
      const x = this.genius.x + Math.cos(angle) * i * tileWidth;
      const y = this.genius.y + Math.sin(angle) * i * tileWidth;
      tile.setPosition(x, y);
      tile.setAlpha(validation.valid ? 0.8 : 0.5);
      this.aimRayTiles.push(tile);
    }

    // 渲染准星
    const reticleKey = validation.valid ? 'aim_reticle_valid_g' : 'aim_reticle_forbidden_g';
    if (!this.aimReticle) {
      this.aimReticle = this.add.image(0, 0, reticleKey);
      this.aimReticle.setScale(0.75);
    } else {
      this.aimReticle.setTexture(reticleKey);
    }
    this.aimReticle.setPosition(worldPoint.x, worldPoint.y);
    this.aimReticle.setVisible(true);
    this.aimReticle.setAlpha(validation.valid ? 1.0 : 0.6);

    // 显示失败原因
    if (!validation.valid && validation.reason === 'locked_anchor') {
      if (!this.snapBadge) {
        this.snapBadge = this.add.image(0, 0, 'snap_badge_inuse_zh_g');
        this.snapBadge.setScale(0.9);
      } else {
        this.snapBadge.setTexture('snap_badge_inuse_zh_g');
      }
      this.snapBadge.setPosition(worldPoint.x, worldPoint.y - 90);
      this.snapBadge.setVisible(true);
    } else if (this.snapBadge) {
      this.snapBadge.setVisible(false);
    }
  }

  private clearAiming() {
    // 清除射线图块
    this.aimRayTiles.forEach((tile) => tile.destroy());
    this.aimRayTiles = [];
    
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
    const pos = this.unitsToPixels(anchor.position.x, anchor.position.y);

    const container = this.add.container(pos.x, pos.y);

    // 光圈（使用美术资源）
    const haloKey = this.getAnchorHaloKey(anchor.state);
    const halo = this.add.image(0, 0, haloKey);
    halo.setScale(0.5); // 外径约 2.2 单位 ≈ 108px
    container.add(halo);

    // 吸附半径环（疯子视角用 _m 变体）
    const snapRadius = tuning.madman.snapRadius * tuning.world.pixelsPerUnit;
    const snapRing = this.add.image(0, 0, 'snap_ring_thin_m');
    // 环半径 118px ↔ 判定半径 2.0 单位，缩放 = (2.0×32)/118 ≈ 0.54
    const ringScale = snapRadius / 118;
    snapRing.setScale(ringScale);
    snapRing.setAlpha(0.4);
    snapRing.setVisible(false);
    container.add(snapRing);

    // 可吸附徽标
    const snapBadge = this.add.image(0, -90, 'snap_badge_snap_zh_m');
    snapBadge.setScale(0.9);
    snapBadge.setVisible(false);
    container.add(snapBadge);

    container.setData('halo', halo);
    container.setData('snapRing', snapRing);
    container.setData('snapBadge', snapBadge);

    this.anchorSprites.set(anchor.id, container);
  }

  private getAnchorHaloKey(state: AnchorState): string {
    switch (state) {
      case AnchorState.Ready:
        return 'anchor_halo_ready_g';
      case AnchorState.Snap:
        return 'anchor_halo_snap_g';
      case AnchorState.Locked:
        return 'anchor_halo_locked_g';
      default:
        return 'anchor_halo_ready_g';
    }
  }

  private updateAnchorHalo(
    halo: Phaser.GameObjects.Image,
    state: AnchorState
  ) {
    const haloKey = this.getAnchorHaloKey(state);
    halo.setTexture(haloKey);
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
        const halo = sprite.getData('halo') as Phaser.GameObjects.Image;
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

      // 窗口逻辑：按住冲刺键延长，但释放不会提前结束
      const held = this.shiftKey.isDown || (this as any).testHoldDash;
      const limit = held ? tuning.madman.aimWindowMax : tuning.madman.aimWindowBase;

      if (this.aimWindowTimer >= limit) {
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

    // 调试日志
    console.log('[tryDash] 检查吸附', {
      madmanPos,
      madmanPixels: { x: this.madman.x, y: this.madman.y },
      direction,
      dashDistance: tuning.madman.shortDashDistance,
      anchors: this.anchorSystem.getAnchors().map(a => ({ 
        id: a.id.substring(0,8),
        pos: a.position,
        state: a.state 
      })),
      snapResult,
    });

    if (snapResult.snapped && snapResult.hoverPoint) {
      // 吸附成功
      this.isSnapped = true;
      this.snappedAnchorId = snapResult.anchorId!;
      this.aimWindowTimer = 0;
      this.anchorSystem.lockAnchor(snapResult.anchorId!);

      // 移动到悬停点并禁用重力
      const hoverPixels = this.unitsToPixels(
        snapResult.hoverPoint.x,
        snapResult.hoverPoint.y
      );
      this.madman.setPosition(hoverPixels.x, hoverPixels.y);
      this.madman.setVelocity(0, 0);
      
      const body = this.madman.body as Phaser.Physics.Arcade.Body;
      body.allowGravity = false;
    } else {
      // 短冲刺
      this.performShortDash(direction);
      this.showMissBadge();
    }

    this.dashCooldown = tuning.madman.dashCooldown;
  }

  private performShortDash(direction: Vec2) {
    // 运动学冲刺：直接移动位置
    const dashDistance = tuning.madman.shortDashDistance * tuning.world.pixelsPerUnit;
    const targetX = this.madman.x + direction.x * dashDistance;
    const targetY = this.madman.y + direction.y * dashDistance;
    
    // 禁用重力并移动
    const body = this.madman.body as Phaser.Physics.Arcade.Body;
    const oldGravity = body.allowGravity;
    body.allowGravity = false;
    
    this.madman.setPosition(targetX, targetY);
    this.madman.setVelocity(0, 0);
    
    // 恢复重力
    this.time.delayedCall(100, () => {
      if (this.madman && this.madman.body) {
        (this.madman.body as Phaser.Physics.Arcade.Body).allowGravity = oldGravity;
      }
    });
  }

  private launchFromAnchor() {
    // Phase 1: 禁用弹射机制
    // 瞄准窗口结束后，疯子简单释放/坠落
    
    if (!this.snappedAnchorId) return;

    // 解锁锚点（但不移除）
    this.anchorSystem.unlockAnchor(this.snappedAnchorId);

    // 简单释放：清除水平速度，恢复重力
    this.madman.setVelocityX(0);
    const body = this.madman.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = true;

    this.isSnapped = false;
    this.snappedAnchorId = null;
  }

  private showMissBadge() {
    if (!this.snapBadge) {
      this.snapBadge = this.add.image(0, 0, 'snap_badge_miss_zh_m');
      this.snapBadge.setScale(0.9);
    } else {
      this.snapBadge.setTexture('snap_badge_miss_zh_m');
    }

    this.snapBadge.setPosition(this.madman.x, this.madman.y - 80);
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
      '  按 T 键: 打开调参面板',
      '',
      'Phase 1 范围:',
      '  ✅ 锚点放置 + FIFO + 锁定',
      '  ✅ 冲刺吸附 + 瞄准窗口',
      '  ❌ 弹射（Phase 2）',
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
