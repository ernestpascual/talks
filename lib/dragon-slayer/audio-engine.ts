/**
 * Generative Web Audio API Synthesizer for Lightsabers, Dragon Roars, and Combat Impacts
 * Zero continuous background hum — audio only plays during swings, clashes, and actions.
 */
export class LightsaberAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private masterGain: GainNode | null = null;

  // Dynamic swing nodes (silent until swinging)
  private swingGain: GainNode | null = null;
  private swingFilter: BiquadFilterNode | null = null;
  private swingOsc: OscillatorNode | null = null;
  private lastSwingTime: number = 0;

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtxClass =
        typeof window !== "undefined"
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : null;
      if (!AudioCtxClass) return;

      const ctx = new AudioCtxClass();
      this.ctx = ctx;

      // Master output gain node
      const master = ctx.createGain();
      master.gain.setValueAtTime(this.isMuted ? 0 : 0.6, ctx.currentTime);
      master.connect(ctx.destination);
      this.masterGain = master;

      // Initialize swing synthesizer (silent by default, only sounds when swinging)
      this.initSwingSynth(ctx, master);

      this.isInitialized = true;
    } catch (e) {
      console.warn("Lightsaber Web Audio init skipped:", e);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.6, this.ctx.currentTime);
    }
  }

  public getMuted() {
    return this.isMuted;
  }

  private initSwingSynth(ctx: AudioContext, destination: GainNode) {
    try {
      const swingGain = ctx.createGain();
      swingGain.gain.setValueAtTime(0, ctx.currentTime);
      swingGain.connect(destination);
      this.swingGain = swingGain;

      const swingFilter = ctx.createBiquadFilter();
      swingFilter.type = "bandpass";
      swingFilter.frequency.setValueAtTime(180, ctx.currentTime);
      swingFilter.Q.setValueAtTime(2.5, ctx.currentTime);
      this.swingFilter = swingFilter;

      const swingOsc = ctx.createOscillator();
      swingOsc.type = "sawtooth";
      swingOsc.frequency.setValueAtTime(90, ctx.currentTime);

      swingOsc.connect(swingFilter);
      swingFilter.connect(swingGain);
      swingOsc.start();

      this.swingOsc = swingOsc;
    } catch (e) {
      console.warn("Swing synth init failed:", e);
    }
  }

  /**
   * Update lightsaber swing sound dynamically based on swipe velocity (px/ms)
   * Only outputs sound when moving; completely silent when still.
   */
  public updateSwingVelocity(velocity: number) {
    if (this.isMuted || !this.ctx || !this.swingGain || !this.swingFilter || !this.swingOsc) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const norm = Math.min(1.0, Math.max(0, velocity / 2.8));

    if (norm > 0.15) {
      const targetGain = Math.min(0.2, norm * 0.22);
      const targetFreq = 95 + norm * 180; // 95Hz - 275Hz swing swoosh
      const targetFilter = 240 + norm * 420;

      this.swingGain.gain.cancelScheduledValues(now);
      this.swingGain.gain.setTargetAtTime(targetGain, now, 0.03);

      this.swingOsc.frequency.cancelScheduledValues(now);
      this.swingOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);

      this.swingFilter.frequency.cancelScheduledValues(now);
      this.swingFilter.frequency.setTargetAtTime(targetFilter, now, 0.04);
      this.lastSwingTime = Date.now();
    } else if (Date.now() - this.lastSwingTime > 60) {
      // Fade to complete silence when still
      this.swingGain.gain.cancelScheduledValues(now);
      this.swingGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  /**
   * Lightsaber Ignition "PWSHHH-VWOMMM"
   */
  public playIgnition() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dest = this.masterGain;

    // 1. Initial burst noise
    const bufferSize = Math.floor(ctx.sampleRate * 0.12);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(850, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(now);

    // 2. Rising power-up tone
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.4);

    const oscFilter = ctx.createBiquadFilter();
    oscFilter.type = "lowpass";
    oscFilter.frequency.setValueAtTime(350, now);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    oscGain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Lightsaber Strike / Clash against Dragon
   */
  public playClash(isCritical: boolean = false) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dest = this.masterGain;

    const dur = isCritical ? 0.28 : 0.18;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(isCritical ? 1200 : 1500, now);
    filter.Q.setValueAtTime(isCritical ? 3.0 : 2.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isCritical ? 0.28 : 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(now);

    // Deep Plasma Sub Impact
    const bass = ctx.createOscillator();
    bass.type = "sine";
    bass.frequency.setValueAtTime(isCritical ? 150 : 120, now);
    bass.frequency.exponentialRampToValueAtTime(35, now + (isCritical ? 0.3 : 0.18));

    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(isCritical ? 0.35 : 0.22, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + (isCritical ? 0.32 : 0.2));

    bass.connect(bassGain);
    bassGain.connect(dest);
    bass.start(now);
    bass.stop(now + (isCritical ? 0.35 : 0.22));

    // Electric zap
    const zap = ctx.createOscillator();
    zap.type = "triangle";
    zap.frequency.setValueAtTime(isCritical ? 550 : 450, now);
    zap.frequency.exponentialRampToValueAtTime(90, now + 0.12);

    const zapGain = ctx.createGain();
    zapGain.gain.setValueAtTime(isCritical ? 0.16 : 0.1, now);
    zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    zap.connect(zapGain);
    zapGain.connect(dest);
    zap.start(now);
    zap.stop(now + 0.15);
  }

  /**
   * Slicing Dragon's Fireball
   */
  public playFireballSlice() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dest = this.masterGain;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.22);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Dragon Roar / Growl (Harmonic beast roar on phase change or heavy hit)
   */
  public playDragonRoar(isEnrage: boolean = false) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dest = this.masterGain;
    const dur = isEnrage ? 1.2 : 0.7;

    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(isEnrage ? 75 : 65, now);
    osc1.frequency.linearRampToValueAtTime(isEnrage ? 120 : 95, now + dur * 0.3);
    osc1.frequency.exponentialRampToValueAtTime(38, now + dur);

    const osc2 = ctx.createOscillator();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(isEnrage ? 78 : 68, now);
    osc2.frequency.linearRampToValueAtTime(isEnrage ? 125 : 98, now + dur * 0.3);
    osc2.frequency.exponentialRampToValueAtTime(40, now + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(240, now);
    filter.frequency.linearRampToValueAtTime(isEnrage ? 750 : 550, now + dur * 0.3);
    filter.frequency.exponentialRampToValueAtTime(160, now + dur);
    filter.Q.setValueAtTime(3.0, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.05);
    osc2.stop(now + dur + 0.05);
  }

  /**
   * Dragon Defeated Victory Fanfare
   */
  public playVictory() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});

    const ctx = this.ctx;
    const dest = this.masterGain;
    const now = ctx.currentTime;

    const notes = [220.0, 277.18, 329.63, 440.0, 554.37, 659.25];
    notes.forEach((freq, i) => {
      const startTime = now + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.16, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.8);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(startTime + 2.0);
    });
  }

  public cleanup() {
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
    this.isInitialized = false;
  }
}

export const dragonAudio = new LightsaberAudioEngine();
