// Animation-frame timestamps describe the start of a frame, which can be older
// than a preceding startup or click inference. Each model owns its own clock.
export class VideoClock {
  private last = -1;

  next(now = performance.now()): number {
    this.last = Math.max(Math.floor(now), this.last + 1);
    return this.last;
  }
}
