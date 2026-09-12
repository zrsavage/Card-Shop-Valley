import Phaser from 'phaser';
import './style.css';
import ShopScene from './scenes/ShopScene';
import { initUI } from './ui/ui';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1b120a',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [ShopScene],
};

new Phaser.Game(config);
initUI();
