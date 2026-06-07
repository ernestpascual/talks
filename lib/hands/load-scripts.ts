import { loadScript } from "../mediapipe/load-script";

const HANDS =
  "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
const CAMERA_UTILS =
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

export async function loadMediaPipeHandsScripts(): Promise<void> {
  await loadScript(HANDS);
  await loadScript(CAMERA_UTILS);

  if (!window.Hands || !window.Camera) {
    throw new Error("MediaPipe Hands scripts did not initialize.");
  }
}
