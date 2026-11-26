/**
 * 锚点系统单元测试
 * 覆盖接受条件 1-5 以及被打断规则
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnchorSystem,
  Vec2,
  Surface,
  DashPath,
} from '../src/engine/anchorSystem';
import { defaultTuning } from '../src/config/tuning';

describe('AnchorSystem', () => {
  let system: AnchorSystem;
  let testSurfaces: Surface[];

  beforeEach(() => {
    system = new AnchorSystem(defaultTuning);
    testSurfaces = [
      {
        id: 'ground',
        isAttachable: true,
        points: [
          { x: 0, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 11 },
          { x: 0, y: 11 },
        ],
      },
      {
        id: 'wall',
        isAttachable: true,
        points: [
          { x: 20, y: 0 },
          { x: 21, y: 0 },
          { x: 21, y: 15 },
          { x: 20, y: 15 },
        ],
      },
      {
        id: 'non_attachable',
        isAttachable: false,
        points: [
          { x: 25, y: 5 },
          { x: 30, y: 5 },
          { x: 30, y: 6 },
          { x: 25, y: 6 },
        ],
      },
    ];
  });

  describe('接受条件 1: 锚点只能落在可附着表面上', () => {
    it('应该接受在可附着表面上的放置', () => {
      const geniusPos: Vec2 = { x: 5, y: 5 };
      const targetPos: Vec2 = { x: 10, y: 10 };

      const validation = system.validatePlacement(
        geniusPos,
        targetPos,
        testSurfaces
      );

      expect(validation.valid).toBe(true);
      expect(validation.surfaceId).toBe('ground');
    });

    it('应该拒绝在空中的放置', () => {
      const geniusPos: Vec2 = { x: 5, y: 5 };
      const targetPos: Vec2 = { x: 10, y: 5 }; // 空中

      const validation = system.validatePlacement(
        geniusPos,
        targetPos,
        testSurfaces
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('no_surface');
    });

    it('应该拒绝在不可附着表面上的放置', () => {
      const geniusPos: Vec2 = { x: 20, y: 5 };
      const targetPos: Vec2 = { x: 27, y: 5 }; // non_attachable 表面（距离在射程内）

      const validation = system.validatePlacement(
        geniusPos,
        targetPos,
        testSurfaces
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('no_surface');
    });

    it('应该拒绝超出射程的放置', () => {
      const geniusPos: Vec2 = { x: 0, y: 0 };
      const targetPos: Vec2 = { x: 20, y: 10 }; // 距离 > 14 单位

      const validation = system.validatePlacement(
        geniusPos,
        targetPos,
        testSurfaces
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('out_of_range');
    });
  });

  describe('接受条件 2: 最多 2 个锚点，FIFO 替换，锁定锚点不能替换', () => {
    it('应该允许放置第 1 和第 2 个锚点', () => {
      const anchor1 = system.placeAnchor({ x: 5, y: 10 }, 'ground');
      expect(anchor1).not.toBeNull();
      expect(system.getAnchors().length).toBe(1);

      const anchor2 = system.placeAnchor({ x: 10, y: 10 }, 'ground');
      expect(anchor2).not.toBeNull();
      expect(system.getAnchors().length).toBe(2);
    });

    it('应该用 FIFO 替换第 3 个锚点', () => {
      const anchor1 = system.placeAnchor({ x: 5, y: 10 }, 'ground');
      const anchor2 = system.placeAnchor({ x: 10, y: 10 }, 'ground');
      
      // 等待一小段时间确保时间戳不同
      const anchor3 = system.placeAnchor({ x: 15, y: 10 }, 'ground');

      expect(anchor3).not.toBeNull();
      expect(system.getAnchors().length).toBe(2);

      // 验证 anchor1 被移除
      const remaining = system.getAnchors();
      expect(remaining.find((a) => a.id === anchor1!.id)).toBeUndefined();
      expect(remaining.find((a) => a.id === anchor2!.id)).toBeDefined();
      expect(remaining.find((a) => a.id === anchor3!.id)).toBeDefined();
    });

    it('应该拒绝替换被锁定的锚点', () => {
      const anchor1 = system.placeAnchor({ x: 5, y: 10 }, 'ground');
      const anchor2 = system.placeAnchor({ x: 10, y: 10 }, 'ground');

      // 锁定最旧的锚点
      system.lockAnchor(anchor1!.id);

      // 尝试放置第 3 个锚点
      const anchor3 = system.placeAnchor({ x: 15, y: 10 }, 'ground');

      // 应该替换 anchor2（第二旧的未锁定锚点）
      expect(anchor3).not.toBeNull();
      expect(system.getAnchors().length).toBe(2);

      const remaining = system.getAnchors();
      expect(remaining.find((a) => a.id === anchor1!.id)).toBeDefined();
      expect(remaining.find((a) => a.id === anchor2!.id)).toBeUndefined();
    });

    it('当所有锚点都被锁定时，应该拒绝放置', () => {
      const anchor1 = system.placeAnchor({ x: 5, y: 10 }, 'ground');
      const anchor2 = system.placeAnchor({ x: 10, y: 10 }, 'ground');

      // 锁定所有锚点
      system.lockAnchor(anchor1!.id);
      system.lockAnchor(anchor2!.id);

      // 尝试放置第 3 个锚点应该失败
      const anchor3 = system.placeAnchor({ x: 15, y: 10 }, 'ground');
      expect(anchor3).toBeNull();
      expect(system.getAnchors().length).toBe(2);
    });

    it('验证放置失败提示（locked_anchor）', () => {
      const anchor1 = system.placeAnchor({ x: 5, y: 10 }, 'ground');
      const anchor2 = system.placeAnchor({ x: 10, y: 10 }, 'ground');

      system.lockAnchor(anchor1!.id);
      system.lockAnchor(anchor2!.id);

      const geniusPos: Vec2 = { x: 5, y: 5 };
      const targetPos: Vec2 = { x: 15, y: 10 };

      const validation = system.validatePlacement(
        geniusPos,
        targetPos,
        testSurfaces
      );

      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('locked_anchor');
    });
  });

  describe('接受条件 3: 冲刺路径进入吸附半径时自动吸附', () => {
    it('当路径进入吸附半径时应该吸附', () => {
      const anchor = system.placeAnchor({ x: 10, y: 10 }, 'ground');

      const dashPath: DashPath = {
        start: { x: 5, y: 10 },
        direction: { x: 1, y: 0 }, // 向右冲刺
        distance: 10,
      };

      const result = system.checkSnapAlongPath(dashPath);

      expect(result.snapped).toBe(true);
      expect(result.anchorId).toBe(anchor!.id);
      expect(result.snapPoint).toEqual({ x: 10, y: 10 });
      expect(result.hoverPoint).toBeDefined();
    });

    it('当路径未进入吸附半径时不应该吸附', () => {
      system.placeAnchor({ x: 10, y: 10 }, 'ground');

      const dashPath: DashPath = {
        start: { x: 5, y: 15 },
        direction: { x: 1, y: 0 },
        distance: 3, // 距离不够
      };

      const result = system.checkSnapAlongPath(dashPath);

      expect(result.snapped).toBe(false);
    });

    it('不应该吸附被锁定的锚点', () => {
      const anchor = system.placeAnchor({ x: 10, y: 10 }, 'ground');
      system.lockAnchor(anchor!.id);

      const dashPath: DashPath = {
        start: { x: 5, y: 10 },
        direction: { x: 1, y: 0 },
        distance: 10,
      };

      const result = system.checkSnapAlongPath(dashPath);

      expect(result.snapped).toBe(false);
    });

    it('悬停点应该在锚点外侧并包含垂直偏移', () => {
      const anchor = system.placeAnchor({ x: 10, y: 10 }, 'ground');

      const dashPath: DashPath = {
        start: { x: 5, y: 10 },
        direction: { x: 1, y: 0 },
        distance: 10,
      };

      const result = system.checkSnapAlongPath(dashPath);

      expect(result.snapped).toBe(true);
      expect(result.hoverPoint).toBeDefined();

      // Phase 2: 悬停点现在包含垂直偏移（角色高度的一半：0.9单位）
      // 水平距离应该是 0.6 单位
      const hoverDist = defaultTuning.madman.hoverDistance;
      const verticalOffset = defaultTuning.world.characterHeight / 2;
      
      const dx = result.hoverPoint!.x - anchor!.position.x;
      const dy = result.hoverPoint!.y - anchor!.position.y;
      
      // 检查水平距离
      expect(Math.abs(dx)).toBeCloseTo(hoverDist, 1);
      // 检查垂直偏移
      expect(dy).toBeCloseTo(-verticalOffset, 1);
    });
  });

  describe('接受条件 4: 未吸附时只是短冲刺', () => {
    it('应该返回未吸附状态', () => {
      // 没有锚点
      const dashPath: DashPath = {
        start: { x: 5, y: 10 },
        direction: { x: 1, y: 0 },
        distance: 4.0, // 短冲刺距离
      };

      const result = system.checkSnapAlongPath(dashPath);

      expect(result.snapped).toBe(false);
      expect(result.anchorId).toBeUndefined();
    });
  });

  describe('接受条件 5: 所有参数可配置', () => {
    it('应该使用配置的吸附半径', () => {
      const customConfig = {
        ...defaultTuning,
        madman: {
          ...defaultTuning.madman,
          snapRadius: 3.0, // 自定义吸附半径
        },
      };

      const customSystem = new AnchorSystem(customConfig);
      customSystem.placeAnchor({ x: 10, y: 10 }, 'ground');

      const dashPath: DashPath = {
        start: { x: 5, y: 10 },
        direction: { x: 1, y: 0 },
        distance: 10,
      };

      const result = customSystem.checkSnapAlongPath(dashPath);
      expect(result.snapped).toBe(true);
    });

    it('应该使用配置的最大锚点数', () => {
      const customConfig = {
        ...defaultTuning,
        genius: {
          ...defaultTuning.genius,
          maxAnchors: 3, // 自定义最大锚点数
        },
      };

      const customSystem = new AnchorSystem(customConfig);

      customSystem.placeAnchor({ x: 5, y: 10 }, 'ground');
      customSystem.placeAnchor({ x: 10, y: 10 }, 'ground');
      customSystem.placeAnchor({ x: 15, y: 10 }, 'ground');

      expect(customSystem.getAnchors().length).toBe(3);
    });
  });

  describe('弹射计算', () => {
    it('应该计算保留弹射速度', () => {
      const approachDir: Vec2 = { x: 1, y: 0 };
      const inputDir: Vec2 = { x: 0, y: -1 };

      const velocity = system.calculateLaunchVelocity(
        approachDir,
        inputDir,
        false // 保留
      );

      // 验证速度大小
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      expect(speed).toBeCloseTo(
        defaultTuning.madman.launchSpeedBase *
          defaultTuning.madman.preserveMultiplier,
        1
      );
    });

    it('应该计算消耗弹射速度（更高倍率）', () => {
      const approachDir: Vec2 = { x: 1, y: 0 };
      const inputDir: Vec2 = { x: 0, y: -1 };

      const velocity = system.calculateLaunchVelocity(
        approachDir,
        inputDir,
        true // 消耗
      );

      // 验证速度大小
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      expect(speed).toBeCloseTo(
        defaultTuning.madman.launchSpeedBase *
          defaultTuning.madman.consumeMultiplier,
        1
      );
    });

    it('无输入时应该沿发射轴弹射', () => {
      const approachDir: Vec2 = { x: 1, y: 0 };
      const launchAxis: Vec2 = { x: 1, y: 0 }; // 发射轴向右

      const velocity = system.calculateLaunchVelocity(
        approachDir,
        null,
        false,
        launchAxis
      );

      // 应该接近水平方向
      expect(Math.abs(velocity.y)).toBeLessThan(5); // 允许小的偏差
      expect(velocity.x).toBeGreaterThan(0);
    });

    it('应该限制方向在锥角内', () => {
      const approachDir: Vec2 = { x: 1, y: 0 };
      const inputDir: Vec2 = { x: -1, y: 0 }; // 完全相反
      const launchAxis: Vec2 = { x: 1, y: 0 }; // 发射轴向右

      const velocity = system.calculateLaunchVelocity(
        approachDir,
        inputDir,
        false,
        launchAxis
      );

      // 计算角度相对于发射轴
      const angle = Math.atan2(velocity.y, velocity.x) * (180 / Math.PI);
      const axisAngle = Math.atan2(launchAxis.y, launchAxis.x) * (180 / Math.PI);
      let diff = Math.abs(angle - axisAngle);
      if (diff > 180) diff = 360 - diff;

      // 应该在锥角内（70度）
      expect(diff).toBeLessThanOrEqual(defaultTuning.madman.coneHalfAngleDeg + 1);
    });
  });

  describe('被打断规则', () => {
    it('锁定锚点被移除时应该能检测', () => {
      const anchor = system.placeAnchor({ x: 10, y: 10 }, 'ground');
      system.lockAnchor(anchor!.id);

      // 模拟表面消失，锚点被移除
      const removed = system.removeAnchor(anchor!.id);
      expect(removed).toBe(true);

      // 验证锚点已不存在
      expect(system.getAnchor(anchor!.id)).toBeUndefined();
    });

    it('解锁锚点后应该可以被替换', () => {
      const anchor1 = system.placeAnchor({ x: 5, y: 10 }, 'ground');
      system.placeAnchor({ x: 10, y: 10 }, 'ground');

      // 锁定 anchor1
      system.lockAnchor(anchor1!.id);

      // 解锁 anchor1
      system.unlockAnchor(anchor1!.id);

      // 现在应该可以替换
      const anchor3 = system.placeAnchor({ x: 15, y: 10 }, 'ground');
      expect(anchor3).not.toBeNull();

      const remaining = system.getAnchors();
      expect(remaining.find((a) => a.id === anchor1!.id)).toBeUndefined();
    });
  });

  describe('Phase 2: 方向限制（锥角）', () => {
    it('应该限制瞄准方向在±70°锥角内', () => {
      const approachDir: Vec2 = { x: 0, y: -1 }; // 向上
      const inputDir: Vec2 = { x: 1, y: 0 }; // 向右（90°偏离）

      const velocity = system.calculateLaunchVelocity(approachDir, inputDir, false);

      // 计算角度
      const angle = Math.atan2(velocity.y, velocity.x) * (180 / Math.PI);
      const approachAngle = Math.atan2(approachDir.y, approachDir.x) * (180 / Math.PI);
      
      // 计算角度差（考虑角度环绕）
      let diff = Math.abs(angle - approachAngle);
      if (diff > 180) diff = 360 - diff;

      // 应该在锥角内（70度）
      expect(diff).toBeLessThanOrEqual(defaultTuning.madman.coneHalfAngleDeg + 1); // +1 容差
    });

    it('在锥角内的方向应该不被限制', () => {
      const approachDir: Vec2 = { x: 0, y: -1 }; // 向上
      const inputDir: Vec2 = { x: 0.5, y: -0.866 }; // 30°偏离

      const velocity = system.calculateLaunchVelocity(approachDir, inputDir, false);

      // 归一化速度方向
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      const normalizedVel = { x: velocity.x / speed, y: velocity.y / speed };

      // 应该保持原方向（混合后）
      const angle = Math.atan2(normalizedVel.y, normalizedVel.x) * (180 / Math.PI);
      const approachAngle = Math.atan2(approachDir.y, approachDir.x) * (180 / Math.PI);
      
      let diff = Math.abs(angle - approachAngle);
      if (diff > 180) diff = 360 - diff;

      expect(diff).toBeLessThanOrEqual(70);
    });
  });

  describe('Phase 2: 速度混合', () => {
    it('应该按权重混合进入方向和瞄准方向', () => {
      const approachDir: Vec2 = { x: 1, y: 0 }; // 向右
      const inputDir: Vec2 = { x: 0, y: -1 }; // 向上
      const w = defaultTuning.madman.launchAimWeight; // 0.60

      const velocity = system.calculateLaunchVelocity(approachDir, inputDir, false);

      // 归一化速度方向
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      const normalizedVel = { x: velocity.x / speed, y: velocity.y / speed };

      // 计算预期混合方向: (1-w)*approach + w*input
      const expectedX = (1 - w) * approachDir.x + w * inputDir.x;
      const expectedY = (1 - w) * approachDir.y + w * inputDir.y;
      const expectedLen = Math.sqrt(expectedX * expectedX + expectedY * expectedY);
      const expectedNorm = { x: expectedX / expectedLen, y: expectedY / expectedLen };

      // 应该接近预期方向（考虑锥角限制）
      expect(Math.abs(normalizedVel.x - expectedNorm.x)).toBeLessThan(0.2);
      expect(Math.abs(normalizedVel.y - expectedNorm.y)).toBeLessThan(0.2);
    });

    it('没有输入时应该使用发射轴方向', () => {
      const approachDir: Vec2 = { x: 1, y: 0 }; // 向右
      const inputDir: Vec2 | null = null;
      const launchAxis: Vec2 = { x: 1, y: 0 }; // 发射轴也向右

      const velocity = system.calculateLaunchVelocity(approachDir, inputDir, false, launchAxis);

      // 归一化速度方向
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      const normalizedVel = { x: velocity.x / speed, y: velocity.y / speed };

      // 应该接近发射轴方向（考虑混合）
      expect(Math.abs(normalizedVel.x)).toBeGreaterThan(0.5);
      expect(Math.abs(normalizedVel.y)).toBeLessThan(0.5);
    });
  });

  describe('Phase 2: 保留 vs 消耗', () => {
    it('保留锚点时速度应该为基础速度', () => {
      const approachDir: Vec2 = { x: 0, y: -1 }; // 向上
      const inputDir: Vec2 = { x: 0, y: -1 }; // 向上

      const velocity = system.calculateLaunchVelocity(approachDir, inputDir, false);
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      expect(speed).toBeCloseTo(defaultTuning.madman.launchSpeedBase, 1);
    });

    it('消耗锚点时速度应该为基础速度 × 1.35', () => {
      const approachDir: Vec2 = { x: 0, y: -1 }; // 向上
      const inputDir: Vec2 = { x: 0, y: -1 }; // 向上

      const velocity = system.calculateLaunchVelocity(approachDir, inputDir, true);
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      const expectedSpeed = defaultTuning.madman.launchSpeedBase * defaultTuning.madman.consumeMultiplier;
      expect(speed).toBeCloseTo(expectedSpeed, 1);
    });
  });

  describe('Phase 2: 轨迹计算', () => {
    it('应该生成正确数量的轨迹点', () => {
      const startPos: Vec2 = { x: 0, y: 0 };
      const velocity: Vec2 = { x: 10, y: -20 };
      const gravity = 15.625; // 500 / 32
      const dotCount = 20;
      const timeStep = 0.05;

      const trajectory = system.calculateTrajectory(startPos, velocity, gravity, dotCount, timeStep);

      expect(trajectory).toHaveLength(dotCount);
    });

    it('轨迹第一个点应该是起始位置', () => {
      const startPos: Vec2 = { x: 5, y: 10 };
      const velocity: Vec2 = { x: 10, y: -20 };
      const gravity = 15.625;

      const trajectory = system.calculateTrajectory(startPos, velocity, gravity, 10, 0.05);

      expect(trajectory[0].x).toBeCloseTo(startPos.x, 1);
      expect(trajectory[0].y).toBeCloseTo(startPos.y, 1);
    });

    it('轨迹应该遵循抛物线方程', () => {
      const startPos: Vec2 = { x: 0, y: 0 };
      const velocity: Vec2 = { x: 10, y: -20 };
      const gravity = 15.625;
      const timeStep = 0.1;

      const trajectory = system.calculateTrajectory(startPos, velocity, gravity, 5, timeStep);

      // 检查第2个点（t=0.1）
      const t = timeStep;
      const expectedX = startPos.x + velocity.x * t;
      const expectedY = startPos.y + velocity.y * t + 0.5 * gravity * t * t;

      expect(trajectory[1].x).toBeCloseTo(expectedX, 1);
      expect(trajectory[1].y).toBeCloseTo(expectedY, 1);
    });
  });
});
