/**
 * LIGHTSABER CUSTOM CONFIGURATION
 * Customize the lightsaber's size, reach, glow radiance, and hand position offsets here.
 */

export interface LightsaberConfig {
  /** Global scale factor (e.g. 1.0 = standard, 1.3 = 30% bigger, 0.8 = smaller) */
  scaleMultiplier: number;

  /** Blade energy beam length in pixels */
  bladeLength: number;

  /** Blade energy beam width / thickness in pixels */
  bladeWidth: number;

  /** Metallic hilt length in pixels */
  hiltLength: number;

  /** Metallic hilt thickness in pixels */
  hiltWidth: number;

  /** White-hot pure plasma center core thickness */
  coreWidth: number;

  /** Outer radiant neon bloom blur radius */
  glowBlur: number;

  /** Size of emitter plasma flare ring */
  emitterFlareSize: number;

  /** Hide the middle section of the hilt when fist is clenched so your real webcam hand holds it */
  hideHiltUnderFist: boolean;

  /** Manual X-axis position offset (in pixels) relative to the tracked hand (- moves left, + moves right) */
  handOffsetX: number;

  /** Manual Y-axis position offset (in pixels) relative to the tracked hand (- moves up, + moves down) */
  handOffsetY: number;

  /** Depth offset along the sword's blade axis (- shifts down toward wrist, + shifts up toward blade) */
  gripDepthOffset: number;

  /** Additional rotational angle offset in degrees (- tilts left, + tilts right) */
  angleOffsetDegrees: number;

  /** Automatically scale lightsaber size with camera hand distance */
  autoScaleWithHand: boolean;

  /** Minimum dynamic scale limit */
  minHandScale: number;

  /** Maximum dynamic scale limit */
  maxHandScale: number;
}

export const LIGHTSABER_CONFIG: LightsaberConfig = {
  // --- Sizing Dimensions (Adjust these to resize the lightsaber) ---
  scaleMultiplier: 1.0,
  bladeLength: 420,
  bladeWidth: 32,
  hiltLength: 115,
  hiltWidth: 26,

  // --- Glow & Radiance ---
  coreWidth: 14,
  glowBlur: 55,
  emitterFlareSize: 10,

  // --- Hand & Fist Position Offsets (Adjust X, Y, and Depth here) ---
  handOffsetX: -20,           // e.g. -15 to shift left, +15 to shift right
  handOffsetY: 20,           // e.g. -20 to shift higher, +20 to shift lower
  gripDepthOffset: 0,       // e.g. +25 to push blade further out of fist
  angleOffsetDegrees: 0,    // e.g. -10 to tilt slightly left, +10 to tilt right

  // --- Fist Occlusion & Scaling ---
  hideHiltUnderFist: true,  // Hides the middle grip so your real webcam hand holds the lightsaber!
  autoScaleWithHand: true,
  minHandScale: 1.0,
  maxHandScale: 2.4,
};
