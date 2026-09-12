import Phaser from 'phaser';
import './style.css';
import ShopScene from './scenes/ShopScene';
import TownScene from './scenes/TownScene';
import { initUI } from './ui/ui';
import { loadGame, initAutosave } from './game/save';

loadGame();
initAutosave();

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
  scene: [ShopScene, TownScene],
};

new Phaser.Game(config);
initUI();
