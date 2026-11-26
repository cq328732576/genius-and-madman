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
    
    // 裂谷宽度 10u（基于物理计算）
    riftWidth: 10,  // 320 px
    
    // 右侧目标平台（8u 宽）
    rightPlatform: {
      x: 26,     // 左平台右边缘(12) + 裂谷(10) + 右平台半宽(4) = 26
      y: 24,
      width: 8,
      height: 1,
    },
    
    // 可吸附板：左侧平台右边缘的凸台
    // 位置：左平台右边缘向右 2.5u，向上突出
    attachablePlate: {
      x: 13.5,   // 左平台右边缘(12) + 1.5u = 13.5
      y: 22,     // 比平台高 2u
      width: 2,  // 2u 宽的凸台
      height: 3, // 3u 高
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
      retractedX: 26,  // 收回时在右平台内部
      extendedX: 20,   // 伸出后跨越部分裂谷
      y: 24,
      width: 6,
      height: 0.8,
      extendDuration: 0.5,  // 0.5 秒伸出动画
    },
    
    // 出口区：右侧平台右端
    exitZone: {
      x: 29,
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
    keptLaunchRange: 10.53,      // 保留锚点射程
    jumpPlusShortDashRange: 7.5, // 跳跃+短冲
    riftWidth: 10.0,             // 裂谷宽度
    marginKept: 0.53,            // 保留发射余量
    marginJumpDash: 2.5,         // 跳跃+短冲差距
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

// 导出所有关卡
export const levels: Record<string, LevelConfig> = {
  riftFirstLeap,
};

// 获取当前关卡（Phase 3 只有一个关卡）
export function getCurrentLevel(): LevelConfig {
  return riftFirstLeap;
}
