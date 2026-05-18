"use client";

import { useEffect, useRef, useState } from "react";
import { loadMediaPipeFaceMeshScripts } from "./load-scripts";
import type { FaceLandmark, FaceMeshInstance } from "./types";
import type { TrackingStatus } from "@/app/talks/raw-school-2026/components/tracking-status";

export type GazePoint = { x: number; y: number };

const LEFT_EYE = 33;
const RIGHT_EYE = 263;
const SMOOTHING = 0.22;

function lerp(current: number, target: number, alpha: number) {
  return current + (target - current) * alpha;
}

function landmarkToScreen(lm: FaceLandmark): GazePoint {
  return {
    x: (1 - lm.x) * window.innerWidth,
    y: lm.y * window.innerHeight,
  };
}

function gazeFromLandmarks(landmarks: FaceLandmark[]): GazePoint | null {
  const left = landmarks[LEFT_EYE];
  const right = landmarks[RIGHT_EYE];
  if (!left || !right) return null;

  return landmarkToScreen({
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  });
}

type UseFaceMeshTrackingOptions = {
  enabled?: boolean;
  onStatusChange?: (status: TrackingStatus) => void;
  onError?: (message: string) => void;
};

export function useFaceMeshTracking({
  enabled = true,
  onStatusChange,
  onError,
}: UseFaceMeshTrackingOptions = {}) {
  const [gaze, setGaze] = useState<GazePoint | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<TrackingStatus>("loading-model");

  const gazeRef = useRef<GazePoint | null>(null);
  const landmarksRef = useRef<FaceLandmark[] | null>(null);
  const isTrackingRef = useRef(false);

  const setTrackingStatus = (next: TrackingStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let camera: { start: () => Promise<void>; stop?: () => void } | null = null;
    let faceMesh: FaceMeshInstance | null = null;
    let videoEl: HTMLVideoElement | null = null;

    async function start() {
      setTrackingStatus("loading-model");
      gazeRef.current = null;
      landmarksRef.current = null;
      isTrackingRef.current = false;
      setGaze(null);
      setVideo(null);

      try {
        await loadMediaPipeFaceMeshScripts();
        if (!active) return;

        const FaceMesh = window.FaceMesh!;
        const Camera = window.Camera!;

        videoEl = document.createElement("video");
        videoEl.setAttribute("playsinline", "true");
        videoEl.muted = true;
        videoEl.autoplay = true;
        videoEl.style.cssText =
          "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
        document.body.appendChild(videoEl);

        faceMesh = new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((res) => {
          landmarksRef.current = res.multiFaceLandmarks?.[0] ?? null;

          if (landmarksRef.current && !isTrackingRef.current) {
            isTrackingRef.current = true;
            setTrackingStatus("tracking");
          }
        });

        setTrackingStatus("loading-camera");

        camera = new Camera(videoEl, {
          onFrame: async () => {
            if (!active || !faceMesh || !videoEl) return;
            await faceMesh.send({ image: videoEl });
          },
          width: 1280,
          height: 720,
        });

        await camera.start();
        if (!active) return;

        setVideo(videoEl);
        setTrackingStatus("camera-ready");

        const tick = () => {
          if (!active) return;

          const landmarks = landmarksRef.current;
          if (landmarks) {
            const target = gazeFromLandmarks(landmarks);
            if (target) {
              const prev = gazeRef.current;
              const smoothed = prev
                ? {
                    x: lerp(prev.x, target.x, SMOOTHING),
                    y: lerp(prev.y, target.y, SMOOTHING),
                  }
                : target;
              gazeRef.current = smoothed;
              setGaze(smoothed);
            }
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error
            ? err.message
            : "Could not start face tracking.";
        onError?.(message);
        setTrackingStatus("error");
      }
    }

    start();

    return () => {
      active = false;
      camera?.stop?.();
      faceMesh?.close?.();
      videoEl?.remove();
      videoEl = null;
      camera = null;
      faceMesh = null;
      gazeRef.current = null;
      landmarksRef.current = null;
      isTrackingRef.current = false;
      setVideo(null);
      setGaze(null);
    };
  }, [enabled, onError]);

  return { gaze, video, status };
}
