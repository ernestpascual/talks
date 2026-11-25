type Cue = "activate" | "substitute";
const CLIPS: Record<Cue, string> = {
  activate: "/sound/activatejutsu.mp3",
  substitute: "/sound/subsitution.mp3",
};

export class JutsuAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<Cue, AudioBuffer>();
  private sources = new Map<Cue, AudioBufferSourceNode>();
  private loading: Promise<void> | null = null;

  // Called directly by the Start camera click to unlock browser audio policies.
  unlock() {
    if (typeof AudioContext === "undefined") return;
    try {
      this.context ??= new AudioContext();
      const context = this.context;
      void context.resume().catch(() => {});
      this.loading ??= Promise.all((Object.keys(CLIPS) as Cue[]).map(async (cue) => {
        const response = await fetch(CLIPS[cue]);
        if (!response.ok) throw new Error("Audio clip unavailable.");
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(cue, buffer);
      })).then(() => {}).catch(() => { this.loading = null; });
    } catch { /* Camera tracking remains available if audio is unsupported. */ }
  }

  play(cue: Cue) {
    const context = this.context, buffer = this.buffers.get(cue);
    if (!context || context.state === "closed" || !buffer) return;
    this.sources.get(cue)?.stop();
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      source.disconnect();
      if (this.sources.get(cue) === source) this.sources.delete(cue);
    };
    this.sources.set(cue, source);
    source.start();
  }

  activationLeadMs() {
    return (this.buffers.get("activate")?.duration ?? 1.6) * 1000 * 0.7;
  }

  stop() {
    for (const source of this.sources.values()) source.stop();
    this.sources.clear();
  }

  dispose() {
    this.stop();
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
