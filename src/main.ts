import Phaser from 'phaser';
import './style.css';
import ShopScene from './scenes/ShopScene';
import TownScene from './scenes/TownScene';
import WildsScene from './scenes/WildsScene';
import DistributorScene from './scenes/DistributorScene';
import { initUI } from './ui/ui';
import { loadGame, initAutosave } from './game/save';
import { gameState, bus } from './game/state';

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
  scene: [ShopScene, TownScene, WildsScene, DistributorScene],
};

const game = new Phaser.Game(config);
initUI();

// Dev-only test hook — dead-code-eliminated from production builds since
// import.meta.env.DEV is statically replaced with `false` by Vite.
if (import.meta.env.DEV) {
  (window as unknown as { __debug: { gameState: typeof gameState; bus: typeof bus; game: Phaser.Game } }).__debug = {
    gameState,
    bus,
    game,
  };
}
