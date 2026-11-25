"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import LiquidEther, {
  type LiquidEtherControlPoint,
} from "@/components/LiquidEther";
import { useHandsTracking } from "@/lib/hands/useHandsTracking";
import slideArtwork from "../img/slide4.png";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const RED_COLORS = ["#ff1f19", "#ff1f19"];
const MULTI_COLORS = ["#ff1f19", "#ff6a3d", "#7a35ff"];

type PaletteMode = "red" | "multi";

function countRaisedLongFingers(landmarks: { x: number; y: number }[]) {
  const wrist = landmarks[0];
  if (!wrist) return 0;

  const distanceFromWrist = (index: number) => {
    const point = landmarks[index];
    if (!point) return 0;
    return Math.hypot(point.x - wrist.x, point.y - wrist.y);
  };

  const fingerJoints = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ] as const;

  return fingerJoints.reduce(
    (count, [tip, middleJoint]) =>
      count +
      (distanceFromWrist(tip) > distanceFromWrist(middleJoint) * 1.12
        ? 1
        : 0),
    0,
  );
}

export default function Slide2LiquidEther() {
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("red");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlPointRef = useRef<LiquidEtherControlPoint>({
    x: 0.5,
    y: 0.5,
    active: false,
  });
  const smoothedPointRef = useRef({ x: 0.5, y: 0.5, initialized: false });
  const paletteModeRef = useRef<PaletteMode>("red");
  const pendingGestureRef = useRef<{
    mode: PaletteMode | null;
    frames: number;
  }>({ mode: null, frames: 0 });

  const { bindVideoRef, handDetected, ready, error, getHandPoses } =
    useHandsTracking({
      videoRef,
      maxHands: 1,
    });

  useEffect(() => {
    let animationFrame = 0;

    const updateControlPoint = () => {
      const hand = getHandPoses()[0];
      const indexTip = hand?.indexTip;
      const controlPoint = controlPointRef.current;
      const smoothedPoint = smoothedPointRef.current;

      if (indexTip) {
        // The selfie camera is mirrored so the fluid follows the presenter's hand.
        const targetX = clamp01(1 - indexTip.x);
        const targetY = clamp01(indexTip.y);

        if (!smoothedPoint.initialized) {
          smoothedPoint.x = targetX;
          smoothedPoint.y = targetY;
          smoothedPoint.initialized = true;
        } else {
          smoothedPoint.x += (targetX - smoothedPoint.x) * 0.3;
          smoothedPoint.y += (targetY - smoothedPoint.y) * 0.3;
        }

        controlPoint.x = smoothedPoint.x;
        controlPoint.y = smoothedPoint.y;
        controlPoint.active = true;

        const raisedLongFingerCount = hand.landmarks
          ? countRaisedLongFingers(hand.landmarks)
          : 0;
        // Use the four long fingers for classification; MediaPipe's thumb pose
        // can wobble when the palm rotates, while the intended gestures remain
        // visually unambiguous.
        const candidateMode: PaletteMode | null =
          raisedLongFingerCount === 4
            ? "multi"
            : raisedLongFingerCount === 1
              ? "red"
              : null;
        const pendingGesture = pendingGestureRef.current;

        if (!candidateMode || candidateMode === paletteModeRef.current) {
          pendingGesture.mode = null;
          pendingGesture.frames = 0;
        } else if (pendingGesture.mode === candidateMode) {
          pendingGesture.frames += 1;
          if (pendingGesture.frames >= 8) {
            paletteModeRef.current = candidateMode;
            setPaletteMode(candidateMode);
            pendingGesture.mode = null;
            pendingGesture.frames = 0;
          }
        } else {
          pendingGesture.mode = candidateMode;
          pendingGesture.frames = 1;
        }
      } else {
        controlPoint.active = false;
        smoothedPoint.initialized = false;
        pendingGestureRef.current.mode = null;
        pendingGestureRef.current.frames = 0;
      }

      animationFrame = requestAnimationFrame(updateControlPoint);
    };

    animationFrame = requestAnimationFrame(updateControlPoint);
    return () => cancelAnimationFrame(animationFrame);
  }, [getHandPoses]);

  const status = error
    ? "Camera unavailable · use the mouse"
    : !ready
      ? "Starting hand tracking…"
      : handDetected
        ? "Hand linked · move to make waves"
        : "Show one hand to the camera";

  return (
    <section className="fixed inset-0 overflow-hidden bg-black">
      <LiquidEther
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
        colors={paletteMode === "multi" ? MULTI_COLORS : RED_COLORS}
        mouseForce={34}
        cursorSize={150}
        resolution={0.45}
        iterationsPoisson={24}
        autoDemo
        autoSpeed={0.35}
        autoIntensity={1.4}
        autoResumeDelay={1200}
        controlPointRef={controlPointRef}
      />

      <Image
        src={slideArtwork}
        alt="Canvas and medium versus substrate"
        fill
        priority
        unoptimized
        sizes="100vw"
        className="pointer-events-none object-contain object-center mix-blend-screen"
      />

      <video
        ref={bindVideoRef}
        className="pointer-events-none fixed h-px w-px opacity-0"
        aria-hidden
      />

      <div
        className="pointer-events-none fixed left-1/2 top-6 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 backdrop-blur-md"
        role="status"
        aria-live="polite"
      >
        <span
          className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${
            handDetected ? "bg-emerald-400" : error ? "bg-red-400" : "bg-white/40"
          }`}
        />
        {status}
        {handDetected ? (
          <span className="ml-2 text-white/45">
            · {paletteMode === "multi" ? "5 fingers: color" : "1 finger: red"}
          </span>
        ) : null}
      </div>
    </section>
  );
}
