/**
 * Phase 3 关卡配置
 * 「裂谷初跃」(Rift First Leap) - 教程关卡
 */

export interface LevelConfig {
  id: string;
  name: string;
  nameZh: string;
  
  // 关卡布局（单位：游戏单位，1u = 32px）
  layout: {
    leftPlatform: {
      x: number;  // 中心 x
      y: number;  // 中心 y
      width: number;  // 宽度（单位）
      height: number; // 高度（单位）
    };
    
    riftWidth: number;  // 裂谷宽度（单位）
    
    rightPlatform: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    
    attachablePlate: {
      x: number;
      y: number;
      width: number;
      height: number;
      type: 'ledge' | 'wall';  // 凸台或墙面
    };
    
    pressurePlate: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    
    bridge: {
      retractedX: number;  // 收回时的 x
      extendedX: number;   // 伸出时的 x
      y: number;
      width: number;
      height: number;
      extendDuration: number;  // 伸出动画时间（秒）
    };
    
    exitZone: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    
    checkpoint: {
      x: number;
      y: number;
    };
  };
  
  // 物理参数（已验证，来自 calculate-rift-width.js）
  physics: {
    keptLaunchRange: number;      // 保留锚点射程（单位）
    jumpPlusShortDashRange: number; // 跳跃+短冲射程（单位）
    riftWidth: number;             // 裂谷宽度（单位）
    marginKept: number;            // 保留发射余量（单位）
    marginJumpDash: number;        // 跳跃+短冲差距（单位）
  };
  
  // 机制规则
  mechanics: {
    bridgeRule: 'stay_extended' | 'retract_on_leave' | 'timed';
    bridgeTimerSeconds?: number;  // 如果是 timed
    deathZoneY: number;  // 死亡区 y 坐标（单位）
  };
}

/**
 * Phase 3 Level 1: 裂谷初跃 (Rift First Leap)
 * 
 * 布局：
 * - 左侧起始平台：~8u 宽
 * - 中间裂谷：10u 宽（基于 Phase 2 物理计算）
 * - 右侧目标平台：~8u 宽
 * - 可吸附板：左侧平台边缘的凸台（4u 短冲可达）
 * - 压力板：右侧平台上
 * - 桥梁：压力板激活后伸出
 * - 出口区：右侧平台末端
 * - 检查点：左侧平台
 * 
 * 偏离设计文档的点：
 * - 文档建议锚点在远侧墙/凸台（14u 内）
 * - 但短冲只有 4u，无法到达 8u 外的远侧锚点
 * - 因此锚点放在左侧平台边缘凸台（2-3u 外），短冲可达
 */
export const riftFirstLeap: LevelConfig = {
  id: 'rift_first_leap',
  name: 'Rift First Leap',
  nameZh: '裂谷初跃',
  
  layout: {
    // 左侧起始平台（8u 宽，位于左侧）
    leftPlatform: {
      x: 8,      // 中心 x = 256 px
      y: 24,     // 中心 y = 768 px
      width: 8,  // 256 px
      height: 1, // 32 px
    },
    
    // 裂谷宽度 10u（符合规格 10~11u）
    riftWidth: 10,  // 320 px
    
    // 右侧目标平台（8u 宽，与左平台同高）
    rightPlatform: {
      x: 26,     // 左平台右边缘(12) + 裂谷(10) + 右平台半宽(4) = 26
      y: 24,     // 与左平台同高
      width: 8,
      height: 1,
    },
    
    // 可吸附板：左侧平台右边缘的凸台
    // 位置：左平台右边缘向右 1.5u，高度降低以减少发射射程
    attachablePlate: {
      x: 13.5,   // 左平台右边缘(12) + 1.5u = 13.5
      y: 23,     // 比平台高 1u（降低以减少射程）
      width: 2,  // 2u 宽的凸台
      height: 2, // 2u 高
      type: 'ledge',
    },
    
    // 压力板：右侧平台左部
    pressurePlate: {
      x: 23.5,   // 右平台左边缘 + 1.5u
      y: 23.5,   // 平台表面上方 0.5u
      width: 2,
      height: 0.5,
    },
    
    // 桥梁：从右侧平台中部向左伸出
    bridge: {
      retractedX: 26,    // 收回时在右平台内部
      extendedX: 19,     // 伸出后跨越部分裂谷
      y: 24,             // 与平台同高
      width: 7,          // 覆盖裂谷
      height: 0.8,
      extendDuration: 0.5,
    },
    
    // 出口区：右侧平台右端
    exitZone: {
      x: 29,     // 右平台右端
      y: 22,
      width: 2,
      height: 4,
    },
    
    // 检查点：左侧平台中心
    checkpoint: {
      x: 8,
      y: 23,  // 平台上方 1u
    },
  },
  
  physics: {
    keptLaunchRange: 14.96,      // 保留锚点射程（从左平台边缘 x=12 实测）
    jumpPlusShortDashRange: 9.31, // 跳跃+短冲（从左平台边缘 x=12 实测）
    riftWidth: 10.0,             // 裂谷宽度（符合规格 10~11u）
    marginKept: 4.96,            // 保留发射余量 (14.96 - 10.0) >=1u ✓
    marginJumpDash: 0.69,        // 跳跃+短冲差距 (10.0 - 9.31) ~0.7u
  },
  
  mechanics: {
    // 桥梁规则：疯子站上压力板后，桥梁伸出并保持
    // 即使疯子离开，桥梁也保持伸出状态（至少在天才过桥期间）
    // 实现为：一旦激活，桥梁永久伸出（本关）
    bridgeRule: 'stay_extended',
    
    // 死亡区：y > 30u 时死亡
    deathZoneY: 30,
  },
};

// Phase 1/2 测试关卡配置（保留原有布局）
export const testLevel: LevelConfig = {
  id: 'test_level',
  name: 'Test Level',
  nameZh: '测试关卡',
  
  layout: {
    leftPlatform: { x: 12.5, y: 18.75, width: 6, height: 1 },
    riftWidth: 0, // 无裂谷
    rightPlatform: { x: 25, y: 15.625, width: 6, height: 1 },
    attachablePlate: { x: 0, y: 0, width: 0, height: 0, type: 'wall' },
    pressurePlate: { x: 0, y: 0, width: 0, height: 0 },
    bridge: { retractedX: 0, extendedX: 0, y: 0, width: 0, height: 0, extendDuration: 0 },
    exitZone: { x: 0, y: 0, width: 0, height: 0 },
    checkpoint: { x: 12.5, y: 18.25 },
  },
  
  physics: {
    keptLaunchRange: 0,
    jumpPlusShortDashRange: 0,
    riftWidth: 0,
    marginKept: 0,
    marginJumpDash: 0,
  },
  
  mechanics: {
    bridgeRule: 'stay_extended',
    deathZoneY: 40,
  },
};

// 导出所有关卡
export const levels: Record<string, LevelConfig> = {
  testLevel,
  riftFirstLeap,
};

// 获取当前关卡（默认 Phase 3，可通过参数切换）
export function getCurrentLevel(levelId?: string): LevelConfig {
  if (levelId && levels[levelId]) {
    return levels[levelId];
  }
  // 默认返回 Phase 3 关卡
  return riftFirstLeap;
}
