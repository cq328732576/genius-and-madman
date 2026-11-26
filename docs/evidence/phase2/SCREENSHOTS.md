# Phase 2 证据截图清单（最终版本）

所有截图使用 `freeze()` 钩子冻结游戏状态后捕获，并在捕获前通过断言验证游戏状态。

## 截图列表

### P2-01: 轨迹预览可见
**文件**: `P2-01-trajectory-preview.png`  
**MD5**: `213f8f81e17f207579714b21428a7b8f`  
**验证内容**:
- 疯子已吸附到锚点 (`isSnapped: true`)
- 轨迹预览点数量 > 0
- HUD 显示"是否吸附: 是"
- 轨迹点在碰撞地面时停止
- HUD显示"发射速度: 16.0 u/s"（正确）
- **粗环清晰可见**围绕锚点

### P2-02: 锥角限制（输入超过70°）
**文件**: `P2-02-cone-limit.png`  
**MD5**: `1ac68f7ef299309137c66a2bdbef9d61`  
**验证内容**:
- 疯子已吸附到锚点
- 输入方向为向右（0°），与向上轴（-90°）相差90°，超过70°限制
- **限制瞄准角度**: 断言 clampedAngle ≈ -20° ± 0.5°（最近边缘）
- 显示三个角度值：原始输入 0.0°、限制瞄准 -20.0°、最终发射
- **HUD显示"发射速度: 16.0 u/s"**（正确，不是0.5）
- 锥角边缘线可见（橙色线，±70°）
- 轨迹预览不穿过地面
- **粗环清晰可见**

### P2-03: 保留锚点发射
**文件**: `P2-03-kept-anchor.png`  
**MD5**: `2e0046b8ecb1d885f6cd98fa7b3d4f2f`  
**验证内容**:
- 发射后锚点数量不变（保留锚点）：1 → 1
- **疯子明显在空中**（madman.body.bottom < groundTop - 16）
- **发射速度**: 断言 |lastLaunchSpeed - 16| < 0.1 u/s
- HUD显示 "发射速度: 16.0 u/s"
- 锚点清晰可见（未被消耗）
- 捕获时机：发射后0.15-0.2s（约10-11帧），疯子明显高于锚点

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
**MD5**: `2fe17f42544f24efa474f70ccb089d8f`  
**验证内容**:
- 疯子已吸附到锚点
- 疯子底部位置 < 地面表面 - 10px（madmanY < 768 - 10）
- 身体完全在地面上方，不再部分嵌入

### P2-06: 「已吸附」真实徽标
**文件**: `P2-06-snapped-badge.png`  
**MD5**: `2d410d3fce7a68fa178e78250f1bbc28`  
**验证内容**:
- 疯子已吸附到锚点
- 徽标可见 (`badgeVisible: true`)
- 徽标纹理为 `snap_badge_snapped_zh_m` (真实美术资源)
- 显示不同的瞄准方向以区别于P2-05

### P2-07: 粗吸附半径环
**文件**: `P2-07-bold-ring.png`  
**MD5**: `61d32d45be530e6f4d2181f63444357a`  
**验证内容**:
- **环可见**: 断言 ringVisible === true
- 环纹理为 `snap_ring_bold_m` (粗环美术资源)
- 显示半径为 64px (2.0u * 32px/u)
- displayWidth ≈ 139 (256 * 0.542)
- **环始终可见**，不透明度 90%
- scale = 64/118 ≈ 0.542（正确）
- 疯子接近锚点时拍摄（约3u距离）
- **粗橙色环清晰可见，比之前厚得多**

## 核心修复（提交 [即将提交]）

### 1. 粗环始终可见 ✅

**问题**: setVisible(false)，从未显示

**修复**:
```typescript
snapRing.setVisible(true); // 始终可见
snapRing.setAlpha(0.9); // 更高不透明度
// scale = snapRadiusPx / 118，其中 snapRadiusPx = 2.0 * 32 = 64
```

**验证**: P2-07 断言 ringVisible === true，粗环清晰可见 ✅

### 2. HUD速度正确 ✅

**问题**: 除以32两次，显示0.5而不是16.0

**修复**:
```typescript
// calculateLaunchVelocity返回值已经是u/s，不需要再除以pixelsPerUnit
launchSpeed = Math.sqrt(vx*vx + vy*vy); // 移除 / pixelsPerUnit
```

**验证**: P2-02 HUD显示"发射速度: 16.0 u/s"，断言 launchSpeed ≈ 16.0 ✅

### 3. P2-03疯子在空中 ✅

**修复**:
- 向上瞄准（-90°）而不是混合方向
- 断言 `madman.body.bottom < groundTop - 16`
- 捕获后175ms（0.15-0.2s，约10-11帧）让疯子明显高于锚点

**验证**: P2-03显示疯子明显在空中（y=735，高出地面33px），锚点可见（保留）✅

## 演示视频

**文件**: `phase2-demo.webm` (751KB, 1280x720)  
**内容**:
- 吸附到锚点（粗环可见）
- 方向瞄准 + 轨迹预览扫描：向上 → 右边缘(+70°) → 左边缘(-70°) → 回到向上
- 保留锚点发射（速度 16 u/s）：完整飞行弧线
- 重新吸附
- 消耗锚点发射（C键，速度 21.6 u/s）：锚点消失，更高飞行弧线

## Phase 1 证据

Phase 1证据文件（docs/evidence/*.png）**未被修改**，保持与main分支一致。新增的 `06-aim-window.png` 是Phase 2的一部分。

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
