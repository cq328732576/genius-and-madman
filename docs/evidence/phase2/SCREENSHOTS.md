# Phase 2 证据截图清单（最终修订版）

所有截图使用 `freeze()` 钩子冻结游戏状态后捕获，并在捕获前通过断言验证游戏状态。

## 截图列表

### P2-01: 轨迹预览可见
**文件**: `P2-01-trajectory-preview.png`  
**MD5**: `66e1d13769433bd1cb738bdb566e05d5`  
**验证内容**:
- 疯子已吸附到锚点 (`isSnapped: true`)
- 轨迹预览点数量 > 0
- HUD 显示"是否吸附: 是"
- 轨迹点在碰撞地面时停止

### P2-02: 锥角限制（输入超过70°）
**文件**: `P2-02-cone-limit.png`  
**MD5**: `121701deaa4a3e6eb101c73d211eac8c`  
**验证内容**:
- 疯子已吸附到锚点
- 输入方向为向右（0°），与向上轴（-90°）相差90°，超过70°限制
- **限制瞄准角度**: 断言 clampedAngle ≈ -20° ± 0.5°（最近边缘）
- 显示三个角度值：原始输入 0.0°、限制瞄准 -20.0°、最终发射
- 锥角边缘线可见（橙色线，±70°）
- 轨迹预览不穿过地面

### P2-03: 保留锚点发射
**文件**: `P2-03-kept-anchor.png`  
**MD5**: `618d9b77a84eae8692af54096c990d3d`  
**验证内容**:
- 发射后锚点数量不变（保留锚点）：1 → 1
- 疯子在空中（madmanY < 768 - 20）
- **发射速度**: 断言 |lastLaunchSpeed - 16| < 0.1 u/s
- HUD显示 "发射速度: 16.0 u/s"
- 捕获时机：发射后4-6帧（~100ms）

### P2-04: 消耗锚点发射
**文件**: `P2-04-consumed-anchor.png`  
**MD5**: `1ea243a33ca2201a08d4fbf13b66d3fd`  
**验证内容**:
- 发射后锚点被移除：1 → 0
- 疯子在空中（madmanY < 768 - 20）
- **发射速度**: 断言 |lastLaunchSpeed - 21.6| < 0.1 u/s
- HUD显示 "发射速度: 21.6 u/s"
- 捕获时机：发射后4-6帧（~100ms）

### P2-05: 悬停点修复（脚完全在地面上方）
**文件**: `P2-05-hover-fix.png`  
**MD5**: `b6d3b929e613490b3e5b3a1f206c58ac`  
**验证内容**:
- 疯子已吸附到锚点
- 疯子底部位置 < 地面表面 - 10px（madmanY < 768 - 10）
- 身体完全在地面上方，不再部分嵌入

### P2-06: 「已吸附」真实徽标
**文件**: `P2-06-snapped-badge.png`  
**MD5**: `8319c48eca9136443bbd9aa5dce5073f`  
**验证内容**:
- 疯子已吸附到锚点
- 徽标可见 (`badgeVisible: true`)
- 徽标纹理为 `snap_badge_snapped_zh_m` (真实美术资源)
- 显示不同的瞄准方向以区别于P2-05

### P2-07: 粗吸附半径环
**文件**: `P2-07-bold-ring.png`  
**MD5**: `a1db5cda3e5902f23f354d1e0f63843b`  
**验证内容**:
- 环纹理为 `snap_ring_bold_m` (粗环美术资源)
- 显示半径为 64px (2.0u * 32px/u)
- displayWidth 在 130-145px 范围内（256 * 0.542 ≈ 138.8）
- 环始终可见，不透明度 90%
- 疯子接近锚点时拍摄（约3u距离）

## 核心修复

### 1. 锥角限制机制（最终修复）

**问题**: 叉积计算顺序错误，导致角度差符号反转

**修复**:
```typescript
// 修正叉积：从 a.x * b.y - a.y * b.x 改为 b.x * a.y - b.y * a.x
private angleBetween(a: Vec2, b: Vec2): number {
  const dot = a.x * b.x + a.y * b.y;
  const cross = b.x * a.y - b.y * a.x; // 修正顺序
  return (Math.atan2(cross, dot) * 180) / Math.PI;
}
```

**测试覆盖**:
- 0° → -20° (向右输入，限制到右边缘)
- 180° → -160° (向左输入，限制到左边缘)
- 90° (向下) → -20° 或 -160° (等距，选择一个)
- -60° → -60° (在范围内保持不变)

### 2. 发射速度记录（最终修复）

**问题**: 速度在重力作用后测量，不是发射瞬间的值

**修复**:
```typescript
// 在 launchFromAnchor() 中，应用速度前记录
this.lastLaunchSpeed = Math.sqrt(
  launchVelocity.x * launchVelocity.x + 
  launchVelocity.y * launchVelocity.y
);
```

**HUD显示**:
- 吸附时：显示预计发射速度（16.0 或 21.6 u/s）
- 发射后：显示记录的 lastLaunchSpeed

**断言**:
- 保留: |lastLaunchSpeed - 16| < 0.1
- 消耗: |lastLaunchSpeed - 21.6| < 0.1

### 3. 粗环始终可见

**修复**:
```typescript
snapRing.setAlpha(0.9); // 更高不透明度
snapRing.setVisible(true); // 始终可见
```

## 演示视频

**文件**: `phase2-demo.webm` (890KB)  
**内容**:
- 吸附到锚点
- 方向瞄准 + 轨迹预览（扫描锥角边缘）
- 保留锚点发射（速度 16 u/s）
- 消耗锚点发射（C键，速度 21.6 u/s）

## 技术细节

### 坐标系统
- Phaser: Y轴向下
- 向上轴: (0, -1) = -90°
- 锥角范围: [-160°, -20°] (axis ± 70°)

### 速度计算
- 基础速度: 16 u/s
- 保留倍率: 1.00 → 16.0 u/s
- 消耗倍率: 1.35 → 21.6 u/s
- 混合权重: w = 0.60

### 轨迹停止
- 检测: `point.y >= groundY`
- 地面Y: 25 单位 (800px)
- 停止条件: 首次碰撞即停止

## 测试命令

```bash
# 单元测试 (35个)
npm test

# E2E证据测试 (7个)
npx playwright test e2e/phase2-evidence.spec.ts

# 演示视频录制
npx playwright test e2e/record-demo.spec.ts
```

## 相关文件

- 测试规范: `e2e/phase2-evidence.spec.ts`
- 单元测试: `test/anchorSystem.test.ts`
- 核心逻辑: `src/engine/anchorSystem.ts`
- 场景实现: `src/scenes/GameScene.ts`
- 调参配置: `src/config/tuning.ts`
