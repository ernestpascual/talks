/**
 * Slide 6 smile pricing — tune detection and tiers here.
 *
 * `smileRatio` = how much the mouth corners lift vs lip center (normalized by mouth width).
 * Higher ratio = bigger smile. Lower thresholds = easier to reach that tier.
 */

/** Php removed per second at each tier (must match tierThresholds length). */
export const SMILE_TIER_DISCOUNTS = [0.5, 1, 1.5, 2] as const;

export const SMILE_SENSITIVITY = {
  /**
   * Minimum ratio to count as smiling at all.
   * Lower = easier (e.g. 0.03). Higher = need a clearer smile (e.g. 0.06).
   */
  minRatio: 0.04,

  /**
   * Ratio required for each discount tier — same order as SMILE_TIER_DISCOUNTS.
   * Must be ascending. Raise later values to make big tiers harder.
   *
   * Defaults: small −0.50 | medium −1 | large −1.50 | big grin −2
   */
  tierThresholds: [0.6, 0.12, 0.16, 0.2],
} as const;
