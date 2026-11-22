import { PLAYER } from '../types';

/**
 * Touch / mouse / keyboard input.
 *
 * The primary control is a large hold-and-drag pad: while a finger is held the
 * character follows the horizontal finger position absolutely, so movement
 * continues without interruption and never gets "stuck".
 *
 * Robustness rules:
 *  - Pointer Events with pointer capture, one tracked pointer id only.
 *  - pointerup / pointercancel / lostpointercapture all release the pad.
 *  - touch-action:none + preventDefault stop scrolling and text selection.
 *  - Optional left/right buttons and keyboard set a direction instead.
 */

export interface InputOptions {
  drag: boolean;
  buttons: boolean;
}

export class InputController {
  private pad: HTMLElement | null = null;
  private pointerId: number | null = null;
  private target: number | null = null;
  private dir = 0;
  private jumpQueued = false;
  private readonly keys = new Set<string>();
  private readonly lane: number;
  private readonly options: InputOptions;
  private bound = false;

  constructor(options: InputOptions) {
    this.options = options;
    this.lane = PLAYER.lane;
  }

  /* ----------------------------- pad ------------------------------ */

  attachPad(el: HTMLElement | null): void {
    this.detachPad();
    if (!el || !this.options.drag) return;
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

  private positionFromEvent(e: PointerEvent): number {
    const el = this.pad;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const t = (e.clientX - rect.left) / rect.width;
    return Math.max(-1, Math.min(1, t * 2 - 1)) * this.lane;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return; // ignore extra fingers
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.pad?.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    this.target = this.positionFromEvent(e);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    e.preventDefault();
    this.target = this.positionFromEvent(e);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.pointerId !== null && e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.target = null;
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
  };

  /* ---------------------------- buttons --------------------------- */

  /** Called by the on-screen arrow buttons (held). */
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

  /** Absolute target position, or null when the pad is not held. */
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
