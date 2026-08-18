export interface Vector2D {
  x: number;
  y: number;
}

export type DeviceCategory =
  | "phone"
  | "laptop"
  | "audio"
  | "headset"
  | "beacon"
  | "smarthome"
  | "tracker"
  | "watch"
  | "unknown";

export interface BleDeviceRaw {
  id: string;
  name: string;
  rssi: number;
  txPower?: number;
  timestamp: number;
  uuids?: string[];
  isRealBle?: boolean;
}

export interface RadarDevice {
  id: string;
  name: string;
  codename: string;
  category: DeviceCategory;
  rssi: number; // Raw current RSSI in dBm (e.g. -60)
  smoothedRssi: number; // Kalman/EMA filtered RSSI
  txPower: number; // Calibrated 1m TxPower (default -59 dBm)
  distance: number; // Estimated distance in meters
  smoothedDistance: number; // Filtered distance in meters
  angle: number; // Bearing in degrees (0 - 360, 0 = North / Top)
  targetAngle: number; // Target bearing for smooth interpolation
  normalizedRadius: number; // 0.0 (center) to 1.0 (outer radar ring)
  velocity: Vector2D; // Tail vector indicating drift direction/speed
  trail: Vector2D[]; // Short trajectory history for radar tails
  lastSeen: number; // Timestamp
  pingGlow: number; // 0.0 to 1.0 glow decay after radar sweep hits it
  isRealBle: boolean;
  color: string;
  role?: string; // e.g. "Creative Director", "Art Director", "Tech Lead"
  battery?: number; // Estimated / advertised battery level
  history: { time: number; rssi: number; distance: number }[];
}

export interface PolarRssiSample {
  bearing: number; // Device heading when sample was taken (0-360)
  rssi: number;
  timestamp: number;
}

export interface DeviceDirectionTracker {
  deviceId: string;
  samples: PolarRssiSample[];
  estimatedAoA: number; // Angle of arrival (0-360 deg)
  confidence: number; // 0.0 to 1.0
}

export interface RadarStats {
  deviceCount: number;
  nearestDevice: RadarDevice | null;
  avgSignal: number;
  scanMode: "real-ble" | "simulation" | "hybrid";
  compassHeading: number | null; // Magnetic or true heading if available
}
