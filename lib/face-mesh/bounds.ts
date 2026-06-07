import type { FaceLandmark } from "./types";

export type FaceBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Normalized bounding box around face landmarks with padding. */
export function boundsFromLandmarks(landmarks: FaceLandmark[]): FaceBounds {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;

  for (const lm of landmarks) {
    minX = Math.min(minX, lm.x);
    minY = Math.min(minY, lm.y);
    maxX = Math.max(maxX, lm.x);
    maxY = Math.max(maxY, lm.y);
  }

  const padX = (maxX - minX) * 0.14;
  const padY = (maxY - minY) * 0.18;

  return {
    minX: Math.max(0, minX - padX),
    minY: Math.max(0, minY - padY),
    maxX: Math.min(1, maxX + padX),
    maxY: Math.min(1, maxY + padY),
  };
}

/** Map normalized bounds to screen box (mirrors x like the video). */
export function faceBoundsToScreenStyle(bounds: FaceBounds): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${(1 - bounds.maxX) * 100}%`,
    top: `${bounds.minY * 100}%`,
    width: `${(bounds.maxX - bounds.minX) * 100}%`,
    height: `${(bounds.maxY - bounds.minY) * 100}%`,
  };
}
