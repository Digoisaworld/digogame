import type { WorldDef } from '../worlds';

export type SfxName =
  | 'coin'
  | 'diamond'
  | 'energy'
  | 'chest'
  | 'legendary'
  | 'bombWarn'
  | 'explosion'
  | 'enemy'
  | 'powerup'
  | 'levelup'
  | 'victory'
  | 'defeat'
  | 'ui'
  | 'dodge'
  | 'boss';

/**
 * Fully procedural audio: every sound effect and the per-world music loop are
 * synthesised with the Web Audio API, so the project ships without binary
 * audio assets and can be exported as plain source.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private scale: number[] = [0, 2, 4, 7, 9, 12];
  private tempo = 108;
  private musicVolume = 0.45;
  private sfxVolume = 0.7;
  private musicPlaying = false;

  /** Must be called from a user gesture (tap/click) to satisfy autoplay rules. */
  unlock(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
        void this.ctx.resume().catch(() => undefined);
      }
      return this.ctx;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume * 0.5;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
      const len = Math.floor(this.ctx.sampleRate * 0.4);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
      // Android System WebView may create the context in a suspended state.
      // Resume immediately while still inside the user's pointer gesture.
      void this.ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = Math.min(1, Math.max(0, music));
    this.sfxVolume = Math.min(1, Math.max(0, sfx));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.5, this.ctx.currentTime, 0.05);
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    when = 0,
    slideTo?: number,
  ): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private burst(dur: number, gain: number, filterFreq: number, when = 0): void {
    const ctx = this.ctx;
    const dest = this.sfxGain;
    if (!ctx || !dest || !this.noise) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, filterFreq * 0.2), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name: SfxName): void {
    if (!this.ctx || this.sfxVolume <= 0) return;
    if (this.ctx.state !== 'running') {
      const context = this.ctx;
      if (context.state === 'closed') return;
      void context.resume().then(() => {
        if (this.ctx === context && context.state === 'running') this.play(name);
      }).catch(() => undefined);
      return;
    }
    switch (name) {
      case 'coin':
        this.tone(1180, 0.09, 'triangle', 0.32);
        this.tone(1760, 0.12, 'triangle', 0.24, 0.06);
        break;
      case 'diamond':
        this.tone(1560, 0.1, 'sine', 0.28);
        this.tone(2100, 0.12, 'sine', 0.22, 0.05);
        this.tone(2640, 0.16, 'sine', 0.18, 0.1);
        break;
      case 'energy':
        this.tone(880, 0.1, 'square', 0.18);
        this.tone(1320, 0.14, 'square', 0.14, 0.05);
        break;
      case 'chest':
        this.tone(520, 0.12, 'sawtooth', 0.2);
        this.tone(780, 0.16, 'sawtooth', 0.16, 0.07);
        this.tone(1040, 0.2, 'triangle', 0.16, 0.14);
        break;
      case 'legendary':
        [0, 4, 7, 12].forEach((semi, i) =>
          this.tone(523.25 * Math.pow(2, semi / 12), 0.28, 'triangle', 0.2, i * 0.06),
        );
        break;
      case 'bombWarn':
        this.tone(240, 0.1, 'square', 0.22);
        this.tone(240, 0.1, 'square', 0.2, 0.14);
        break;
      case 'explosion':
        this.burst(0.5, 0.55, 1400);
        this.tone(160, 0.4, 'sawtooth', 0.3, 0, 40);
        break;
      case 'enemy':
        this.tone(300, 0.18, 'sawtooth', 0.26, 0, 90);
        this.burst(0.2, 0.2, 900);
        break;
      case 'powerup':
        [0, 5, 9, 12].forEach((semi, i) =>
          this.tone(440 * Math.pow(2, semi / 12), 0.16, 'square', 0.16, i * 0.05),
        );
        break;
      case 'levelup':
        [0, 4, 7, 12, 16].forEach((semi, i) =>
          this.tone(523.25 * Math.pow(2, semi / 12), 0.22, 'triangle', 0.2, i * 0.08),
        );
        break;
      case 'victory':
        [0, 4, 7, 12, 7, 12].forEach((semi, i) =>
          this.tone(392 * Math.pow(2, semi / 12), 0.3, 'triangle', 0.22, i * 0.13),
        );
        break;
      case 'defeat':
        [0, -3, -7, -12].forEach((semi, i) =>
          this.tone(392 * Math.pow(2, semi / 12), 0.34, 'sawtooth', 0.2, i * 0.16),
        );
        break;
      case 'dodge':
        this.tone(700, 0.14, 'sine', 0.16, 0, 1400);
        break;
      case 'boss':
        this.tone(110, 0.7, 'sawtooth', 0.3, 0, 55);
        this.burst(0.6, 0.25, 700);
        break;
      case 'ui':
      default:
        this.tone(660, 0.06, 'sine', 0.16);
        break;
    }
  }

  startMusic(world: WorldDef): void {
    const ctx = this.unlock();
    if (!ctx || !this.musicGain) return;
    this.scale = world.scale;
    this.tempo = world.tempo;
    this.step = 0;
    this.nextNoteTime = ctx.currentTime + 0.1;
    if (this.musicPlaying) {
      // If Android suspended audio while the app was backgrounded, resume the
      // existing sequencer from the current audio clock instead of staying mute.
      void ctx.resume().then(() => {
        if (this.musicPlaying && this.ctx === ctx) {
          this.nextNoteTime = ctx.currentTime + 0.05;
          this.scheduleMusic();
        }
      }).catch(() => undefined);
      return;
    }
    this.musicPlaying = true;
    const tick = () => {
      if (ctx.state !== 'running') {
        void ctx.resume().catch(() => undefined);
        return;
      }
      this.scheduleMusic();
    };
    this.musicTimer = window.setInterval(tick, 120);
    void ctx.resume().then(() => {
      if (this.musicPlaying && this.ctx === ctx) {
        this.nextNoteTime = ctx.currentTime + 0.05;
        this.scheduleMusic();
      }
    }).catch(() => undefined);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicPlaying = false;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest || !this.musicPlaying) return;
    const stepDur = 60 / this.tempo / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.35) {
      const t = this.nextNoteTime;
      const i = this.step % this.scale.length;
      const octave = this.step % 8 < 4 ? 1 : 2;
      const freq = 220 * Math.pow(2, this.scale[i] / 12) * octave;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = this.step % 4 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 0.9);
      osc.connect(g);
      g.connect(dest);
      osc.start(t);
      osc.stop(t + stepDur);
      if (this.step % 4 === 0) {
        const bass = ctx.createOscillator();
        const bg = ctx.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(freq / 4, t);
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
        bg.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 1.8);
        bass.connect(bg);
        bg.connect(dest);
        bass.start(t);
        bass.stop(t + stepDur * 2);
      }
      this.step += 1;
      this.nextNoteTime += stepDur;
    }
  }

  dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
