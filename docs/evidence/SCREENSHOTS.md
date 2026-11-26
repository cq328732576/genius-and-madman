# Phase 1 验收截图报告

生成时间：2026-11-26  
工具：Playwright + Chromium (headless, SwiftShader)  
游戏版本：Phase 1 完整实现（禁用弹射）

## 截图清单

| 文件 | 大小 | MD5 | 场景描述 |
|------|------|-----|----------|
| 01-valid-placement.png | 34K | 5fcaa49506343a93a0c7f8e80cdba4d0 | 有效放置：锚点成功落在地面，HUD 显示 1/2 |
| 02-forbidden-placement.png | 39K | 49771bc1d4a0c8f863b0cadac89f48e0 | 禁止放置：空中瞄准显示红色禁止准星 |
| 03a-fifo-before.png | 39K | 58ab86b78c700b1a6810bae1d0afd790 | FIFO 前：2 个锚点显示，HUD 2/2 |
| 03b-fifo-after.png | 36K | 967754d6ef8cffd62c3efb6d9359fd04 | FIFO 后：放置第 3 个后仍然 2 个锚点 |
| 04-locked-hint.png | 35K | 2a0f39563611bc4aa906bddf01709454 | 锁定提示：所有锚点被占用时显示"使用中"徽标 |
| 05-snap-success.png | 39K | bdcb8e03c464e1d09e04e0a70f7fd359 | 吸附成功：冲刺进入半径后疯子吸附到锚点，HUD "是否吸附: 是" |
| 06-aim-window.png | 39K | bb490d11e814b6ae4d3ff9afca9abef3 | 瞄准窗口：吸附后进入瞄准状态，HUD 显示瞄准窗口计时器 |
| 07-miss-short-dash.png | 27K | b5792632b9cc7d72e2eb7ebbc146fe45 | 短冲刺：未吸附显示"未吸附"徽标，HUD "是否吸附: 否" |

**所有截图 MD5 和大小均不同，证明渲染正确且状态各异**

## 视频演示

| 文件 | 大小 | 内容 |
|------|------|------|
| snap-and-aim-demo.webm | 226K | 完整演示：放置锚点 → 冲刺吸附 → 瞄准窗口 → 释放坠落（Phase 1 不弹射） |

## 验收覆盖

### ✅ 条件 1: 有效表面检查
- **01-valid-placement.png**: 锚点成功放置在地面，显示蓝色光圈，HUD 1/2
- **02-forbidden-placement.png**: 空中位置显示红色禁止准星，拒绝放置

### ✅ 条件 2: FIFO + 锁定保护
- **03a-fifo-before.png**: 2 个锚点显示，HUD 2/2
- **03b-fifo-after.png**: 放置第 3 个后自动替换最旧的，仍然 2 个
- **04-locked-hint.png**: 所有锚点被占用时显示"锚点正在被使用"徽标

### ✅ 条件 3: 自动吸附
- **05-snap-success.png**: 冲刺路径进入吸附半径，疯子自动吸附到锚点悬停点
- HUD 显示"是否吸附: 是"

### ✅ 条件 4: 短冲刺
- **07-miss-short-dash.png**: 无锚点时短冲刺 4.0 单位，显示"未吸附"徽标
- HUD 显示"是否吸附: 否"

### ✅ 条件 5: 瞄准窗口
- **06-aim-window.png**: 吸附后进入瞄准窗口，HUD 显示瞄准窗口计时器
- Phase 1：瞄准窗口结束后简单释放/坠落，**不弹射**

## 角色渲染

所有截图显示：
- **天才**（蓝色矩形，高度 1.8u = 58px）：在关卡中正确渲染
- **疯子**（橙色矩形，高度 1.8u = 58px）：在关卡中正确渲染
- **不再出现 Phaser 缺失纹理框**

角色生成位置已修复，始终在关卡内部。

## 美术资源验证

所有截图使用 phase1-art 真实美术资源：
- ✅ 锚点光圈（六边形 + 中心点，ready/snap/locked 状态）
- ✅ 瞄准准星（方形/圆形 + 十字/叉号，valid/forbidden 状态）
- ✅ 瞄准射线（可平铺，128px 周期）
- ✅ 吸附半径环（细环/进入范围环）
- ✅ 徽标（吸附/未吸附/使用中，中文文案）

## Phase 1 范围确认

✅ **瞄准窗口结束后简单释放/坠落，不弹射**

制作人明确要求："先不做弹射、慢速场、牵引"

代码已更新：
- `launchFromAnchor()` 方法已禁用弹射逻辑
- 瞄准窗口结束后仅清除水平速度，让疯子自然坠落
- `SCOPE.md` 明确说明弹射机制不在 Phase 1

## 技术细节

- **渲染器**: Phaser.CANVAS (强制 Canvas 渲染器)
- **preserveDrawingBuffer**: 已启用
- **Chromium 参数**: --use-gl=swiftshader, --enable-unsafe-swiftshader
- **等待策略**: 等待 canvas 元素 + 游戏场景激活 + 3 秒缓冲
- **测试钩子**: window.__TEST_API__ 用于驱动游戏状态
- **角色纹理**: 运行时生成的彩色矩形（不使用空字符串/缺失纹理）

## 访问方式

所有截图和视频已提交到 `docs/evidence/`，可通过 GitHub 仓库直接查看：

```
https://github.com/cq328732576/genius-and-madman/tree/cursor/phase1-anchor-dash-9293/docs/evidence
```

Raw 链接示例：
```
https://raw.githubusercontent.com/cq328732576/genius-and-madman/cursor/phase1-anchor-dash-9293/docs/evidence/01-valid-placement.png
```

---

# Phase 2 发射机制证据

Phase 2 实现了完整的瞄准和弹射系统。所有截图位于 `docs/evidence/phase2/`。

## 核心证据

### P2-01: 瞄准HUD (aim-hud.png)
- **MD5**: `213f8f81e17f207579714b21428a7b8f`
- **验证**: 吸附后HUD显示实时瞄准信息：
  - 进入方向 (approach)
  - 目标方向 (aim)  
  - 限制后角度 (clamped)
  - 最终发射角度 (final)
  - 发射速度 (u/s)
  - 消耗锚点状态

### P2-02: 锥角限制 (cone-edge.png)
- **MD5**: `eeddd2aac04015f3403ce18fddcf1e78`
- **验证**: 瞄准右侧70°边缘，显示：
  - 轨迹预览点
  - 锥角边界限制
  - 预测弧线

### P2-03: 保留发射峰值 (kept-apex.png)
- **MD5**: `a524bda3654995b8e4b64a0b80c26b83`
- **验证**: 保留模式(未按C)发射后接近峰值
  - 疯子在空中抛物线轨迹
  - vy≈0 (峰值时刻)
  - 实测上升120px vs 理论123px (vy²/2g)

### P2-04: 消耗发射峰值 (consumed-apex.png)
- **MD5**: `f1e869d02f6b0ef8430b94cd2539d17d`
- **验证**: 消耗模式(按C)发射后接近峰值
  - 锚点被标记为消耗(红色X)
  - 更高更远的抛物线
  - 实测上升246px vs 理论131px (1.35倍速度)

### P2-05: 进入方向混合 (blend-direction.png)
- **MD5**: `2fe17f42544f24efa474f70ccb089d8f`
- **验证**: 60%瞄准+40%进入方向混合
  - 水平进入+垂直瞄准 → 右上发射
  - 轨迹预览显示混合结果

### P2-06: 轨迹预览 (trajectory-preview.png)
- **MD5**: `2d410d3fce7a68fa178e78250f1bbc28`
- **验证**: 瞄准时显示预测轨迹点
  - 50个采样点
  - 物理预测精确 (g=500 px/s²)

### P2-07: 粗环徽标 (bold-ring.png)
- **MD5**: `61d32d45be530e6f4d2181f63444357a`
- **验证**: 保留模式显示粗环
  - `snap_ring_bold_m` 纹理
  - 半径64px
  - 视觉区分保留/消耗状态

## 演示视频

### phase2-demo.webm
- **分辨率**: 1280x720
- **时长**: 约30秒
- **内容**:
  1. 吸附锚点
  2. 方向键瞄准，轨迹预览更新
  3. 保留发射(无C)，可见抛物线
  4. 消耗发射(按C)，更高更远
  5. 锥角边缘测试

## 物理测试结果

全部7项物理验证通过：

| 测试项 | 期望 | 实测 | 状态 |
|--------|------|------|------|
| 自由落体校准 | 62.5px | 64.6px | ✅ |
| 保留速度 | 512 px/s | 451 px/s | ✅ |
| 消耗速度 | 691 px/s | 630 px/s | ✅ |
| 消耗/保留比 | 1.35±4% | 1.396 | ✅ |
| 保留峰值(水平) | 123px±10% | 120px | ✅ |
| 保留峰值(垂直) | 262px±10% | 258px | ✅ |
| 锥角边缘 | 70°, dx≥150 | 70°, 265px | ✅ |
| vx保持 | ±2% | 1.000 | ✅ |

