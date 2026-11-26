/**
 * 游戏调参配置
 * 所有数值来自设计文档「建议调参」章节
 * 世界尺度：1 单位 = 32 px，1 单位 ≈ 1 m，角色身高 1.8 单位
 */

export interface TuningConfig {
  // 世界尺度
  world: {
    pixelsPerUnit: number;        // 1 单位 = 32 px
    characterHeight: number;       // 角色身高 1.8 单位
  };

  // 天才：锚点枪
  genius: {
    maxAnchors: number;            // 同时锚点上限：2
    maxPlacementRange: number;     // 最大放置射程：14 单位
    microAdjustAngle: number;      // 微调角度：±12°
    microAdjustDistance: number;   // 微调距离：±1.5 单位
    placementCooldown: number;     // 放置间隔冷却：0.35 秒
  };

  // 慢速时间场
  slowField: {
    radius: number;                // 慢速场半径：4.0 单位
    duration: number;              // 慢速场持续：1.25 秒
    timeScale: number;             // 时间缩放比：0.40×
    cooldown: number;              // 慢速场冷却：5.0 秒
  };

  // 伙伴牵引与对拉（本阶段不实现）
  pull: {
    reelDistance: number;          // 伙伴牵引距离：16 单位
    reelDuration: number;          // 伙伴牵引时长：0.80 秒
    syncWindow: number;            // 对拉同步窗口：0.80 秒
  };

  // 疯子：爆炸冲刺
  madman: {
    shortDashDistance: number;     // 无锚点冲刺距离：4.0 单位
    dashCooldown: number;          // 冲刺冷却：0.60 秒
    airDashCooldown: number;       // 空中再冲冷却：0.20 秒
    snapRadius: number;            // 吸附判定半径：2.0 单位
    snapPullDuration: number;      // 吸附拉近：0.12 秒
    hoverDistance: number;         // 悬停外偿：0.6 单位
    aimWindowBase: number;         // 瞄准窗：0.28 秒
    aimWindowMax: number;          // 可延长至：0.50 秒
    launchSpeedBase: number;       // 基准弹射初速：16 单位/秒
    preserveMultiplier: number;    // 保留倍率：1.00
    consumeMultiplier: number;     // 消耗倍率：1.35
    directionMixWeight: number;    // 方向混合权重 w：0.60（输入）
    directionConeAngle: number;    // 方向锥角：±70°
    interruptIFrames: number;      // 被打断短无敌：0.15 秒
    launchAimWeight: number;       // 弹射瞄准权重 w：0.60
    coneHalfAngleDeg: number;      // 锥角半角：70°
    trajectoryDotCount: number;    // 轨迹预览点数：20
    trajectoryTimeStep: number;    // 轨迹时间步长：0.05 秒
    launchLandingGraceS: number;   // 发射后落地检测延迟：0.1 秒
    launchInputLockS: number;      // 发射后输入锁定时间：0.5 秒
  };

  // 重力翻转（本阶段不实现）
  gravityFlip: {
    duration: number;              // 重力翻转持续：1.50 秒
    cooldown: number;              // 重力翻转冷却：9.0 秒
  };

  // 调试面板
  debug: {
    enabled: boolean;              // 是否启用调试面板
  };
}

export const defaultTuning: TuningConfig = {
  world: {
    pixelsPerUnit: 32,
    characterHeight: 1.8,
  },
  genius: {
    maxAnchors: 2,
    maxPlacementRange: 14,
    microAdjustAngle: 12,
    microAdjustDistance: 1.5,
    placementCooldown: 0.35,
  },
  slowField: {
    radius: 4.0,
    duration: 1.25,
    timeScale: 0.40,
    cooldown: 5.0,
  },
  pull: {
    reelDistance: 16,
    reelDuration: 0.80,
    syncWindow: 0.80,
  },
  madman: {
    shortDashDistance: 4.0,
    dashCooldown: 0.60,
    airDashCooldown: 0.20,
    snapRadius: 2.0,
    snapPullDuration: 0.12,
    hoverDistance: 0.6,
    aimWindowBase: 0.28,
    aimWindowMax: 0.50,
    launchSpeedBase: 16,
    preserveMultiplier: 1.00,
    consumeMultiplier: 1.35,
    directionMixWeight: 0.60,
    directionConeAngle: 70,
    interruptIFrames: 0.15,
    launchAimWeight: 0.60,
    coneHalfAngleDeg: 70,
    trajectoryDotCount: 20,
    trajectoryTimeStep: 0.05,
    launchLandingGraceS: 0.1,
    launchInputLockS: 0.5,
  },
  gravityFlip: {
    duration: 1.50,
    cooldown: 9.0,
  },
  debug: {
    enabled: true,
  },
};

// 全局调参实例（可在运行时修改）
export let tuning: TuningConfig = { ...defaultTuning };

export function updateTuning(updates: Partial<TuningConfig>): void {
  tuning = { ...tuning, ...updates };
}

export function resetTuning(): void {
  tuning = { ...defaultTuning };
}
