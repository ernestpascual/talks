import type { LowLightMode } from "./detection";

interface Disposable {
  delete(): void;
}
interface CvMat extends Disposable {
  data: Uint8Array;
}
interface CvMatVector extends Disposable {
  get(index: number): CvMat;
  set(index: number, mat: CvMat): void;
}

interface OpenCv {
  Mat: new (rows?: number, columns?: number, type?: number) => CvMat;
  MatVector: new () => CvMatVector;
  Size: new (width: number, height: number) => object;
  CLAHE: new (
    clipLimit: number,
    size: object,
  ) => Disposable & { apply(source: CvMat, destination: CvMat): void };
  CV_8UC1: number;
  COLOR_RGBA2RGB: number;
  COLOR_RGB2YCrCb: number;
  COLOR_YCrCb2RGB: number;
  imread(canvas: HTMLCanvasElement): CvMat;
  imshow(canvas: HTMLCanvasElement, mat: CvMat): void;
  cvtColor(source: CvMat, destination: CvMat, conversion: number): void;
  split(source: CvMat, channels: CvMatVector): void;
  merge(channels: CvMatVector, destination: CvMat): void;
  mean(source: CvMat): number[];
  addWeighted(
    a: CvMat,
    alpha: number,
    b: CvMat,
    beta: number,
    gamma: number,
    destination: CvMat,
  ): void;
  LUT(source: CvMat, lookup: CvMat, destination: CvMat): void;
}

export interface PersonDetector {
  detect(
    canvas: HTMLCanvasElement,
    maxNumBoxes: number,
    minScore: number,
  ): Promise<
    Array<{
      bbox: [number, number, number, number];
      class: string;
      score: number;
    }>
  >;
  dispose(): void;
}

interface VisionWindow extends Window {
  cv?: OpenCv | Promise<OpenCv>;
  tf?: { ready(): Promise<void>; setBackend(name: string): Promise<boolean> };
  cocoSsd?: { load(config: { base: "mobilenet_v2" }): Promise<PersonDetector> };
}

const scriptLoads = new Map<string, Promise<void>>();

function withDeadline<T>(
  promise: Promise<T>,
  onLateResult?: (result: T) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timeout = window.setTimeout(() => {
      expired = true;
      reject(
        new Error(
          "The vision download timed out. Check your connection and try again.",
        ),
      );
    }, 90_000);
    promise.then(
      (result) => {
        window.clearTimeout(timeout);
        if (expired) onLateResult?.(result);
        else resolve(result);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function loadScript(source: string): Promise<void> {
  const existing = scriptLoads.get(source);
  if (existing) return existing;
  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => fail(), 60_000);
    function fail() {
      window.clearTimeout(timeout);
      script.remove();
      reject(
        new Error(
          "Vision download failed. Check your internet connection and try again.",
        ),
      );
    }
    script.async = true;
    script.src = source;
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  scriptLoads.set(source, loading);
  void loading.catch(() => scriptLoads.delete(source));
  return loading;
}

async function loadOpenCv(): Promise<{ cv: OpenCv }> {
  const visionWindow = window as VisionWindow;
  await loadScript("https://docs.opencv.org/4.12.0/opencv.js");
  const startedAt = performance.now();
  // The official build exposes a module before its WebAssembly runtime is ready.
  while (performance.now() - startedAt < 30_000) {
    const cv =
      visionWindow.cv instanceof Promise
        ? await visionWindow.cv
        : visionWindow.cv;
    // This build is a self-resolving Emscripten thenable. Returning it directly
    // from an async function creates an endless promise-assimilation loop.
    if (cv?.Mat) return { cv };
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  throw new Error("OpenCV could not start. Reload the page and try again.");
}

export async function loadVision(onProgress: (message: string) => void) {
  onProgress("Loading OpenCV and the person detector…");
  const cvPromise = withDeadline(loadOpenCv());
  const detectorPromise = withDeadline(
    (async () => {
      const visionWindow = window as VisionWindow;
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
      );
      if (!visionWindow.tf)
        throw new Error("The detection runtime is unavailable.");
      try {
        if (!(await visionWindow.tf.setBackend("webgl")))
          await visionWindow.tf.setBackend("cpu");
      } catch {
        await visionWindow.tf.setBackend("cpu");
      }
      await visionWindow.tf.ready();
      await loadScript(
        "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js",
      );
      if (!visionWindow.cocoSsd)
        throw new Error("The person detector is unavailable.");
      return visionWindow.cocoSsd.load({ base: "mobilenet_v2" });
    })(),
    (detector) => detector.dispose(),
  );
  // Wait for both outcomes so a model that finishes after an OpenCV error is released.
  const [cvResult, detectorResult] = await Promise.allSettled([
    cvPromise,
    detectorPromise,
  ]);
  if (cvResult.status === "rejected" || detectorResult.status === "rejected") {
    if (detectorResult.status === "fulfilled") detectorResult.value.dispose();
    throw new Error(
      "Could not load vision tools. Check your internet connection, then try again.",
    );
  }
  return { cv: cvResult.value.cv, detector: detectorResult.value };
}

// Enhance the actual inference image, preserving chroma and limiting amplified noise.
export function enhanceFrame(
  cv: OpenCv,
  canvas: HTMLCanvasElement,
  mode: LowLightMode,
  gain: number,
) {
  const allocated: Disposable[] = [];
  function keep<T extends Disposable>(resource: T): T {
    allocated.push(resource);
    return resource;
  }
  try {
    const source = keep(cv.imread(canvas));
    const rgb = keep(new cv.Mat());
    const yCrCb = keep(new cv.Mat());
    const channels = keep(new cv.MatVector());
    cv.cvtColor(source, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb, yCrCb, cv.COLOR_RGB2YCrCb);
    cv.split(yCrCb, channels);
    const luminance = keep(channels.get(0));
    const brightness = cv.mean(luminance)[0];
    const enhanced = mode === "on" || (mode === "auto" && brightness < 100);
    let previewGain = 1;
    if (enhanced) {
      const contrast = keep(new cv.Mat());
      const mixed = keep(new cv.Mat());
      const lookup = keep(new cv.Mat(1, 256, cv.CV_8UC1));
      const clahe = keep(new cv.CLAHE(2, new cv.Size(8, 8)));
      clahe.apply(luminance, contrast);
      cv.addWeighted(luminance, 0.55, contrast, 0.45, 0, mixed);
      const gamma = Math.max(0.35, 1 - gain * 0.18);
      for (let i = 0; i < 256; i++)
        lookup.data[i] = Math.round(255 * Math.pow(i / 255, gamma));
      cv.LUT(mixed, lookup, luminance);
      channels.set(0, luminance);
      cv.merge(channels, yCrCb);
      cv.cvtColor(yCrCb, rgb, cv.COLOR_YCrCb2RGB);
      cv.imshow(canvas, rgb);
      previewGain = Math.min(3.5, 1 + (1 - brightness / 255) * gain * 0.7);
    }
    return { brightness, enhanced, previewGain };
  } finally {
    for (const resource of allocated.reverse()) resource.delete();
  }
}
