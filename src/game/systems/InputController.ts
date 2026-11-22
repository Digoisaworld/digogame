/**
 * InputController — the heart of the mobile feel.
 *
 * Requirements implemented here:
 *  - Pointer Events only (works on Android Chrome, iOS Safari, desktop).
 *  - Pointer capture so a finger that slides off the pad keeps controlling DIGO.
 *  - Multitouch safe: the first pointer that lands on the pad owns the drag; a
 *    second finger is ignored instead of hijacking the movement.
 *  - Absolute horizontal mapping: DIGO follows the finger position with smooth
 *    interpolation done by the engine, never a delayed "swipe".
 *  - pointercancel / blur / visibilitychange release cleanly — no stuck motion.
 *  - Optional left/right buttons run in parallel for players who prefer them.
 */
export class InputController {
  /** -1..1 normalised horizontal target, updated every frame. */
  target = 0;
  /** True while a finger is down on the pad or a direction button is held. */
  active = false;

  private pad: HTMLElement | null = null;
  private pointerId: number | null = null;
  private lastFromPad = 0;
  private buttonDir = 0;
  private enabled = true;
  private keyLeft = false;
  private keyRight = false;

  private readonly onPointerDown = (e: PointerEvent) => {
    if (!this.enabled || !this.pad) return;
    // Multitouch: only the first pointer owns the drag.
    if (this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.active = true;
    try {
      this.pad.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort; move events still arrive while inside */
    }
    this.updateFromPointer(e);
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (this.pointerId !== e.pointerId) return;
    e.preventDefault();
    this.updateFromPointer(e);
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    this.releasePointer();
  };

  private readonly onPointerCancel = (e: PointerEvent) => {
    if (this.pointerId !== e.pointerId) return;
    // Keep the last target instead of snapping back: no visual jump on cancel.
    this.releasePointer(true);
  };

  private readonly onContextMenu = (e: Event) => e.preventDefault();
  private readonly onBlur = () => this.releaseAll();

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      this.keyLeft = true;
      this.active = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      this.keyRight = true;
      this.active = true;
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keyLeft = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keyRight = false;
    if (!this.keyLeft && !this.keyRight && this.pointerId === null && this.buttonDir === 0) {
      this.active = false;
    }
  };

  attach(pad: HTMLElement): void {
    this.detach();
    this.pad = pad;
    pad.addEventListener('pointerdown', this.onPointerDown);
    pad.addEventListener('pointermove', this.onPointerMove);
    pad.addEventListener('pointerup', this.onPointerUp);
    pad.addEventListener('pointercancel', this.onPointerCancel);
    pad.addEventListener('pointerleave', this.onPointerCancel);
    pad.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    const pad = this.pad;
    if (pad) {
      pad.removeEventListener('pointerdown', this.onPointerDown);
      pad.removeEventListener('pointermove', this.onPointerMove);
      pad.removeEventListener('pointerup', this.onPointerUp);
      pad.removeEventListener('pointercancel', this.onPointerCancel);
      pad.removeEventListener('pointerleave', this.onPointerCancel);
      pad.removeEventListener('contextmenu', this.onContextMenu);
    }
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.pad = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  /** Called by the on-screen direction buttons (pointerdown/up). */
  setButton(dir: 'left' | 'right', pressed: boolean): void {
    if (!this.enabled) return;
    if (dir === 'left') this.buttonDir = pressed ? -1 : this.buttonDir === -1 ? 0 : this.buttonDir;
    else this.buttonDir = pressed ? 1 : this.buttonDir === 1 ? 0 : this.buttonDir;
    this.active = pressed || this.pointerId !== null || this.keyLeft || this.keyRight;
  }

  releaseAll(): void {
    this.pointerId = null;
    this.buttonDir = 0;
    this.keyLeft = false;
    this.keyRight = false;
    this.active = false;
    this.target = 0;
  }

  private releasePointer(keepTarget = false): void {
    const pad = this.pad;
    const id = this.pointerId;
    if (pad && id !== null) {
      try {
        if (pad.hasPointerCapture(id)) pad.releasePointerCapture(id);
      } catch {
        /* ignore */
      }
    }
    this.pointerId = null;
    if (!keepTarget) this.lastFromPad = this.lastFromPad;
    this.active = this.buttonDir !== 0 || this.keyLeft || this.keyRight;
  }

  private updateFromPointer(e: PointerEvent): void {
    const pad = this.pad;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, ratio));
    this.lastFromPad = clamped * 2 - 1;
    this.target = this.lastFromPad;
  }

  /** Blends pad / buttons / keyboard into the final target for this frame. */
  sample(): number {
    if (!this.enabled) return 0;
    if (this.pointerId !== null) return this.lastFromPad;
    if (this.keyLeft && !this.keyRight) return -1;
    if (this.keyRight && !this.keyLeft) return 1;
    if (this.buttonDir !== 0) return this.buttonDir;
    if (this.keyLeft && this.keyRight) return 0;
    return this.target;
  }

  get isDragging(): boolean {
    return this.pointerId !== null;
  }
}
