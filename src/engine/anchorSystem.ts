/**
 * 锚点系统核心逻辑（纯 TypeScript，引擎无关）
 * 实现：锚点放置、FIFO 替换、锁定规则、吸附判定、冲刺路径计算
 */

import { TuningConfig } from '../config/tuning';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Surface {
  id: string;
  isAttachable: boolean;
  points: Vec2[];
}

export enum AnchorState {
  Ready = 'ready',           // 闲置就绪
  Snap = 'snap',             // 可吸附（被瞄准中）
  Locked = 'locked',         // 被占用/锁定
}

export interface Anchor {
  id: string;
  position: Vec2;
  surfaceId: string;
  state: AnchorState;
  createdAt: number;
}

export interface DashPath {
  start: Vec2;
  direction: Vec2;
  distance: number;
}

export interface SnapResult {
  snapped: boolean;
  anchorId?: string;
  snapPoint?: Vec2;
  hoverPoint?: Vec2;
}

export interface PlacementValidation {
  valid: boolean;
  reason?: 'no_surface' | 'out_of_range' | 'locked_anchor';
  position?: Vec2;
  surfaceId?: string;
}

export class AnchorSystem {
  private anchors: Map<string, Anchor> = new Map();
  private nextAnchorId = 1;
  private config: TuningConfig;

  constructor(config: TuningConfig) {
    this.config = config;
  }

  /**
   * 验证锚点放置位置
   * 条件1：必须落在可附着表面上
   */
  validatePlacement(
    geniusPos: Vec2,
    targetPos: Vec2,
    surfaces: Surface[]
  ): PlacementValidation {
    // 检查距离是否在射程内
    const distance = this.distance(geniusPos, targetPos);
    if (distance > this.config.genius.maxPlacementRange) {
      return { valid: false, reason: 'out_of_range' };
    }

    // 检查是否落在可附着表面上
    const surface = this.findSurfaceAt(targetPos, surfaces);
    if (!surface || !surface.isAttachable) {
      return { valid: false, reason: 'no_surface' };
    }

    // 检查是否可以放置（FIFO 规则）
    if (this.anchors.size >= this.config.genius.maxAnchors) {
      const canReplace = this.canReplaceOldest();
      if (!canReplace) {
        return { valid: false, reason: 'locked_anchor' };
      }
    }

    return {
      valid: true,
      position: targetPos,
      surfaceId: surface.id,
    };
  }

  /**
   * 放置锚点
   * 条件2：最多2个锚点，第3个替换最旧的（FIFO），但被锁定的锚点不能替换
   */
  placeAnchor(position: Vec2, surfaceId: string): Anchor | null {
    // FIFO 替换
    if (this.anchors.size >= this.config.genius.maxAnchors) {
      const removed = this.removeOldestUnlocked();
      if (!removed) {
        return null; // 所有锚点都被锁定
      }
    }

    const anchor: Anchor = {
      id: `anchor_${this.nextAnchorId++}`,
      position: { ...position },
      surfaceId,
      state: AnchorState.Ready,
      createdAt: Date.now(),
    };

    this.anchors.set(anchor.id, anchor);
    return anchor;
  }

  /**
   * 锁定锚点（疯子吸附时）
   */
  lockAnchor(anchorId: string): boolean {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return false;
    anchor.state = AnchorState.Locked;
    return true;
  }

  /**
   * 解锁锚点（疯子离开时）
   */
  unlockAnchor(anchorId: string): boolean {
    const anchor = this.anchors.get(anchorId);
    if (!anchor) return false;
    anchor.state = AnchorState.Ready;
    return true;
  }

  /**
   * 移除锚点
   */
  removeAnchor(anchorId: string): boolean {
    return this.anchors.delete(anchorId);
  }

  /**
   * 计算冲刺路径是否进入吸附半径
   * 条件3：当冲刺路径进入吸附半径时，自动吸附
   */
  checkSnapAlongPath(dashPath: DashPath): SnapResult {
    const { start, direction, distance } = dashPath;
    const snapRadius = this.config.madman.snapRadius;

    // 检查每个就绪或可吸附状态的锚点
    for (const anchor of this.anchors.values()) {
      if (anchor.state === AnchorState.Locked) continue;

      // 计算路径上最接近锚点的点
      const closestPoint = this.closestPointOnLine(
        start,
        direction,
        distance,
        anchor.position
      );

      const dist = this.distance(closestPoint, anchor.position);

      // 条件3：路径进入吸附半径
      if (dist <= snapRadius) {
        const hoverPoint = this.calculateHoverPoint(
          anchor.position,
          start
        );

        return {
          snapped: true,
          anchorId: anchor.id,
          snapPoint: anchor.position,
          hoverPoint,
        };
      }
    }

    return { snapped: false };
  }

  /**
   * 计算弹射方向和初速
   * d = normalize((1 - w) · d_in + w · d_input)
   * 再限制在锥角内
   */
  calculateLaunchVelocity(
    approachDir: Vec2,
    inputDir: Vec2 | null,
    consume: boolean
  ): Vec2 {
    const w = this.config.madman.directionMixWeight;
    const baseSpeed = this.config.madman.launchSpeedBase;
    const multiplier = consume
      ? this.config.madman.consumeMultiplier
      : this.config.madman.preserveMultiplier;

    // 混合方向
    let mixedDir: Vec2;
    if (inputDir && (inputDir.x !== 0 || inputDir.y !== 0)) {
      mixedDir = {
        x: (1 - w) * approachDir.x + w * inputDir.x,
        y: (1 - w) * approachDir.y + w * inputDir.y,
      };
    } else {
      mixedDir = { ...approachDir };
    }

    // 归一化
    const normalized = this.normalize(mixedDir);

    // 限制在锥角内
    const coneAngle = this.config.madman.directionConeAngle;
    const constrained = this.constrainToCone(
      normalized,
      approachDir,
      coneAngle
    );

    // 应用速度
    const speed = baseSpeed * multiplier;
    return {
      x: constrained.x * speed,
      y: constrained.y * speed,
    };
  }

  /**
   * 计算弹射轨迹预览点
   * 使用抛物线运动方程：x(t) = x0 + vx*t, y(t) = y0 + vy*t + 0.5*g*t^2
   */
  calculateTrajectory(
    startPos: Vec2,
    velocity: Vec2,
    gravity: number,
    dotCount: number,
    timeStep: number
  ): Vec2[] {
    const points: Vec2[] = [];
    
    for (let i = 0; i < dotCount; i++) {
      const t = i * timeStep;
      const x = startPos.x + velocity.x * t;
      const y = startPos.y + velocity.y * t + 0.5 * gravity * t * t;
      points.push({ x, y });
    }
    
    return points;
  }

  /**
   * 获取所有锚点
   */
  getAnchors(): Anchor[] {
    return Array.from(this.anchors.values());
  }

  /**
   * 获取锚点
   */
  getAnchor(id: string): Anchor | undefined {
    return this.anchors.get(id);
  }

  /**
   * 清除所有锚点
   */
  clearAnchors(): void {
    this.anchors.clear();
  }

  // ===== 私有辅助方法 =====

  private canReplaceOldest(): boolean {
    const oldest = this.getOldestAnchor();
    return oldest ? oldest.state !== AnchorState.Locked : false;
  }

  private removeOldestUnlocked(): boolean {
    const sorted = Array.from(this.anchors.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );

    for (const anchor of sorted) {
      if (anchor.state !== AnchorState.Locked) {
        this.anchors.delete(anchor.id);
        return true;
      }
    }

    return false;
  }

  private getOldestAnchor(): Anchor | null {
    const sorted = Array.from(this.anchors.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
    return sorted[0] || null;
  }

  private getOldestUnlockedAnchor(): Anchor | null {
    const unlocked = Array.from(this.anchors.values())
      .filter(a => a.state !== AnchorState.Locked)
      .sort((a, b) => a.createdAt - b.createdAt);
    return unlocked[0] || null;
  }

  private findSurfaceAt(pos: Vec2, surfaces: Surface[]): Surface | null {
    // 简化实现：检查点是否在表面附近
    for (const surface of surfaces) {
      if (this.isPointOnSurface(pos, surface)) {
        return surface;
      }
    }
    return null;
  }

  private isPointOnSurface(pos: Vec2, surface: Surface): boolean {
    // 简化：检查点是否在表面多边形内或边缘附近
    const threshold = 0.5; // 单位
    for (let i = 0; i < surface.points.length; i++) {
      const p1 = surface.points[i];
      const p2 = surface.points[(i + 1) % surface.points.length];
      const dist = this.distanceToSegment(pos, p1, p2);
      if (dist <= threshold) {
        return true;
      }
    }
    return false;
  }

  private calculateHoverPoint(anchorPos: Vec2, fromPos: Vec2): Vec2 {
    const hoverDist = this.config.madman.hoverDistance;
    const dir = this.normalize({
      x: fromPos.x - anchorPos.x,
      y: fromPos.y - anchorPos.y,
    });
    
    // Phase 2: 添加垂直偏移，使角色身体完全在表面之上
    // 角色高度1.8单位，底部对齐，所以需要向上偏移0.9单位（角色中心）
    const verticalOffset = this.config.world.characterHeight / 2;
    
    return {
      x: anchorPos.x + dir.x * hoverDist,
      y: anchorPos.y + dir.y * hoverDist - verticalOffset,
    };
  }

  private closestPointOnLine(
    start: Vec2,
    dir: Vec2,
    maxDist: number,
    point: Vec2
  ): Vec2 {
    const toPoint = { x: point.x - start.x, y: point.y - start.y };
    const dot = toPoint.x * dir.x + toPoint.y * dir.y;
    const t = Math.max(0, Math.min(maxDist, dot));
    return {
      x: start.x + dir.x * t,
      y: start.y + dir.y * t,
    };
  }

  private constrainToCone(
    dir: Vec2,
    centerDir: Vec2,
    maxAngle: number
  ): Vec2 {
    const angle = this.angleBetween(dir, centerDir);
    if (Math.abs(angle) <= maxAngle) {
      return dir;
    }

    // 旋转到锥角边界
    const sign = angle > 0 ? 1 : -1;
    const constrainedAngle = (sign * maxAngle * Math.PI) / 180;
    const centerAngle = Math.atan2(centerDir.y, centerDir.x);
    const newAngle = centerAngle + constrainedAngle;

    return {
      x: Math.cos(newAngle),
      y: Math.sin(newAngle),
    };
  }

  private distance(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;

    if (len2 === 0) return this.distance(p, a);

    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)
    );

    const proj = {
      x: a.x + t * dx,
      y: a.y + t * dy,
    };

    return this.distance(p, proj);
  }

  private normalize(v: Vec2): Vec2 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
  }

  private angleBetween(a: Vec2, b: Vec2): number {
    const dot = a.x * b.x + a.y * b.y;
    const cross = a.x * b.y - a.y * b.x;
    return (Math.atan2(cross, dot) * 180) / Math.PI;
  }
}
