"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { loadMediaPipeHandsScripts } from "./load-scripts";
import type { HandsInstance } from "./types";

/** Index fingertip — used for slash point. */
export const INDEX_TIP = 8;
/** Index finger DIP — used for sword orientation. */
export const INDEX_DIP = 7;

export const MAX_TRACKED_HANDS = 2;

export type HandPoint = { x: number; y: number };

export type SwordPose = { tip: HandPoint; dip: HandPoint };

export type HandSlot = {
  indexTip: HandPoint | null;
  indexDip: HandPoint | null;
  middleMcp?: HandPoint | null;
  ringMcp?: HandPoint | null;
  wrist?: HandPoint | null;
};

function emptySlot(): HandSlot {
  return {
    indexTip: null,
    indexDip: null,
    middleMcp: null,
    ringMcp: null,
    wrist: null,
  };
}

type UseHandsTrackingOptions = {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
  maxHands?: number;
  onError?: (message: string) => void;
};

export function useHandsTracking({
  videoRef,
  enabled = true,
  maxHands = MAX_TRACKED_HANDS,
  onError,
}: UseHandsTrackingOptions) {
  const [handCount, setHandCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const slotsRef = useRef<HandSlot[]>(
    Array.from({ length: MAX_TRACKED_HANDS }, emptySlot),
  );

  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  const bindVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      setVideoElement(node);
    },
    [videoRef],
  );

  const resetSlots = useCallback(() => {
    slotsRef.current = Array.from({ length: MAX_TRACKED_HANDS }, emptySlot);
  }, []);

  useEffect(() => {
    if (!enabled || !videoElement) return;

    let active = true;
    let camera: { start: () => Promise<void>; stop?: () => void } | null = null;
    let hands: HandsInstance | null = null;
    const videoEl = videoElement;

    async function start() {
      setReady(false);
      setError(null);
      setHandCount(0);
      resetSlots();

      try {
        await loadMediaPipeHandsScripts();
        if (!active || !videoEl) return;

        const Hands = window.Hands!;
        const Camera = window.Camera!;

        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.autoplay = true;

        hands = new Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: maxHands,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results) => {
          const handsList = results.multiHandLandmarks ?? [];
          const count = Math.min(handsList.length, MAX_TRACKED_HANDS);
          setHandCount(count);

          for (let i = 0; i < MAX_TRACKED_HANDS; i++) {
            const slot = slotsRef.current[i]!;
            if (i >= count) {
              slotsRef.current[i] = emptySlot();
              continue;
            }

            const landmarks = handsList[i]!;
            const tip = landmarks[INDEX_TIP];
            const dip = landmarks[INDEX_DIP];
            const wrist = landmarks[0];
            const middleMcp = landmarks[9];
            const ringMcp = landmarks[13];

            if (!tip) {
              slotsRef.current[i] = emptySlot();
              continue;
            }

            const point: HandPoint = { x: tip.x, y: tip.y };
            slot.indexTip = point;
            slot.indexDip = dip ? { x: dip.x, y: dip.y } : slot.indexDip;
            slot.wrist = wrist ? { x: wrist.x, y: wrist.y } : null;
            slot.middleMcp = middleMcp ? { x: middleMcp.x, y: middleMcp.y } : null;
            slot.ringMcp = ringMcp ? { x: ringMcp.x, y: ringMcp.y } : null;
            slotsRef.current[i] = slot;
          }
        });

        camera = new Camera(videoEl, {
          onFrame: async () => {
            if (!active || !hands) return;
            await hands.send({ image: videoEl });
          },
          width: 1280,
          height: 720,
        });

        await camera.start();
        if (!active) return;
        setReady(true);
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : "Could not start hand tracking.";
        setError(message);
        onErrorRef.current?.(message);
      }
    }

    start();

    return () => {
      active = false;
      camera?.stop?.();
      hands?.close?.();

      // Release the camera stream tracks explicitly to prevent lock conflict on next slide mounts
      if (videoEl && videoEl.srcObject) {
        try {
          const stream = videoEl.srcObject as MediaStream;
          const tracks = stream.getTracks ? stream.getTracks() : [];
          tracks.forEach((track) => track.stop());
        } catch (e) {
          console.warn("Failed to stop media stream tracks:", e);
        }
        videoEl.srcObject = null;
      }

      setReady(false);
      setHandCount(0);
      resetSlots();
    };
  }, [enabled, videoElement, maxHands, resetSlots]);

  const getSwordPoses = useCallback((): SwordPose[] => {
    const poses: SwordPose[] = [];
    for (const slot of slotsRef.current) {
      if (slot.indexTip && slot.indexDip) {
        poses.push({ tip: slot.indexTip, dip: slot.indexDip });
      }
    }
    return poses;
  }, []);

  const getHandPoses = useCallback((): HandSlot[] => {
    return slotsRef.current.map((s) => ({ ...s }));
  }, []);

  return {
    bindVideoRef,
    handCount,
    handDetected: handCount > 0,
    ready,
    error,
    getSwordPoses,
    getHandPoses,
  };
}
