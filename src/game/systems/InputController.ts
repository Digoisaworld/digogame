import { PLAYER } from '../types';

/**
 * Finger controls for DIGO EVOLUTION.
 *
 * The character is steered directly with the finger:
 *  - drag / swipe left or right moves DIGO left or right, following the finger
 *    delta relative to where the touch started (so a swipe is a real movement
 *    command and the character never teleports under the thumb);
 *  - swiping up jumps, once per gesture;
 *  - releasing, cancelling or losing capture stops movement immediately, so
 *    DIGO can never get "stuck" running;
 *  - desktop keeps Arrow/A/D and Space/W/ArrowUp.
 *
 * Movement speed, jump height and physics are untouched: this controller only
 * produces the same `targetX` / `direction` / `consumeJump()` signals the engine
 * already consumed.
 *
 * Robustness rules:
 *  - Pointer Events with pointer capture, exactly one tracked pointer id.
 *  - pointerup / pointercancel / lostpointercapture all release the gesture.
 *  - touch-action:none plus preventDefault stop scrolling and text selection.
 *  - Multi-touch: extra fingers are ignored while a gesture is active.
 */

export interface InputOptions {
  /** Live world x of the character, used as the base for relative swipes. */
  getX?: () => number;
}

/** Fraction of the pad width that equals a full lane sweep. */
const SWIPE_SENSITIVITY = 1;

/** Upward travel (CSS px) that counts as a jump swipe. */
const JUMP_SWIPE_PX = 42;

/** Horizontal travel (CSS px) below which a drag is treated as a tap. */
const DEAD_ZONE_PX = 4;

export class InputController {
  private pad: HTMLElement | null = null;
  private pointerId: number | null = null;
  private target: number | null = null;
  private dir = 0;
  private jumpQueued = false;
  private jumpedThisGesture = false;
  private startX = 0;
  private startY = 0;
  private baseX = 0;
  private readonly keys = new Set<string>();
  private readonly lane: number;
  private readonly options: InputOptions;
  private bound = false;

  constructor(options: InputOptions = {}) {
    this.options = options;
    this.lane = PLAYER.lane;
  }

  /* ----------------------------- gestures ------------------------- */

  attachPad(el: HTMLElement | null): void {
    this.detachPad();
    if (!el) return;
    this.pad = el;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerUp);
    el.addEventListener('lostpointercapture', this.onPointerUp);
    el.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.bound = true;
  }

  detachPad(): void {
    if (this.bound) {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onBlur);
      this.bound = false;
    }
    const el = this.pad;
    if (el) {
      el.removeEventListener('pointerdown', this.onPointerDown);
      el.removeEventListener('pointermove', this.onPointerMove);
      el.removeEventListener('pointerup', this.onPointerUp);
      el.removeEventListener('pointercancel', this.onPointerUp);
      el.removeEventListener('lostpointercapture', this.onPointerUp);
      el.removeEventListener('contextmenu', this.onContextMenu);
    }
    this.pad = null;
    this.pointerId = null;
    this.target = null;
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private currentX(): number {
    const value = this.options.getX?.();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return this.target ?? 0;
  }

  private padWidth(): number {
    const rect = this.pad?.getBoundingClientRect();
    return rect && rect.width > 0 ? rect.width : 360;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return; // one finger steers DIGO
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.baseX = this.currentX();
    this.jumpedThisGesture = false;
    try {
      this.pad?.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    e.preventDefault();

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    // Swipe up = jump. Only once per gesture, and only when the gesture is
    // clearly more vertical than horizontal.
    if (!this.jumpedThisGesture && dy <= -JUMP_SWIPE_PX && Math.abs(dy) > Math.abs(dx) * 1.1) {
      this.jumpedThisGesture = true;
      this.jumpQueued = true;
      // Rebase so the same finger can steer sideways after the jump.
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.baseX = this.currentX();
      return;
    }

    if (Math.abs(dx) <= DEAD_ZONE_PX) return;

    // Relative mapping: a swipe of one pad width sweeps the whole lane.
    const worldDelta = (dx / this.padWidth()) * 2 * this.lane * SWIPE_SENSITIVITY;
    this.target = Math.max(-this.lane, Math.min(this.lane, this.baseX + worldDelta));
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.pointerId !== null && e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.target = null;
    this.jumpedThisGesture = false;
    try {
      if (this.pad?.hasPointerCapture(e.pointerId)) {
        this.pad.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  /* --------------------------- keyboard --------------------------- */

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) {
      if (e.code === 'Space') e.preventDefault();
      return;
    }
    const code = e.code;
    if (code === 'ArrowLeft' || code === 'KeyA') {
      this.keys.add('left');
      e.preventDefault();
    } else if (code === 'ArrowRight' || code === 'KeyD') {
      this.keys.add('right');
      e.preventDefault();
    } else if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
      this.jumpQueued = true;
      e.preventDefault();
    }
    this.syncDir();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    if (code === 'ArrowLeft' || code === 'KeyA') this.keys.delete('left');
    if (code === 'ArrowRight' || code === 'KeyD') this.keys.delete('right');
    this.syncDir();
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.dir = 0;
    this.target = null;
    this.pointerId = null;
    this.jumpedThisGesture = false;
  };

  /* ------------------------------ api ----------------------------- */

  /** Direct direction control (keyboard fallback / programmatic). */
  setDirection(dir: number): void {
    this.dir = Math.max(-1, Math.min(1, dir));
  }

  private syncDir(): void {
    const left = this.keys.has('left');
    const right = this.keys.has('right');
    this.dir = (right ? 1 : 0) - (left ? 1 : 0);
  }

  requestJump(): void {
    this.jumpQueued = true;
  }

  consumeJump(): boolean {
    if (!this.jumpQueued) return false;
    this.jumpQueued = false;
    return true;
  }

  /** Target position from the active gesture, or null when not held. */
  get targetX(): number | null {
    return this.target;
  }

  get direction(): number {
    return this.dir;
  }

  get holding(): boolean {
    return this.pointerId !== null;
  }

  dispose(): void {
    this.detachPad();
    this.keys.clear();
  }
}
