/**
 * 游戏主场景
 * 集成 AnchorSystem 核心逻辑与 Phaser 渲染
 */

import Phaser from 'phaser';
import { AnchorSystem, Vec2, Surface, AnchorState, Anchor } from '../engine/anchorSystem';
import { tuning } from '../config/tuning';
import { TuningPanel } from '../ui/TuningPanel';
import { getCurrentLevel, LevelConfig } from '../config/levels';

export class GameScene extends Phaser.Scene {
  private anchorSystem!: AnchorSystem;
  private surfaces: Surface[] = [];
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  public frozen = false; // 冻结标志（用于截图）

  // Phase 3: 关卡配置
  private level!: LevelConfig;
  
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
  private consumeAnchor = false; // Phase 2: 锚点消耗机制
  public testHoldDash = false; // E2E测试钩子：模拟按住冲刺键
  private prevShift = false; // Shift边缘检测
  private aimDirection: Vec2 = { x: 0, y: -1 }; // Phase 2: 瞄准方向（默认向上）
  private incomingDashDir: Vec2 = { x: 1, y: 0 }; // Phase 2: 冲刺进入方向
  private cKeyDown = false; // Phase 2: C键状态
  private lastLaunchSpeed = 0; // Phase 2: 最后一次发射的速度（u/s）
  private launchAirTime = -1; // Phase 2: 发射后空中时间（-1表示未发射，≥0表示发射后）
  private lastLaunch = { vx: 0, vy: 0, x: 0, y: 0 }; // Phase 2: 最后一次发射的瞬时状态（px/s, px）

  // Phase 3: 关卡机制状态
  private bridgeExtended = false;
  private bridgeSprite: Phaser.GameObjects.Rectangle | null = null;
  private bridgePhysics: Phaser.Physics.Arcade.Image | null = null;
  private pressurePlateSprite: Phaser.GameObjects.Rectangle | null = null;
  private exitZoneSprite: Phaser.GameObjects.Rectangle | null = null;
  private checkpointPos: Vec2 = { x: 0, y: 0 };
  private bothInExit = false;
  private levelCleared = false;
  private clearMessage: Phaser.GameObjects.Text | null = null;
  
  // 渲染对象
  private anchorSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private aimRayTiles: Phaser.GameObjects.Image[] = [];
  private aimReticle: Phaser.GameObjects.Image | null = null;
  private snapBadge: Phaser.GameObjects.Image | null = null;
  private trajectoryDots: Phaser.GameObjects.Graphics[] = []; // Phase 2: 轨迹预览点

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
    
    // Phase 2: 加载「已吸附」徽标
    this.load.image('snap_badge_snapped_zh_g', 'assets/snap_badge_snapped_zh_g.png');
    this.load.image('snap_badge_snapped_zh_m', 'assets/snap_badge_snapped_zh_m.png');
    
    // Phase 2: 加载粗吸附半径环
    this.load.image('snap_ring_bold_g', 'assets/snap_ring_bold_g.png');
    this.load.image('snap_ring_bold_m', 'assets/snap_ring_bold_m.png');
  }

  create() {
    this.anchorSystem = new AnchorSystem(tuning);

    // Phase 3: 加载关卡配置（支持通过 URL 参数切换）
    const urlParams = new URLSearchParams(window.location.search);
    const levelId = urlParams.get('level') || 'riftFirstLeap';
    this.level = getCurrentLevel(levelId);

    // 创建关卡
    if (this.level.id === 'test_level') {
      this.createPhase12TestLevel();
    } else {
      this.createPhase3Level();
    }

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

  private createPhase12TestLevel() {
    // Phase 1/2: 创建原始测试关卡（保持向后兼容）
    this.platforms = this.physics.add.staticGroup();
    const ppu = tuning.world.pixelsPerUnit;

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
    
    // 检查点设置为平台中心
    this.checkpointPos = { x: 12.5, y: 18.25 };
  }

  private createPhase3Level() {
    // Phase 3: 创建「裂谷初跃」关卡
    this.platforms = this.physics.add.staticGroup();
    const ppu = tuning.world.pixelsPerUnit;
    const layout = this.level.layout;

    // === 左侧起始平台 ===
    const leftPlatformPx = {
      x: layout.leftPlatform.x * ppu,
      y: layout.leftPlatform.y * ppu,
      width: layout.leftPlatform.width * ppu,
      height: layout.leftPlatform.height * ppu,
    };
    
    const leftPlatform = this.add.rectangle(
      leftPlatformPx.x,
      leftPlatformPx.y,
      leftPlatformPx.width,
      leftPlatformPx.height,
      0x5a9a5a
    );
    this.platforms.add(leftPlatform);
    
    this.surfaces.push({
      id: 'left_platform',
      isAttachable: true,
      points: [
        { x: layout.leftPlatform.x - layout.leftPlatform.width / 2, y: layout.leftPlatform.y - layout.leftPlatform.height / 2 },
        { x: layout.leftPlatform.x + layout.leftPlatform.width / 2, y: layout.leftPlatform.y - layout.leftPlatform.height / 2 },
        { x: layout.leftPlatform.x + layout.leftPlatform.width / 2, y: layout.leftPlatform.y + layout.leftPlatform.height / 2 },
        { x: layout.leftPlatform.x - layout.leftPlatform.width / 2, y: layout.leftPlatform.y + layout.leftPlatform.height / 2 },
      ],
    });

    this.add.text(leftPlatformPx.x, leftPlatformPx.y - 40, '起点', {
      fontSize: '16px',
      color: '#fff',
    }).setOrigin(0.5);

    // === 右侧目标平台 ===
    const rightPlatformPx = {
      x: layout.rightPlatform.x * ppu,
      y: layout.rightPlatform.y * ppu,
      width: layout.rightPlatform.width * ppu,
      height: layout.rightPlatform.height * ppu,
    };
    
    const rightPlatform = this.add.rectangle(
      rightPlatformPx.x,
      rightPlatformPx.y,
      rightPlatformPx.width,
      rightPlatformPx.height,
      0x5a9a5a
    );
    this.platforms.add(rightPlatform);
    
    this.surfaces.push({
      id: 'right_platform',
      isAttachable: true,
      points: [
        { x: layout.rightPlatform.x - layout.rightPlatform.width / 2, y: layout.rightPlatform.y - layout.rightPlatform.height / 2 },
        { x: layout.rightPlatform.x + layout.rightPlatform.width / 2, y: layout.rightPlatform.y - layout.rightPlatform.height / 2 },
        { x: layout.rightPlatform.x + layout.rightPlatform.width / 2, y: layout.rightPlatform.y + layout.rightPlatform.height / 2 },
        { x: layout.rightPlatform.x - layout.rightPlatform.width / 2, y: layout.rightPlatform.y + layout.rightPlatform.height / 2 },
      ],
    });

    this.add.text(rightPlatformPx.x, rightPlatformPx.y - 40, '目标', {
      fontSize: '16px',
      color: '#fff',
    }).setOrigin(0.5);

    // === 可吸附板（凸台）===
    const platePx = {
      x: layout.attachablePlate.x * ppu,
      y: layout.attachablePlate.y * ppu,
      width: layout.attachablePlate.width * ppu,
      height: layout.attachablePlate.height * ppu,
    };
    
    const attachablePlate = this.add.rectangle(
      platePx.x,
      platePx.y,
      platePx.width,
      platePx.height,
      0x7aaa7a
    );
    this.platforms.add(attachablePlate);
    
    this.surfaces.push({
      id: 'attachable_plate',
      isAttachable: true,
      points: [
        { x: layout.attachablePlate.x - layout.attachablePlate.width / 2, y: layout.attachablePlate.y - layout.attachablePlate.height / 2 },
        { x: layout.attachablePlate.x + layout.attachablePlate.width / 2, y: layout.attachablePlate.y - layout.attachablePlate.height / 2 },
        { x: layout.attachablePlate.x + layout.attachablePlate.width / 2, y: layout.attachablePlate.y + layout.attachablePlate.height / 2 },
        { x: layout.attachablePlate.x - layout.attachablePlate.width / 2, y: layout.attachablePlate.y + layout.attachablePlate.height / 2 },
      ],
    });

    this.add.text(platePx.x, platePx.y, '锚点板', {
      fontSize: '12px',
      color: '#fff',
    }).setOrigin(0.5);

    // === 裂谷（深色背景）===
    const riftCenterX = (layout.leftPlatform.x + layout.leftPlatform.width / 2 + layout.rightPlatform.x - layout.rightPlatform.width / 2) / 2;
    const riftWidth = layout.riftWidth * ppu;
    const riftY = layout.leftPlatform.y * ppu + 150;
    
    this.add.rectangle(riftCenterX * ppu, riftY, riftWidth, 200, 0x1a1a1a);
    this.add.text(riftCenterX * ppu, riftY, '裂谷 (10u)', {
      fontSize: '20px',
      color: '#666',
    }).setOrigin(0.5);

    // === 压力板 ===
    const pressurePlatePx = {
      x: layout.pressurePlate.x * ppu,
      y: layout.pressurePlate.y * ppu,
      width: layout.pressurePlate.width * ppu,
      height: layout.pressurePlate.height * ppu,
    };
    
    this.pressurePlateSprite = this.add.rectangle(
      pressurePlatePx.x,
      pressurePlatePx.y,
      pressurePlatePx.width,
      pressurePlatePx.height,
      0xffaa00
    );
    
    this.add.text(pressurePlatePx.x, pressurePlatePx.y - 25, '压力板', {
      fontSize: '12px',
      color: '#fff',
    }).setOrigin(0.5);

    // === 桥梁（初始收回）===
    const bridgePx = {
      retractedX: layout.bridge.retractedX * ppu,
      y: layout.bridge.y * ppu,
      width: layout.bridge.width * ppu,
      height: layout.bridge.height * ppu,
    };
    
    this.bridgeSprite = this.add.rectangle(
      bridgePx.retractedX,
      bridgePx.y,
      bridgePx.width,
      bridgePx.height,
      0x8a7a5a
    );
    this.bridgeSprite.setVisible(false); // 初始隐藏
    
    // 创建桥梁物理体（使用 physics.add.image）
    this.bridgePhysics = this.physics.add.image(
      bridgePx.retractedX,
      bridgePx.y,
      ''
    ).setVisible(false);
    
    const bridgeBody = this.bridgePhysics.body as Phaser.Physics.Arcade.Body;
    bridgeBody.setImmovable(true);
    bridgeBody.setAllowGravity(false);
    bridgeBody.setSize(bridgePx.width, bridgePx.height);
    bridgeBody.enable = false; // 初始禁用碰撞

    // === 出口区 ===
    const exitPx = {
      x: layout.exitZone.x * ppu,
      y: layout.exitZone.y * ppu,
      width: layout.exitZone.width * ppu,
      height: layout.exitZone.height * ppu,
    };
    
    this.exitZoneSprite = this.add.rectangle(
      exitPx.x,
      exitPx.y,
      exitPx.width,
      exitPx.height,
      0x00ff00,
      0.3
    );
    
    this.add.text(exitPx.x, exitPx.y, '出口', {
      fontSize: '16px',
      color: '#fff',
      backgroundColor: '#0008',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5);

    // === 检查点 ===
    this.checkpointPos = {
      x: layout.checkpoint.x,
      y: layout.checkpoint.y,
    };
    
    this.add.text(layout.checkpoint.x * ppu, (layout.checkpoint.y - 1) * ppu, '检查点', {
      fontSize: '12px',
      color: '#00ffff',
    }).setOrigin(0.5);
  }

  private createCharacters() {
    const ppu = tuning.world.pixelsPerUnit;
    const charHeight = tuning.world.characterHeight * ppu; // 1.8 * 32 = 58px

    // Phase 3: 在检查点位置生成角色
    const spawnX = this.checkpointPos.x * ppu;
    const spawnY = this.checkpointPos.y * ppu;

    // 天才（蓝色）
    this.genius = this.physics.add.sprite(spawnX - 20, spawnY, 'genius_char');
    this.genius.setOrigin(0.5, 1); // 底部对齐
    const geniusBody = this.genius.body as Phaser.Physics.Arcade.Body;
    geniusBody.setCollideWorldBounds(true);
    geniusBody.setSize(charHeight * 0.5, charHeight);
    geniusBody.setOffset((charHeight * 0.5) / 4, 0);

    // 疯子（橙色）
    this.madman = this.physics.add.sprite(spawnX + 20, spawnY, 'madman_char');
    this.madman.setOrigin(0.5, 1); // 底部对齐
    const madmanBody = this.madman.body as Phaser.Physics.Arcade.Body;
    madmanBody.setCollideWorldBounds(true);
    madmanBody.setSize(charHeight * 0.5, charHeight);
    madmanBody.setOffset((charHeight * 0.5) / 4, 0);

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

    // Phase 2: C键用于消耗锚点
    this.input.keyboard!.on('keydown-C', () => {
      this.cKeyDown = true;
    });
    this.input.keyboard!.on('keyup-C', () => {
      this.cKeyDown = false;
    });

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
    // 冻结时跳过更新
    if (this.frozen) {
      return;
    }
    
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

    // Phase 3: 更新关卡机制
    this.updatePressurePlate();
    this.updateExitZone();
    this.checkDeathZone();

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

  public placeAnchorAtPosition(pos: Vec2): { success: boolean; reason?: string } {
    // 直接放置锚点（用于测试）
    const anchor = this.anchorSystem.placeAnchor(pos, 'ground');

    if (anchor) {
      this.createAnchorSprite(anchor);
      return { success: true };
    } else {
      // 放置失败（所有锚点被锁定）- 显示"使用中"徽标在被锁定的锚点上
      this.showInUseBadge();
      return { success: false, reason: 'locked_anchor' };
    }
  }

  private showInUseBadge() {
    // 找到被锁定的锚点并显示"使用中"徽标
    const anchors = this.anchorSystem.getAnchors();
    const lockedAnchor = anchors.find(a => a.state === 'locked');
    
    if (lockedAnchor) {
      const pos = this.unitsToPixels(lockedAnchor.position.x, lockedAnchor.position.y);
      
      if (!this.snapBadge) {
        this.snapBadge = this.add.image(0, 0, 'snap_badge_inuse_zh_g');
        this.snapBadge.setScale(0.9);
      } else {
        this.snapBadge.setTexture('snap_badge_inuse_zh_g');
      }
      
      this.snapBadge.setPosition(pos.x, pos.y - 90);
      this.snapBadge.setVisible(true);
      
      // 1秒后隐藏
      this.time.delayedCall(1000, () => {
        if (this.snapBadge) {
          this.snapBadge.setVisible(false);
        }
      });
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

    // Phase 2: 吸附半径环（使用粗环美术资源）
    // snapRadius已经是像素: 2.0u * 32px/u = 64px
    const snapRadiusPx = tuning.madman.snapRadius * tuning.world.pixelsPerUnit;
    const snapRing = this.add.image(0, 0, 'snap_ring_bold_m');
    // 环纹理半径 118px，缩放 = 64/118 ≈ 0.542
    const ringScale = snapRadiusPx / 118;
    snapRing.setScale(ringScale);
    snapRing.setAlpha(0.9); // 更高不透明度以更清晰可见
    snapRing.setVisible(true); // 始终可见
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

    // Phase 2: 发射后空中时间管理
    const isAirborne = this.launchAirTime >= 0;
    if (isAirborne) {
      this.launchAirTime += dt;
      
      // 落地检测：给予延迟让疯子先离开地面，之后才检测落地
      if (this.launchAirTime > tuning.madman.launchLandingGraceS && 
          (body.blocked.down || body.touching.down)) {
        this.launchAirTime = -1;
      }
      
      // 发射后输入锁定期间，完全由发射速度控制，不接受输入
      if (this.launchAirTime < tuning.madman.launchInputLockS) {
        return; // 完全跳过移动控制，保持发射动量
      }
    }

    // 吸附状态
    if (this.isSnapped) {
      this.aimWindowTimer += dt;

      // Phase 2: 方向键选择瞄准方向
      this.updateAimDirection();

      // Phase 2: 更新消耗锚点状态
      this.consumeAnchor = this.cKeyDown;

      // Phase 2: 显示轨迹预览
      this.updateTrajectoryPreview();

      // 窗口逻辑：按住冲刺键延长，但释放不会提前结束
      const held = this.shiftKey.isDown || (this as any).testHoldDash;
      const limit = held ? tuning.madman.aimWindowMax : tuning.madman.aimWindowBase;

      if (this.aimWindowTimer >= limit) {
        this.launchFromAnchor();
      }

      return;
    }

    // Phase 2: 清除轨迹预览
    this.clearTrajectoryPreview();

    // 正常移动
    // Phase 2: 发射后空中时不清零vx，保持动量
    const isAirborneLaunch = this.launchAirTime >= 0;
    
    if (this.cursors.left!.isDown) {
      body.setVelocityX(-speed);
    } else if (this.cursors.right!.isDown) {
      body.setVelocityX(speed);
    } else if (!isAirborneLaunch) {
      // 只在非空中发射状态时清零vx
      body.setVelocityX(0);
    }
    // 空中发射且无按键时：保持vx，不修改

    // 冲刺（边缘检测：仅在按下时触发，不在持续按住时）
    const shiftPressed = this.shiftKey.isDown && !this.prevShift;
    this.prevShift = this.shiftKey.isDown;
    
    if (shiftPressed && this.dashCooldown <= 0) {
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

    // Phase 2: 记录进入方向
    this.incomingDashDir = { ...direction };

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

      // Phase 2: 初始化瞄准方向为锚点的发射轴（默认向上）
      this.aimDirection = { x: 0, y: -1 };

      // 移动到悬停点并禁用重力
      const hoverPixels = this.unitsToPixels(
        snapResult.hoverPoint.x,
        snapResult.hoverPoint.y
      );
      this.madman.setPosition(hoverPixels.x, hoverPixels.y);
      this.madman.setVelocity(0, 0);
      
      const body = this.madman.body as Phaser.Physics.Arcade.Body;
      body.allowGravity = false;
      
      // Phase 2: 显示「已吸附」徽标
      this.showSnappedBadge();
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
    if (!this.snappedAnchorId) return;

    // Phase 2: 计算弹射速度（使用向上的发射轴）
    const launchVelocity = this.anchorSystem.calculateLaunchVelocity(
      this.incomingDashDir,
      this.aimDirection,
      this.consumeAnchor,
      { x: 0, y: -1 } // 发射轴向上
    );

    // 记录发射时刻的速度（u/s）
    this.lastLaunchSpeed = Math.sqrt(
      launchVelocity.x * launchVelocity.x + 
      launchVelocity.y * launchVelocity.y
    );

    // Phase 2: 如果消耗锚点，则移除锚点
    if (this.consumeAnchor) {
      this.anchorSystem.removeAnchor(this.snappedAnchorId);
    } else {
      // 解锁锚点（但不移除）
      this.anchorSystem.unlockAnchor(this.snappedAnchorId);
    }

    // Phase 2: 应用弹射速度（转换为像素/秒）
    const ppu = tuning.world.pixelsPerUnit;
    const vxPx = launchVelocity.x * ppu;
    const vyPx = launchVelocity.y * ppu;
    this.madman.setVelocity(vxPx, vyPx);

    // 恢复重力
    const body = this.madman.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = true;

    // 记录发射瞬时状态（供测试使用）
    this.lastLaunch = {
      vx: vxPx,
      vy: vyPx,
      x: this.madman.x,
      y: this.madman.y
    };

    this.isSnapped = false;
    this.snappedAnchorId = null;
    this.consumeAnchor = false;
    this.launchAirTime = 0; // 开始计时空中时间
    
    // Phase 2: 隐藏「已吸附」徽标
    this.hideSnappedBadge();

    // Phase 2: 清除轨迹预览
    this.clearTrajectoryPreview();
  }

  private updateAimDirection() {
    // Phase 2: 方向键选择瞄准方向
    let inputX = 0;
    let inputY = 0;

    if (this.cursors.left!.isDown) inputX = -1;
    if (this.cursors.right!.isDown) inputX = 1;
    if (this.cursors.up!.isDown) inputY = -1;
    if (this.cursors.down!.isDown) inputY = 1;

    // 如果有输入，更新瞄准方向
    if (inputX !== 0 || inputY !== 0) {
      const len = Math.sqrt(inputX * inputX + inputY * inputY);
      this.aimDirection = { x: inputX / len, y: inputY / len };
    }
  }

  private updateTrajectoryPreview() {
    // Phase 2: 显示轨迹预览
    this.clearTrajectoryPreview();

    if (!this.snappedAnchorId) return;

    // 计算弹射速度（使用向上的发射轴）
    const launchVelocity = this.anchorSystem.calculateLaunchVelocity(
      this.incomingDashDir,
      this.aimDirection,
      this.consumeAnchor,
      { x: 0, y: -1 }
    );

    // 计算轨迹点
    const madmanPos = this.pixelsToUnits(this.madman.x, this.madman.y);
    const gravity = this.physics.world.gravity.y / tuning.world.pixelsPerUnit; // 转换为单位/秒²
    const trajectoryPoints = this.anchorSystem.calculateTrajectory(
      madmanPos,
      launchVelocity,
      gravity,
      tuning.madman.trajectoryDotCount,
      tuning.madman.trajectoryTimeStep
    );

    // 渲染轨迹点，在碰撞地面时停止
    const groundY = 25; // 单位坐标
    for (const point of trajectoryPoints) {
      // 检查是否碰到地面
      if (point.y >= groundY) break;
      
      const pixelPos = this.unitsToPixels(point.x, point.y);
      const dot = this.add.graphics();
      dot.fillStyle(0xffffff, 0.6);
      dot.fillCircle(pixelPos.x, pixelPos.y, 3);
      this.trajectoryDots.push(dot);
    }
    
    // 绘制锥角边缘（±70°从向上轴）
    this.drawConeEdges();
  }

  private drawConeEdges() {
    // 绘制两条锥角边缘线
    if (!this.snappedAnchorId || !this.madman) return;
    
    const coneAngle = tuning.madman.coneHalfAngleDeg;
    const lineLength = 200; // 像素
    const startX = this.madman.x;
    const startY = this.madman.y;
    
    // 向上轴 = -90°
    const axisAngle = -90 * Math.PI / 180;
    
    // 左边缘
    const leftAngle = axisAngle - coneAngle * Math.PI / 180;
    const leftEndX = startX + Math.cos(leftAngle) * lineLength;
    const leftEndY = startY + Math.sin(leftAngle) * lineLength;
    
    const leftLine = this.add.graphics();
    leftLine.lineStyle(2, 0xffaa00, 0.5);
    leftLine.lineBetween(startX, startY, leftEndX, leftEndY);
    this.trajectoryDots.push(leftLine);
    
    // 右边缘
    const rightAngle = axisAngle + coneAngle * Math.PI / 180;
    const rightEndX = startX + Math.cos(rightAngle) * lineLength;
    const rightEndY = startY + Math.sin(rightAngle) * lineLength;
    
    const rightLine = this.add.graphics();
    rightLine.lineStyle(2, 0xffaa00, 0.5);
    rightLine.lineBetween(startX, startY, rightEndX, rightEndY);
    this.trajectoryDots.push(rightLine);
  }

  private clearTrajectoryPreview() {
    // Phase 2: 清除轨迹预览
    for (const dot of this.trajectoryDots) {
      dot.destroy();
    }
    this.trajectoryDots = [];
  }

  private showSnappedBadge() {
    // Phase 2: 显示「已吸附」徽标（使用真实美术资源）
    if (!this.snapBadge) {
      this.snapBadge = this.add.image(0, 0, 'snap_badge_snapped_zh_m');
      this.snapBadge.setScale(0.9);
    } else {
      this.snapBadge.setTexture('snap_badge_snapped_zh_m');
    }

    this.snapBadge.setPosition(this.madman.x, this.madman.y - 80);
    this.snapBadge.setVisible(true);
  }

  private hideSnappedBadge() {
    // Phase 2: 隐藏「已吸附」徽标
    if (this.snapBadge) {
      this.snapBadge.setVisible(false);
    }
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
    
    // Phase 2: 计算三个角度值
    let rawAngle = 0;
    let clampedAngle = 0;
    let finalAngle = 0;
    let launchSpeed = 0;
    
    if (this.isSnapped) {
      const angles = this.anchorSystem.calculateAimAngles(
        this.incomingDashDir,
        this.aimDirection,
        { x: 0, y: -1 } // 发射轴向上
      );
      rawAngle = angles.rawAngle;
      clampedAngle = angles.clampedAngle;
      finalAngle = angles.finalAngle;
      
      // 计算发射速度（calculateLaunchVelocity返回值已经是u/s）
      const launchVelocity = this.anchorSystem.calculateLaunchVelocity(
        this.incomingDashDir,
        this.aimDirection,
        this.consumeAnchor,
        { x: 0, y: -1 }
      );
      launchSpeed = Math.sqrt(
        launchVelocity.x * launchVelocity.x + 
        launchVelocity.y * launchVelocity.y
      ); // 不需要除以pixelsPerUnit，已经是u/s
    }
    
    const lines = [
      `锚点数: ${anchors.length}/${tuning.genius.maxAnchors}`,
      `冲刺冷却: ${this.dashCooldown.toFixed(2)}s`,
      `是否吸附: ${this.isSnapped ? '是' : '否'}`,
      `瞄准窗口: ${this.isSnapped ? this.aimWindowTimer.toFixed(2) : '-'}s`,
      `原始输入: ${this.isSnapped ? rawAngle.toFixed(1) + '°' : '-'}`,
      `限制瞄准: ${this.isSnapped ? clampedAngle.toFixed(1) + '°' : '-'}`,
      `最终发射: ${this.isSnapped ? finalAngle.toFixed(1) + '°' : '-'}`,
      `发射速度: ${this.isSnapped ? launchSpeed.toFixed(1) + ' u/s' : this.lastLaunchSpeed > 0 ? this.lastLaunchSpeed.toFixed(1) + ' u/s' : '-'}`,
      `消耗锚点: ${this.consumeAnchor ? '是' : '否'}`,
      '',
      '操作:',
      '  天才: WASD 移动, 鼠标点击放置锚点',
      '  疯子: 方向键移动, Shift 冲刺',
      '  吸附时: 方向键瞄准, C键消耗锚点',
      '  按 T 键: 打开调参面板',
      '',
      'Phase 2 范围:',
      '  ✅ 锚点放置 + FIFO + 锁定',
      '  ✅ 冲刺吸附 + 瞄准窗口',
      '  ✅ 方向瞄准 + 轨迹预览',
      '  ✅ 弹射发射 + 保留/消耗',
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

  // ===== Phase 3: 关卡机制 =====

  private updatePressurePlate() {
    if (!this.pressurePlateSprite || this.bridgeExtended) {
      return; // 桥梁已伸出，不再检查
    }

    const ppu = tuning.world.pixelsPerUnit;
    const layout = this.level.layout;
    
    // 检查疯子是否站在压力板上
    const madmanU = this.pixelsToUnits(this.madman.x, this.madman.y);
    const plateLeft = layout.pressurePlate.x - layout.pressurePlate.width / 2;
    const plateRight = layout.pressurePlate.x + layout.pressurePlate.width / 2;
    const plateTop = layout.pressurePlate.y - layout.pressurePlate.height / 2;
    const plateBottom = layout.pressurePlate.y + layout.pressurePlate.height / 2;
    
    const madmanOnPlate = (
      madmanU.x >= plateLeft &&
      madmanU.x <= plateRight &&
      madmanU.y >= plateTop &&
      madmanU.y <= plateBottom
    );

    if (madmanOnPlate && !this.bridgeExtended) {
      this.extendBridge();
    }
  }

  private extendBridge() {
    if (this.bridgeExtended || !this.bridgeSprite || !this.bridgePhysics) {
      return;
    }

    this.bridgeExtended = true;
    const ppu = tuning.world.pixelsPerUnit;
    const layout = this.level.layout;
    
    // 伸出桥梁到目标位置
    const targetX = layout.bridge.extendedX * ppu;
    
    this.bridgeSprite.setVisible(true);
    this.bridgePhysics.setVisible(false); // 保持不可见，仅用于碰撞
    
    // 动画伸出
    this.tweens.add({
      targets: [this.bridgeSprite, this.bridgePhysics],
      x: targetX,
      duration: layout.bridge.extendDuration * 1000,
      ease: 'Power2',
      onComplete: () => {
        // 启用碰撞
        const bridgeBody = this.bridgePhysics!.body as Phaser.Physics.Arcade.Body;
        bridgeBody.enable = true;
        
        // 添加与角色的碰撞
        this.physics.add.collider(this.genius, this.bridgePhysics!);
        this.physics.add.collider(this.madman, this.bridgePhysics!);
      },
    });

    // 压力板变色
    this.pressurePlateSprite!.setFillStyle(0x00ff00);
  }

  private updateExitZone() {
    if (this.levelCleared) {
      return;
    }

    const ppu = tuning.world.pixelsPerUnit;
    const layout = this.level.layout;
    
    // 检查双方是否都在出口区
    const geniusU = this.pixelsToUnits(this.genius.x, this.genius.y);
    const madmanU = this.pixelsToUnits(this.madman.x, this.madman.y);
    
    const exitLeft = layout.exitZone.x - layout.exitZone.width / 2;
    const exitRight = layout.exitZone.x + layout.exitZone.width / 2;
    const exitTop = layout.exitZone.y - layout.exitZone.height / 2;
    const exitBottom = layout.exitZone.y + layout.exitZone.height / 2;
    
    const geniusInExit = (
      geniusU.x >= exitLeft &&
      geniusU.x <= exitRight &&
      geniusU.y >= exitTop &&
      geniusU.y <= exitBottom
    );
    
    const madmanInExit = (
      madmanU.x >= exitLeft &&
      madmanU.x <= exitRight &&
      madmanU.y >= exitTop &&
      madmanU.y <= exitBottom
    );

    if (geniusInExit && madmanInExit && !this.bothInExit) {
      this.bothInExit = true;
      this.showClearMessage();
    } else if (!(geniusInExit && madmanInExit)) {
      this.bothInExit = false;
    }
  }

  private showClearMessage() {
    this.levelCleared = true;
    
    if (this.clearMessage) {
      this.clearMessage.destroy();
    }

    this.clearMessage = this.add.text(960, 540, '通关！\n双人协作成功！', {
      fontSize: '48px',
      color: '#fff',
      backgroundColor: '#00aa00',
      padding: { x: 20, y: 20 },
      align: 'center',
    });
    this.clearMessage.setOrigin(0.5);
    this.clearMessage.setScrollFactor(0);
    this.clearMessage.setDepth(2000);
  }

  private checkDeathZone() {
    const ppu = tuning.world.pixelsPerUnit;
    const deathY = this.level.mechanics.deathZoneY * ppu;
    
    // 检查任一角色是否掉入死亡区
    if (this.genius.y > deathY || this.madman.y > deathY) {
      this.respawnAtCheckpoint();
    }
  }

  private respawnAtCheckpoint() {
    const ppu = tuning.world.pixelsPerUnit;
    const spawnX = this.checkpointPos.x * ppu;
    const spawnY = this.checkpointPos.y * ppu;

    // 重置双方位置
    this.genius.setPosition(spawnX - 20, spawnY);
    this.genius.setVelocity(0, 0);
    
    this.madman.setPosition(spawnX + 20, spawnY);
    this.madman.setVelocity(0, 0);

    // 重置锚点系统
    this.anchorSystem.clearAnchors();
    this.anchorSprites.forEach((container) => container.destroy());
    this.anchorSprites.clear();
    
    // 重置吸附状态
    this.isSnapped = false;
    this.snappedAnchorId = null;
    this.aimWindowTimer = 0;
    this.dashCooldown = 0;
  }
}
