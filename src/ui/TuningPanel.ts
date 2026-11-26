/**
 * 运行时调参面板
 * 允许在游戏中实时调整参数
 */

import Phaser from 'phaser';
import { tuning, updateTuning } from '../config/tuning';

export class TuningPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private title: Phaser.GameObjects.Text;
  private closeButton: Phaser.GameObjects.Text;
  private isVisible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // 创建容器
    this.container = scene.add.container(100, 100);
    this.container.setDepth(2000);
    this.container.setScrollFactor(0);

    // 背景
    this.background = scene.add.rectangle(0, 0, 400, 600, 0x1a1a2e, 0.95);
    this.background.setStrokeStyle(2, 0x2fd5ff);
    this.container.add(this.background);

    // 标题
    this.title = scene.add.text(-180, -280, '⚙️ 运行时调参', {
      fontSize: '18px',
      color: '#2fd5ff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.container.add(this.title);

    // 关闭按钮
    this.closeButton = scene.add.text(170, -280, '✕', {
      fontSize: '20px',
      color: '#ff4d6d',
      fontFamily: 'monospace',
    });
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.on('pointerdown', () => this.hide());
    this.container.add(this.closeButton);

    // 创建控制项
    this.createControls();

    // 默认隐藏
    this.container.setVisible(false);
  }

  private createControls() {
    const params = [
      { key: 'genius.maxAnchors', label: '最大锚点数', min: 1, max: 5, step: 1 },
      { key: 'genius.maxPlacementRange', label: '最大射程', min: 5, max: 30, step: 1 },
      { key: 'madman.snapRadius', label: '吸附半径', min: 0.5, max: 5, step: 0.1 },
      { key: 'madman.shortDashDistance', label: '短冲距离', min: 1, max: 10, step: 0.5 },
      { key: 'madman.aimWindowBase', label: '瞄准窗口', min: 0.1, max: 1, step: 0.05 },
      { key: 'madman.launchSpeedBase', label: '弹射初速', min: 5, max: 30, step: 1 },
      { key: 'madman.preserveMultiplier', label: '保留倍率', min: 0.5, max: 2, step: 0.05 },
      { key: 'madman.consumeMultiplier', label: '消耗倍率', min: 1, max: 3, step: 0.05 },
    ];

    let yOffset = -240;
    params.forEach((param) => {
      // 获取当前值
      const value = this.getNestedValue(tuning, param.key);

      // 标签
      const label = this.scene.add.text(-180, yOffset, param.label, {
        fontSize: '12px',
        color: '#fff',
        fontFamily: 'monospace',
      });
      this.container.add(label);

      // 值显示
      const valueText = this.scene.add.text(100, yOffset, value.toFixed(2), {
        fontSize: '12px',
        color: '#2fd5ff',
        fontFamily: 'monospace',
      });
      this.container.add(valueText);

      // 创建HTML滑块
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = param.min.toString();
      slider.max = param.max.toString();
      slider.step = param.step.toString();
      slider.value = value.toString();
      slider.style.width = '150px';
      slider.style.marginLeft = '10px';

      slider.addEventListener('input', (e) => {
        const newValue = parseFloat((e.target as HTMLInputElement).value);
        valueText.setText(newValue.toFixed(2));
        this.setNestedValue(tuning, param.key, newValue);
      });

      const sliderElement = this.scene.add.dom(-90, yOffset + 25, slider);
      sliderElement.setOrigin(0, 0.5);
      this.container.add(sliderElement);

      yOffset += 65;
    });

    // 重置按钮
    const resetButton = this.scene.add.text(-80, yOffset + 10, '重置默认值', {
      fontSize: '14px',
      color: '#fff',
      backgroundColor: '#ff8a1f',
      padding: { x: 12, y: 6 },
      fontFamily: 'monospace',
    });
    resetButton.setInteractive({ useHandCursor: true });
    resetButton.on('pointerdown', () => this.resetToDefaults());
    this.container.add(resetButton);

    // 说明文字
    const hint = this.scene.add.text(-180, yOffset + 50, '按 T 键打开/关闭调参面板', {
      fontSize: '10px',
      color: '#888',
      fontFamily: 'monospace',
    });
    this.container.add(hint);
  }

  private getNestedValue(obj: any, path: string): number {
    const keys = path.split('.');
    let value = obj;
    for (const key of keys) {
      value = value[key];
    }
    return value;
  }

  private setNestedValue(obj: any, path: string, value: number): void {
    const keys = path.split('.');
    let target = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
  }

  private async resetToDefaults() {
    // 重新加载默认值
    const configModule = await import('../config/tuning');
    updateTuning(configModule.defaultTuning);
    
    // 刷新显示
    this.container.destroy();
    this.container = this.scene.add.container(100, 100);
    this.container.setDepth(2000);
    this.container.setScrollFactor(0);
    
    this.background = this.scene.add.rectangle(0, 0, 400, 600, 0x1a1a2e, 0.95);
    this.background.setStrokeStyle(2, 0x2fd5ff);
    this.container.add(this.background);
    
    this.title = this.scene.add.text(-180, -280, '⚙️ 运行时调参', {
      fontSize: '18px',
      color: '#2fd5ff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    });
    this.container.add(this.title);
    
    this.closeButton = this.scene.add.text(170, -280, '✕', {
      fontSize: '20px',
      color: '#ff4d6d',
      fontFamily: 'monospace',
    });
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.on('pointerdown', () => this.hide());
    this.container.add(this.closeButton);
    
    this.createControls();
    this.container.setVisible(this.isVisible);
  }

  public toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public show() {
    this.isVisible = true;
    this.container.setVisible(true);
  }

  public hide() {
    this.isVisible = false;
    this.container.setVisible(false);
  }

  public destroy() {
    this.container.destroy();
  }
}
