"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { loadMediaPipeFaceMeshScripts } from "./load-scripts";
import { boundsFromLandmarks, type FaceBounds } from "./bounds";
import { smileDiscountFromLandmarks } from "./expressions";
import type { TrackingStatus } from "./tracking-status";
import type { FaceMeshInstance } from "./types";

type UseFaceMeshOptions = {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
  maxNumFaces?: number;
  onStatusChange?: (status: TrackingStatus) => void;
  onError?: (message: string) => void;
};

export function useFaceMesh({
  videoRef,
  enabled = true,
  maxNumFaces = 2,
  onStatusChange,
  onError,
}: UseFaceMeshOptions) {
  const [faceCount, setFaceCount] = useState(0);
  const [faceBounds, setFaceBounds] = useState<FaceBounds | null>(null);
  const [smileDiscount, setSmileDiscount] = useState(0);
  const [status, setStatus] = useState<TrackingStatus>("loading-model");
  const [videoReady, setVideoReady] = useState(false);

  const isTrackingRef = useRef(false);

  const setTrackingStatus = useCallback(
    (next: TrackingStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  const bindVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      setVideoReady(!!node);
    },
    [videoRef],
  );

  useEffect(() => {
    if (!enabled || !videoReady || !videoRef.current) return;

    let active = true;
    let camera: { start: () => Promise<void>; stop?: () => void } | null = null;
    let faceMesh: FaceMeshInstance | null = null;
    const videoEl = videoRef.current;

    isTrackingRef.current = false;

    async function start() {
      setTrackingStatus("loading-model");
      setFaceCount(0);
      setFaceBounds(null);
      setSmileDiscount(0);

      try {
        await loadMediaPipeFaceMeshScripts();
        if (!active || !videoRef.current) return;

        const FaceMesh = window.FaceMesh!;
        const Camera = window.Camera!;

        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.autoplay = true;

        faceMesh = new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((res) => {
          const faces = res.multiFaceLandmarks ?? [];
          const count = faces.length;
          setFaceCount(count);

          if (count === 1) {
            setFaceBounds(boundsFromLandmarks(faces[0]!));
            setSmileDiscount(smileDiscountFromLandmarks(faces[0]!));
            if (!isTrackingRef.current) {
              isTrackingRef.current = true;
              setTrackingStatus("tracking");
            }
          } else {
            setFaceBounds(null);
            setSmileDiscount(0);
          }
        });

        setTrackingStatus("loading-camera");

        camera = new Camera(videoEl, {
          onFrame: async () => {
            if (!active || !faceMesh) return;
            await faceMesh.send({ image: videoEl });
          },
          width: 1280,
          height: 720,
        });

        await camera.start();
        if (!active) return;

        setTrackingStatus("camera-ready");
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
      isTrackingRef.current = false;
      setFaceCount(0);
      setFaceBounds(null);
      setSmileDiscount(0);
    };
  }, [
    enabled,
    videoReady,
    videoRef,
    maxNumFaces,
    onError,
    setTrackingStatus,
  ]);

  return {
    bindVideoRef,
    faceCount,
    faceBounds,
    smileDiscount,
    isSmiling: smileDiscount > 0,
    status,
  };
}
