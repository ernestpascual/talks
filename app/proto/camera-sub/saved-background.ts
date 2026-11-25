export const BACKGROUND_STORAGE_KEY = "camera-sub:background:v1";

type BackgroundRecord = {
  version: 1;
  dataUrl: string;
  width: number;
  height: number;
  savedAt: number;
};

export type SavedBackground = { image: HTMLImageElement; record: BackgroundRecord };

async function decodeBackground(record: BackgroundRecord): Promise<SavedBackground> {
  const image = new Image();
  image.src = record.dataUrl;
  await image.decode();
  return { image, record };
}

export async function loadSavedBackground(): Promise<SavedBackground | null> {
  const value = localStorage.getItem(BACKGROUND_STORAGE_KEY);
  if (!value) return null;
  const record: BackgroundRecord = JSON.parse(value);
  if (record.version !== 1 || typeof record.dataUrl !== "string" ||
      !record.dataUrl.startsWith("data:image/jpeg;base64,") ||
      !Number.isFinite(record.width) || record.width <= 0 ||
      !Number.isFinite(record.height) || record.height <= 0) return null;
  return decodeBackground(record);
}

export async function saveCameraBackground(video: HTMLVideoElement, isCurrent = () => true): Promise<SavedBackground> {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) throw new Error("Camera is not ready to capture.");
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Background capture is unavailable.");
  // Capture original camera pixels; CSS masking and mirroring affect display only.
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const record: BackgroundRecord = {
    version: 1, dataUrl: canvas.toDataURL("image/jpeg", 0.88),
    width: canvas.width, height: canvas.height, savedAt: Date.now(),
  };
  const background = await decodeBackground(record);
  if (!isCurrent()) throw new DOMException("Capture cancelled.", "AbortError");
  // A failed write leaves the previous stored image and active scene intact.
  localStorage.setItem(BACKGROUND_STORAGE_KEY, JSON.stringify(record));
  return background;
}

export function deleteSavedBackground() {
  localStorage.removeItem(BACKGROUND_STORAGE_KEY);
}

export function drawSavedBackground(context: CanvasRenderingContext2D, image: HTMLImageElement) {
  const { width, height } = context.canvas;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawnWidth = image.naturalWidth * scale, drawnHeight = image.naturalHeight * scale;
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
  context.restore();
}
