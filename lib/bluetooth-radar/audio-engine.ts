/**
 * Generative Web Audio API Synthesizer for High-Pitch Retro Radar Sonar Pings & Ambience
 */
class RadarAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private ambientGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      const ctx = new AudioCtxClass();
      this.ctx = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, ctx.currentTime);
      masterGain.connect(ctx.destination);
      this.masterGain = masterGain;

      // Atmospheric radar sub-hum
      this.startAmbientHum(ctx, masterGain);

      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio initialization skipped:", e);
    }
  }

  private startAmbientHum(ctx: AudioContext, destination: GainNode) {
    try {
      // Sub-bass sine wave oscillator (55Hz / A1)
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(55, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(110, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.03, ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destination);

      osc.start();
      this.ambientGain = gain;
    } catch {
      // Ignore ambient hum errors
    }
  }

  /**
   * Play a crisp, 3-note high-pitched crystal radar sonar arpeggio
   * @param distance Estimated distance in meters (0.2m - 5.0m)
   * @param angle Angle in degrees (0 - 360) for stereo spatial panning
   */
  public playSonarPing(distance: number = 2.5, angle: number = 0) {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const ctx = this.ctx;
    const startTime = ctx.currentTime;

    // High Pitch Base: Scales from 2100Hz (8m far) up to 2800Hz (0.2m close)
    const normDist = Math.min(1, Math.max(0, (distance - 0.2) / 7.8));
    const rootFreq = 2800 - normDist * 700; // 2800Hz (close) -> 2100Hz (far)

    // Stereo Panning: map angle to left (-1) / right (+1)
    const rad = (angle * Math.PI) / 180;
    const panX = Math.sin(rad);

    let pannerNode: StereoPannerNode | GainNode;
    if (typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, panX)), startTime);
      pannerNode = panner;
    } else {
      pannerNode = ctx.createGain();
    }
    pannerNode.connect(this.masterGain);

    // 3-Note Rising Crystal Arpeggio (Root -> Major 3rd -> Perfect 5th)
    const noteIntervals = [
      { delay: 0.0, freqMultiplier: 1.0, duration: 0.22, gainMultiplier: 0.18 }, // Note 1
      { delay: 0.075, freqMultiplier: 1.25, duration: 0.22, gainMultiplier: 0.22 }, // Note 2 (+Major 3rd)
      { delay: 0.15, freqMultiplier: 1.5, duration: 0.28, gainMultiplier: 0.26 }, // Note 3 (+Perfect 5th)
    ];

    noteIntervals.forEach(({ delay, freqMultiplier, duration, gainMultiplier }) => {
      try {
        const noteTime = startTime + delay;
        const noteFreq = rootFreq * freqMultiplier;

        // 1. Crystal sine wave oscillator
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(noteFreq * 1.05, noteTime);
        osc.frequency.exponentialRampToValueAtTime(noteFreq, noteTime + 0.015);
        osc.frequency.exponentialRampToValueAtTime(noteFreq * 0.98, noteTime + duration);

        // 2. Resonant bandpass filter for metallic submarine ping texture
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(noteFreq, noteTime);
        filter.Q.setValueAtTime(9.0, noteTime);

        // 3. Shimmering high-order overtone
        const harmOsc = ctx.createOscillator();
        harmOsc.type = "triangle";
        harmOsc.frequency.setValueAtTime(noteFreq * 2.0, noteTime);
        harmOsc.frequency.exponentialRampToValueAtTime(noteFreq * 1.9, noteTime + duration * 0.5);

        // Gain envelopes
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.0001, noteTime);
        oscGain.gain.linearRampToValueAtTime(gainMultiplier, noteTime + 0.004);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + duration);

        const harmGain = ctx.createGain();
        harmGain.gain.setValueAtTime(0.0001, noteTime);
        harmGain.gain.linearRampToValueAtTime(gainMultiplier * 0.28, noteTime + 0.003);
        harmGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + duration * 0.45);

        osc.connect(filter);
        filter.connect(oscGain);
        harmOsc.connect(harmGain);

        oscGain.connect(pannerNode);
        harmGain.connect(pannerNode);

        osc.start(noteTime);
        harmOsc.start(noteTime);

        osc.stop(noteTime + duration + 0.02);
        harmOsc.stop(noteTime + duration * 0.5 + 0.02);
      } catch {
        // Ignore synthesis error
      }
    });
  }

  /**
   * Play target lock / selection double-chirp
   */
  public playTargetLock() {
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    try {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(2400, now);
      osc.frequency.setValueAtTime(3200, now + 0.035);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.11);
    } catch {
      // Ignore
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.85, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const radarAudio = new RadarAudioEngine();
