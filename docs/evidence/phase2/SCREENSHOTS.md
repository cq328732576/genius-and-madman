# Phase 2 证据截图清单

所有截图使用 `freeze()` 钩子冻结游戏状态后捕获，并在捕获前通过断言验证游戏状态。

## 截图列表

### P2-01: 轨迹预览可见
**文件**: `P2-01-trajectory-preview.png`  
**MD5**: `a030ee649a022297ec8e0fc158df8a21`  
**验证内容**:
- 疯子已吸附到锚点 (`isSnapped: true`)
- 轨迹预览点数量 > 0 (`trajectoryPointsLength > 0`)
- HUD 显示"是否吸附: 是"

### P2-02: 锥角限制
**文件**: `P2-02-cone-limit.png`  
**MD5**: `29f61ae57f2510c56b06ab7fc95a5d18`  
**验证内容**:
- 疯子已吸附到锚点
- 瞄准方向被限制在 ±70° 锥角内 (`|clampedAngleDeg| ≤ 70`)
- HUD 显示限制后的角度

### P2-03: 保留锚点发射
**文件**: `P2-03-kept-anchor.png`  
**MD5**: `fda82fc51bfdb9be730387b72ec49c3e`  
**验证内容**:
- 发射后锚点数量不变（保留锚点）
- 发射速度约为 16 u/s (基础速度，未消耗倍率)
- 锚点数量: 1 → 1

### P2-04: 消耗锚点发射
**文件**: `P2-04-consumed-anchor.png`  
**MD5**: `8d832ccb2b072f4ca6ec007d91887001`  
**验证内容**:
- 发射后锚点被移除（锚点数量减 1）
- 发射速度约为 21.6 u/s (16 * 1.35，消耗倍率)
- 锚点数量: 1 → 0

### P2-05: 悬停点修复和视觉改进
**文件**: `P2-05-hover-fix-visuals.png`  
**MD5**: `9c517f6b91d2333ad34fd9fc51a5e28b`  
**验证内容**:
- 疯子的悬停点完全在地面之上（身体不再部分嵌入地面）
- 疯子 Y 位置 < 地面 Y - 角色高度 * 0.3
- HUD 显示"是否吸附: 是"

### P2-06: 「已吸附」真实徽标
**文件**: `P2-06-snapped-badge.png`  
**MD5**: `9c517f6b91d2333ad34fd9fc51a5e28b`  
**验证内容**:
- 疯子已吸附到锚点
- 徽标可见 (`badgeVisible: true`)
- 徽标纹理为 `snap_badge_snapped_zh_m` (真实美术资源)

### P2-07: 粗吸附半径环
**文件**: `P2-07-bold-ring.png`  
**MD5**: `8b742865678b4dc6455b3bf1357de0af`  
**验证内容**:
- 环纹理为 `snap_ring_bold_m` (粗环美术资源)
- 显示半径为 64px (2.0u * 32px/u)
- 环缩放比例: (2.0 * 32) / 118 ≈ 0.542

## 注意事项

- 所有截图在冻结状态下捕获，确保 HUD 和徽标可见
- MD5 哈希用于验证每次运行生成的截图是新的，而非复用旧文件
- 测试断言在截图前执行，确保游戏状态正确
- Phase 2 新增轨迹预览、方向瞄准、弹射发射和保留/消耗机制的完整证据链

## 测试命令

```bash
npx playwright test e2e/phase2-evidence.spec.ts
```

## 相关文件

- 测试规范: `e2e/phase2-evidence.spec.ts`
- 单元测试: `test/anchorSystem.test.ts`
- 核心逻辑: `src/engine/anchorSystem.ts`
- 场景实现: `src/scenes/GameScene.ts`
- 调参配置: `src/config/tuning.ts`
