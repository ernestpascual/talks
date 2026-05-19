import { loadScript } from "../mediapipe/load-script";

const FACE_MESH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
const CAMERA_UTILS =
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";

export async function loadMediaPipeFaceMeshScripts(): Promise<void> {
  await loadScript(FACE_MESH);
  await loadScript(CAMERA_UTILS);

  if (!window.FaceMesh || !window.Camera) {
    throw new Error("MediaPipe Face Mesh scripts did not initialize.");
  }
}
