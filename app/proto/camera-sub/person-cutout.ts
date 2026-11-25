export type PersonBounds = { x: number; y: number; width: number; height: number };

export function backgroundMask(confidence: Float32Array, width: number, height: number) {
  if (width < 1 || height < 1 || confidence.length !== width * height) throw new Error("Invalid segmentation mask.");
  const pixels = new Uint8ClampedArray(width * height * 4);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!Number.isFinite(confidence[i]) || confidence[i] < 0.6) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    // Erode the background slightly to remove hair and hand outlines as well.
    let background = 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = Math.max(0, Math.min(width - 1, x + dx));
      const yy = Math.max(0, Math.min(height - 1, y + dy));
      const value = confidence[yy * width + xx];
      background = Math.min(background, Number.isFinite(value) ? value : 0);
    }
    pixels.set([255, 255, 255, Math.round(Math.max(0, Math.min(1, (background - 0.75) / 0.2)) * 255)], i * 4);
  }
  const bounds: PersonBounds | null = right < left ? null : {
    x: (left + right + 1) / (2 * width), y: (top + bottom + 1) / (2 * height),
    width: (right - left + 1) / width, height: (bottom - top + 1) / height,
  };
  return { pixels, bounds };
}

// Without a saved scene, remove the person by alpha-masking the live camera.
// Saved-background rendering is handled separately by the page.
export class PersonCutout {
  private modelMask = document.createElement("canvas");
  private modelContext = this.modelMask.getContext("2d")!;
  private cameraMask = document.createElement("canvas");
  private cameraContext = this.cameraMask.getContext("2d")!;
  private sample = document.createElement("canvas");
  private sampleContext = this.sample.getContext("2d", { willReadFrequently: true })!;
  private maskImage = "";
  bounds: PersonBounds | null = null;
  brightness = 1;

  update(confidence: Float32Array, width: number, height: number, video: HTMLVideoElement) {
    const result = backgroundMask(confidence, width, height);
    this.bounds = result.bounds;
    // Do not mask uncertain room details outside the detected person region.
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const b = result.bounds;
      if (!b || Math.abs((x + 0.5) / width - b.x) > b.width / 2 + 2 / width ||
          Math.abs((y + 0.5) / height - b.y) > b.height / 2 + 2 / height) {
        result.pixels[(y * width + x) * 4 + 3] = 255;
      }
    }
    this.modelMask.width = width;
    this.modelMask.height = height;
    this.modelContext.putImageData(new ImageData(result.pixels, width, height), 0, 0);
    // CSS mask-size:contain must use the camera aspect ratio, not the model's
    // square output, or the cutout drifts in portrait/landscape letterboxing.
    this.cameraMask.width = 320;
    this.cameraMask.height = Math.max(1, Math.round(320 * video.videoHeight / video.videoWidth));
    this.cameraContext.drawImage(this.modelMask, 0, 0, this.cameraMask.width, this.cameraMask.height);
    this.maskImage = "";

    this.sample.width = 24;
    this.sample.height = 16;
    this.sampleContext.drawImage(video, 0, 0, 24, 16);
    const colors = this.sampleContext.getImageData(0, 0, 24, 16).data;
    let light = 0, count = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) {
      const maskIndex = Math.floor(y * height / 16) * width + Math.floor(x * width / 24);
      if (confidence[maskIndex] < 0.95) continue;
      const i = (y * 24 + x) * 4;
      light += colors[i] * 0.2126 + colors[i + 1] * 0.7152 + colors[i + 2] * 0.0722;
      count++;
    }
    if (count) this.brightness = Math.max(0.6, Math.min(1.2, 0.55 + light / count / 255));
  }

  applyTo(video: HTMLVideoElement) {
    this.maskImage ||= `url("${this.cameraMask.toDataURL("image/png")}")`;
    video.style.maskImage = this.maskImage;
    video.style.setProperty("-webkit-mask-image", this.maskImage);
  }

  static clear(video: HTMLVideoElement) {
    video.style.removeProperty("mask-image");
    video.style.removeProperty("-webkit-mask-image");
  }
}
