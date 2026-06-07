import {
  SMILE_SENSITIVITY,
  SMILE_TIER_DISCOUNTS,
} from "./smile-config";
import type { FaceLandmark } from "./types";

/** Mouth corners lifted relative to lip center, normalized by mouth width. */
const LEFT_CORNER = 61;
const RIGHT_CORNER = 291;
const UPPER_LIP = 13;
const LOWER_LIP = 14;

export { SMILE_SENSITIVITY, SMILE_TIER_DISCOUNTS } from "./smile-config";

/** @deprecated Use SMILE_TIER_DISCOUNTS from smile-config.ts */
export const SMILE_DISCOUNTS = SMILE_TIER_DISCOUNTS;

export function smileRatioFromLandmarks(
  landmarks: FaceLandmark[],
): number | null {
  const left = landmarks[LEFT_CORNER];
  const right = landmarks[RIGHT_CORNER];
  const upper = landmarks[UPPER_LIP];
  const lower = landmarks[LOWER_LIP];
  if (!left || !right || !upper || !lower) return null;

  const mouthCenterY = (upper.y + lower.y) / 2;
  const cornerY = (left.y + right.y) / 2;
  const mouthWidth = Math.hypot(right.x - left.x, right.y - left.y);
  if (mouthWidth < 1e-6) return null;

  return (mouthCenterY - cornerY) / mouthWidth;
}

/** 0 = not smiling; otherwise Php discount per tick from SMILE_TIER_DISCOUNTS. */
export function smileDiscountFromLandmarks(landmarks: FaceLandmark[]): number {
  const ratio = smileRatioFromLandmarks(landmarks);
  if (ratio === null || ratio < SMILE_SENSITIVITY.minRatio) return 0;

  const { tierThresholds } = SMILE_SENSITIVITY;
  for (let i = tierThresholds.length - 1; i >= 0; i--) {
    if (ratio >= tierThresholds[i]!) {
      return SMILE_TIER_DISCOUNTS[i] ?? 0;
    }
  }
  return 0;
}

export function isSmilingFromLandmarks(landmarks: FaceLandmark[]): boolean {
  return smileDiscountFromLandmarks(landmarks) > 0;
}
