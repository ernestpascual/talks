export interface DmapConfig {
  wave: {
    targetWaves: number;
    maxHands: number;
    minHandDetectionConfidence: number;
    minHandPresenceConfidence: number;
    minTrackingConfidence: number;
    minHandSizeRatio: number;
    minFingertipsAboveWrist: number;
    minHandAspectRatio: number;
    maxHandAspectRatio: number;
    minWristRelativeY: number;
    minFingertipSpreadRatio: number;
    handBoxPaddingRatio: number;
    minStrokeDistance: number;
    minReversalDistance: number;
    minStrokeDurationMs: number;
    maxStrokeDurationMs: number;
    minWaveGapMs: number;
    minInitialDelta: number;
    smoothingFactor: number;
    handLostTimeoutMs: number;
    opticalPixelDifference: number;
    opticalMotionFraction: number;
    opticalMinimumPixels: number;
    handOnlyCounting: number;
    simulationEnabled: number;
  };
  handshake: {
    targetShakes: number;
    shakeThreshold: number;
    debounceMs: number;
    rotationDivisor: number;
    jerkMultiplier: number;
  };
  holdTap: {
    holdDurationMs: number;
    tickIntervalMs: number;
    minimumPressure: number;
  };
}

export const DEFAULT_DMAP_CONFIG: DmapConfig = {
  wave: {
    targetWaves: 5,
    maxHands: 1,
    minHandDetectionConfidence: 0.75,
    minHandPresenceConfidence: 0.75,
    minTrackingConfidence: 0.65,
    minHandSizeRatio: 0.06,
    minFingertipsAboveWrist: 3,
    minHandAspectRatio: 0.35,
    maxHandAspectRatio: 2.5,
    minWristRelativeY: 0.35,
    minFingertipSpreadRatio: 0.25,
    handBoxPaddingRatio: 0.15,
    minStrokeDistance: 0.025,
    minReversalDistance: 0.018,
    minStrokeDurationMs: 60,
    maxStrokeDurationMs: 2000,
    minWaveGapMs: 180,
    minInitialDelta: 0.012,
    smoothingFactor: 0.7,
    handLostTimeoutMs: 350,
    opticalPixelDifference: 28,
    opticalMotionFraction: 0.025,
    opticalMinimumPixels: 15,
    handOnlyCounting: 1,
    simulationEnabled: 0,
  },
  handshake: {
    targetShakes: 5,
    shakeThreshold: 2.8,
    debounceMs: 220,
    rotationDivisor: 30,
    jerkMultiplier: 1.5,
  },
  holdTap: {
    holdDurationMs: 5000,
    tickIntervalMs: 50,
    minimumPressure: 0,
  },
};

export function mergeDmapConfig(value: Partial<DmapConfig> | null | undefined): DmapConfig {
  return {
    wave: { ...DEFAULT_DMAP_CONFIG.wave, ...value?.wave },
    handshake: { ...DEFAULT_DMAP_CONFIG.handshake, ...value?.handshake },
    holdTap: { ...DEFAULT_DMAP_CONFIG.holdTap, ...value?.holdTap },
  };
}
