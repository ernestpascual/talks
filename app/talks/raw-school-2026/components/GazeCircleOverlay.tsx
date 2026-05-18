"use client";

import type { GazePoint } from "@/lib/face-mesh/useFaceMeshTracking";

const CIRCLE_SIZE = 80;
const RADIUS = CIRCLE_SIZE / 2;

export default function GazeCircleOverlay({ gaze }: { gaze: GazePoint }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-20 rounded-full border-[5px] border-white bg-transparent"
      style={{
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        left: gaze.x - RADIUS,
        top: gaze.y - RADIUS,
      }}
    />
  );
}
