// A shared virtual-input state that the on-screen touch controls (wired up
// in ui.ts) write to, and every scene's movement/action checks read from
// alongside the real keyboard state — e.g.
//   if (cursors.left?.isDown || wasd.left.isDown || touchControls.left)
// so touch is just another input source feeding the exact same movement
// and action logic, not a separate code path to keep in sync.

class TouchControls {
  // Movement is held state, same as a keyboard Key's `isDown`.
  left = false;
  right = false;
  up = false;
  down = false;

  // Actions are one-shot pulses, consumed the moment a scene checks them —
  // same shape as Phaser.Input.Keyboard.JustDown() on a real key, so a tap
  // fires exactly once regardless of how long the finger stays down.
  private interact = false;
  private attack = false;
  private ranged = false;

  pressInteract() {
    this.interact = true;
  }

  pressAttack() {
    this.attack = true;
  }

  pressRanged() {
    this.ranged = true;
  }

  consumeInteract(): boolean {
    const v = this.interact;
    this.interact = false;
    return v;
  }

  consumeAttack(): boolean {
    const v = this.attack;
    this.attack = false;
    return v;
  }

  consumeRanged(): boolean {
    const v = this.ranged;
    this.ranged = false;
    return v;
  }

  /** Called when the touch controls are hidden (e.g. a modal opens) so a
   * direction doesn't stay stuck "held" if the finger lifted off-screen. */
  releaseAll() {
    this.left = this.right = this.up = this.down = false;
  }
}

export const touchControls = new TouchControls();

/** True for touch-primary devices (phones/tablets), not just narrow
 * windows — a mouse/trackpad user resizing their browser small shouldn't
 * suddenly get on-screen buttons. Checked once; device input capability
 * doesn't change mid-session. */
export function isTouchDevice(): boolean {
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  } catch {
    return false;
  }
}
