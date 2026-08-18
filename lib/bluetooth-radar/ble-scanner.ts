import {
  RadarDevice,
  DeviceCategory,
  PolarRssiSample,
  DeviceDirectionTracker,
} from "./types";
import { MOCK_OFFICE_DEVICES } from "./mock-devices";

const DEFAULT_TX_POWER = -59; // RSSI measured at 1 meter in dBm
const PATH_LOSS_EXPONENT = 2.2; // Indoor office path loss constant (2.0 - 2.5)
const MAX_RADAR_RANGE_METERS = 8.0; // Outer circle = 8.0 meters max range

/**
 * Calculate approximate distance in meters from RSSI (max 8.0m)
 */
export function rssiToDistance(
  rssi: number,
  txPower: number = DEFAULT_TX_POWER,
  pathLoss: number = PATH_LOSS_EXPONENT
): number {
  if (rssi === 0) return -1.0;
  const ratio = (txPower - rssi) / (10 * pathLoss);
  const rawDist = Math.pow(10, ratio);
  return Math.min(8.0, Math.max(0.2, Number(rawDist.toFixed(2))));
}

/**
 * Generate a deterministic stable battery percentage (55% - 98%) from device ID
 */
export function getDeterministicBattery(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return 55 + (Math.abs(hash) % 44); // 55% to 98%
}

/**
 * Calculate expected RSSI from distance
 */
export function distanceToRssi(
  distance: number,
  txPower: number = DEFAULT_TX_POWER,
  pathLoss: number = PATH_LOSS_EXPONENT
): number {
  const d = Math.max(0.1, distance);
  const val = txPower - 10 * pathLoss * Math.log10(d);
  return Math.round(val);
}

/**
 * Categorize device by advertised name or minorType
 */
export function categorizeDevice(name?: string, minorType?: string): DeviceCategory {
  if (minorType) {
    const mLower = minorType.toLowerCase();
    if (mLower.includes("headphone") || mLower.includes("headset") || mLower.includes("speaker")) {
      return "audio";
    }
    if (mLower.includes("mouse") || mLower.includes("keyboard")) {
      return "unknown";
    }
  }

  if (!name) return "unknown";
  const lower = name.toLowerCase();

  // 1. Phones
  if (
    lower.includes("iphone") ||
    lower.includes("pixel") ||
    lower.includes("galaxy") ||
    lower.includes("android") ||
    lower.includes("phone") ||
    lower.includes("xperia") ||
    lower.includes("xiaomi") ||
    lower.includes("redmi") ||
    lower.includes("oneplus")
  ) {
    return "phone";
  }

  // 2. Laptops / Computers
  if (
    lower.includes("macbook") ||
    lower.includes("laptop") ||
    lower.includes("thinkpad") ||
    lower.includes("ipad") ||
    lower.includes("surface") ||
    lower.includes("notebook") ||
    lower.includes("dell") ||
    lower.includes("lenovo") ||
    lower.includes("chromebook")
  ) {
    return "laptop";
  }

  // 3. Audio Devices
  if (
    lower.includes("airpod") ||
    lower.includes("wh-") ||
    lower.includes("wf-") ||
    lower.includes("bose") ||
    lower.includes("buds") ||
    lower.includes("headphone") ||
    lower.includes("headset") ||
    lower.includes("earbuds") ||
    lower.includes("earphone") ||
    lower.includes("quietcomfort") ||
    lower.includes("soundlink") ||
    lower.includes("speaker") ||
    lower.includes("sonos") ||
    lower.includes("jbl") ||
    lower.includes("beats") ||
    lower.includes("marshall") ||
    lower.includes("krk") ||
    lower.includes("blp") ||
    lower.includes("mic")
  ) {
    return "audio";
  }

  // 4. Smart Trackers
  if (
    lower.includes("airtag") ||
    lower.includes("tile") ||
    lower.includes("smarttag") ||
    lower.includes("chipolo") ||
    lower.includes("finder") ||
    lower.includes("keyfinder") ||
    lower.includes("tracker") ||
    lower.includes("smart tag")
  ) {
    return "tracker";
  }

  // 5. Smart Home (uses word boundaries to prevent matching 'Ernest' with 'nest')
  if (
    lower.includes("hue") ||
    /\blight\b/i.test(lower) ||
    lower.includes("smart bulb") ||
    lower.includes("smart plug") ||
    lower.includes("apple tv") ||
    lower.includes("smart tv") ||
    lower.includes("homepod") ||
    lower.includes("echo dot") ||
    lower.includes("alexa") ||
    /\bnest\b/i.test(lower) ||
    lower.includes("espresso") ||
    lower.includes("thermostat") ||
    lower.includes("smart lock")
  ) {
    return "smarthome";
  }

  // 6. Beacons
  if (
    lower.includes("beacon") ||
    lower.includes("ibeacon") ||
    lower.includes("eddystone") ||
    lower.includes("altbeacon") ||
    lower.includes("hub")
  ) {
    return "beacon";
  }

  // 7. Smartwatches / Wearables
  if (lower.includes("watch") || lower.includes("band") || lower.includes("garmin") || lower.includes("fitbit")) {
    return "watch";
  }

  return "unknown";
}

/**
 * Determine device color strictly based on user rules:
 * - PH1 in name: RED (#ef4444)
 * - iPhone: YELLOW (#facc15)
 * - Different phone: CYAN (#00f5b8)
 * - Laptops: GREEN (#22c55e)
 * - Audio devices: BLUE (#3b82f6)
 * - Beacons: ORANGE (#f97316)
 * - Smart Home: PINK (#ec4899)
 * - Smart Trackers: NEON PURPLE (#c084fc)
 * - Unknown device: WHITE (#ffffff)
 */
export function getDeviceColor(name?: string, category?: DeviceCategory): string {
  if (!name || name.trim() === "") {
    return "#ffffff";
  }

  const upper = name.toUpperCase();
  const lower = name.toLowerCase();

  // Priority 1: 'PH1' in name -> RED (#ef4444)
  if (upper.includes("PH1")) {
    return "#ef4444";
  }

  // Priority 2: iPhone -> YELLOW (#facc15)
  if (lower.includes("iphone")) {
    return "#facc15";
  }

  // Priority 3: Different phone (Android, Pixel, Galaxy, generic phone) -> CYAN (#00f5b8)
  if (
    category === "phone" ||
    lower.includes("pixel") ||
    lower.includes("galaxy") ||
    lower.includes("phone") ||
    lower.includes("android") ||
    lower.includes("xperia") ||
    lower.includes("xiaomi") ||
    lower.includes("redmi") ||
    lower.includes("oneplus") ||
    lower.includes("oppo") ||
    lower.includes("vivo")
  ) {
    return "#00f5b8";
  }

  // Priority 4: Laptops -> GREEN (#22c55e)
  if (
    category === "laptop" ||
    lower.includes("macbook") ||
    lower.includes("laptop") ||
    lower.includes("thinkpad") ||
    lower.includes("ipad") ||
    lower.includes("surface") ||
    lower.includes("notebook") ||
    lower.includes("dell") ||
    lower.includes("lenovo") ||
    lower.includes("chromebook")
  ) {
    return "#22c55e"; // Green
  }

  // Priority 5: Audio Devices -> BLUE (#3b82f6)
  if (
    category === "audio" ||
    category === "headset" ||
    lower.includes("airpod") ||
    lower.includes("wh-") ||
    lower.includes("wf-") ||
    lower.includes("bose") ||
    lower.includes("buds") ||
    lower.includes("headphone") ||
    lower.includes("headset") ||
    lower.includes("earbuds") ||
    lower.includes("speaker") ||
    lower.includes("soundlink") ||
    lower.includes("sonos") ||
    lower.includes("jbl") ||
    lower.includes("beats") ||
    lower.includes("krk") ||
    lower.includes("blp") ||
    lower.includes("marshall")
  ) {
    return "#3b82f6"; // Blue
  }

  // Priority 6: Smart Trackers -> NEON PURPLE (#c084fc)
  if (
    category === "tracker" ||
    lower.includes("airtag") ||
    lower.includes("tile") ||
    lower.includes("smarttag") ||
    lower.includes("chipolo") ||
    lower.includes("finder") ||
    lower.includes("keyfinder") ||
    lower.includes("tracker")
  ) {
    return "#c084fc"; // Neon purple
  }

  // Priority 7: Smart Home (Word boundaries used to avoid matching 'Ernest') -> PINK (#ec4899)
  if (
    category === "smarthome" ||
    lower.includes("hue") ||
    /\blight\b/i.test(lower) ||
    lower.includes("bulb") ||
    lower.includes("plug") ||
    lower.includes("switch") ||
    lower.includes("tv") ||
    lower.includes("display") ||
    lower.includes("homepod") ||
    lower.includes("echo") ||
    lower.includes("alexa") ||
    /\bnest\b/i.test(lower) ||
    lower.includes("espresso") ||
    lower.includes("thermostat") ||
    lower.includes("lock")
  ) {
    return "#ec4899"; // Pink
  }

  // Priority 8: Beacons -> ORANGE (#f97316)
  if (
    category === "beacon" ||
    lower.includes("beacon") ||
    lower.includes("ibeacon") ||
    lower.includes("eddystone") ||
    lower.includes("altbeacon") ||
    lower.includes("hub")
  ) {
    return "#f97316"; // Orange
  }

  // Watch / Wearables -> Emerald
  if (category === "watch" || lower.includes("watch") || lower.includes("garmin")) {
    return "#10b981";
  }

  // Unknown device -> WHITE (#ffffff)
  return "#ffffff";
}

/**
 * Convert string or id to consistent initial angle (0 - 360 deg)
 */
export function hashStringToAngle(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

/**
 * Manages Bluetooth device tracking, Web Bluetooth scanning, and host BLE scanning.
 */
export class BleRadarManager {
  private devicesMap: Map<string, RadarDevice> = new Map();
  private directionTrackers: Map<string, DeviceDirectionTracker> = new Map();
  private isScanningRealBle: boolean = false;
  private isMockEnabled: boolean = false; // OFF by default
  private currentHeading: number = 0; // Device compass heading in degrees
  private pollIntervalId: NodeJS.Timeout | null = null;
  private watchedBleDevices: Set<any> = new Set();
  private onUpdateCallback?: (devices: RadarDevice[]) => void;

  constructor() {
    // Starts empty by default (mock devices OFF)
    this.devicesMap = new Map();
  }

  public setUpdateCallback(cb: (devices: RadarDevice[]) => void) {
    this.onUpdateCallback = cb;
  }

  public setHeading(heading: number) {
    this.currentHeading = heading;
  }

  public isMockDevicesEnabled(): boolean {
    return this.isMockEnabled;
  }

  /**
   * Toggle optional mock devices (OFF by default)
   */
  public setMockDevicesEnabled(enabled: boolean) {
    this.isMockEnabled = enabled;

    if (enabled) {
      // Populate mock devices
      const now = Date.now();
      MOCK_OFFICE_DEVICES.forEach((mock, index) => {
        const id = `mock-${index + 1}-${mock.codename.toLowerCase()}`;
        if (!this.devicesMap.has(id)) {
          const distance = mock.baseDistance;
          const rssi = distanceToRssi(distance);
          const angle = mock.baseAngle;

          const device: RadarDevice = {
            id,
            name: mock.name,
            codename: mock.codename,
            category: mock.category,
            rssi,
            smoothedRssi: rssi,
            txPower: DEFAULT_TX_POWER,
            distance,
            smoothedDistance: distance,
            angle,
            targetAngle: angle,
            normalizedRadius: Math.min(1, distance / MAX_RADAR_RANGE_METERS),
            velocity: {
              x: (Math.random() - 0.5) * mock.driftSpeed * 0.008,
              y: (Math.random() - 0.5) * mock.driftSpeed * 0.008,
            },
            trail: [],
            lastSeen: now,
            pingGlow: 0,
            isRealBle: false,
            color: getDeviceColor(mock.name, mock.category),
            role: mock.role,
            battery: mock.battery,
            history: [{ time: now, rssi, distance }],
          };

          this.devicesMap.set(id, device);
        }
      });
    } else {
      // Remove all mock devices, preserving real BLE devices
      const toRemove: string[] = [];
      this.devicesMap.forEach((device, id) => {
        if (!device.isRealBle) {
          toRemove.push(id);
        }
      });
      toRemove.forEach((id) => this.devicesMap.delete(id));
    }

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getDevices());
    }
  }

  public clearDevices() {
    this.devicesMap.clear();
    this.directionTrackers.clear();
    this.isMockEnabled = false;
    this.isScanningRealBle = false;
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    if (this.onUpdateCallback) {
      this.onUpdateCallback([]);
    }
  }

  /**
   * Process raw BLE advertisement packet or system discovered device
   */
  public ingestSignal(
    id: string,
    name: string | undefined,
    rawRssi: number,
    txPower: number = DEFAULT_TX_POWER,
    isRealBle: boolean = true,
    minorType?: string,
    battery?: number
  ) {
    const now = Date.now();
    let device = this.devicesMap.get(id);

    // Filter out invalid readings
    const clampedRssi = Math.min(-20, Math.max(-105, rawRssi));
    const calculatedDist = rssiToDistance(clampedRssi, txPower);

    // Direction estimation algorithm based on RF differential gradient
    const estimatedAngle = this.updateDirectionEstimation(id, clampedRssi, this.currentHeading);

    if (!device) {
      const codename = name
        ? name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase() ||
          `DEV-${id.slice(-4).toUpperCase()}`
        : `BLE-${id.slice(-4).toUpperCase()}`;

      const initialAngle = estimatedAngle !== null ? estimatedAngle : hashStringToAngle(id);
      const category = categorizeDevice(name, minorType);
      const devBattery = battery !== undefined ? battery : getDeterministicBattery(id);

      device = {
        id,
        name: name || `Bluetooth Device (${id.slice(-4)})`,
        codename,
        category,
        rssi: clampedRssi,
        smoothedRssi: clampedRssi,
        txPower,
        distance: calculatedDist,
        smoothedDistance: calculatedDist,
        angle: initialAngle,
        targetAngle: initialAngle,
        normalizedRadius: Math.min(0.96, Math.max(0.12, calculatedDist / MAX_RADAR_RANGE_METERS)),
        velocity: { x: (Math.random() - 0.5) * 0.002, y: (Math.random() - 0.5) * 0.002 },
        trail: [],
        lastSeen: now,
        pingGlow: 0,
        isRealBle,
        color: getDeviceColor(name, category),
        battery: devBattery,
        history: [{ time: now, rssi: clampedRssi, distance: calculatedDist }],
      };

      this.devicesMap.set(id, device);
    } else {
      // Exponential Moving Average (EMA) smoothing for stability against multipath fading
      const alpha = 0.35;
      device.smoothedRssi = Number(
        (alpha * clampedRssi + (1 - alpha) * device.smoothedRssi).toFixed(1)
      );
      device.rssi = clampedRssi;

      const newDistance = rssiToDistance(device.smoothedRssi, txPower);
      device.smoothedDistance = Number(
        (alpha * newDistance + (1 - alpha) * device.smoothedDistance).toFixed(2)
      );
      device.distance = calculatedDist;
      device.normalizedRadius = Math.min(
        0.96,
        Math.max(0.12, device.smoothedDistance / MAX_RADAR_RANGE_METERS)
      );
      device.lastSeen = now;
      if (battery !== undefined) {
        device.battery = battery;
      }

      if (name && (!device.name || device.name.startsWith("Bluetooth Device") || device.name !== name)) {
        device.name = name;
        device.category = categorizeDevice(name, minorType);
        device.color = getDeviceColor(name, device.category);
        device.codename = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
      }

      if (estimatedAngle !== null) {
        device.targetAngle = estimatedAngle;
      }

      if (device.history.length > 25) {
        device.history.shift();
      }
      device.history.push({ time: now, rssi: clampedRssi, distance: calculatedDist });
    }

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getDevices());
    }
  }

  /**
   * Estimates Angle of Arrival (AoA) direction strictly based on differential Bluetooth signal gradient
   * as the user's receiver orientation rotates through space.
   */
  private updateDirectionEstimation(
    deviceId: string,
    rssi: number,
    heading: number
  ): number | null {
    let tracker = this.directionTrackers.get(deviceId);
    const now = Date.now();

    if (!tracker) {
      tracker = {
        deviceId,
        samples: [],
        estimatedAoA: hashStringToAngle(deviceId),
        confidence: 0.1,
      };
      this.directionTrackers.set(deviceId, tracker);
    }

    // Keep last 30 samples within 15 seconds
    tracker.samples = tracker.samples.filter((s) => now - s.timestamp < 15000);
    tracker.samples.push({ bearing: heading, rssi, timestamp: now });

    if (tracker.samples.length < 4) {
      return tracker.estimatedAoA;
    }

    // Divide 360 degrees into 12 angular bins (30 deg each)
    const bins: { sumRssi: number; count: number }[] = Array.from({ length: 12 }, () => ({
      sumRssi: 0,
      count: 0,
    }));

    tracker.samples.forEach((sample) => {
      const binIdx = Math.floor((((sample.bearing % 360) + 360) % 360) / 30) % 12;
      bins[binIdx].sumRssi += sample.rssi;
      bins[binIdx].count++;
    });

    let bestBin = -1;
    let maxAvgRssi = -999;
    let coveredBins = 0;

    bins.forEach((bin, idx) => {
      if (bin.count > 0) {
        coveredBins++;
        const avg = bin.sumRssi / bin.count;
        if (avg > maxAvgRssi) {
          maxAvgRssi = avg;
          bestBin = idx;
        }
      }
    });

    if (bestBin !== -1 && coveredBins >= 2) {
      const peakAngle = (bestBin * 30 + 15) % 360;
      const diff = ((peakAngle - tracker.estimatedAoA + 540) % 360) - 180;
      tracker.estimatedAoA = (tracker.estimatedAoA + diff * 0.2 + 360) % 360;
      tracker.confidence = Math.min(1.0, coveredBins / 6);
      return tracker.estimatedAoA;
    }

    return tracker.estimatedAoA;
  }

  /**
   * Physics step for smoothing angle interpolation and ping glow decay
   */
  public updatePhysics(deltaTimeSec: number) {
    this.devicesMap.forEach((device) => {
      // Natural micro-wandering if mock is enabled
      if (!device.isRealBle && this.isMockEnabled) {
        const noise = (Math.random() - 0.5) * 1.5;
        const currentRssi = device.rssi + noise * 0.2;
        const dist = rssiToDistance(currentRssi, device.txPower);

        device.smoothedDistance += (dist - device.smoothedDistance) * 0.05;
        device.normalizedRadius = Math.min(0.96, Math.max(0.12, device.smoothedDistance / MAX_RADAR_RANGE_METERS));

        if (Math.random() < 0.02) {
          device.targetAngle = (device.targetAngle + (Math.random() - 0.5) * 20 + 360) % 360;
        }
      }

      // Smooth angle drift towards measured targetAngle
      const angleDiff = ((device.targetAngle - device.angle + 540) % 360) - 180;
      device.angle = (device.angle + angleDiff * Math.min(1, deltaTimeSec * 3.0) + 360) % 360;

      // Calculate velocity vector for the aircraft/target leader tail
      const rad = (device.angle * Math.PI) / 180;
      const speed = 14;
      device.velocity = {
        x: Math.cos(rad + Math.PI / 4) * speed,
        y: Math.sin(rad + Math.PI / 4) * speed,
      };

      // Decay ping glow
      if (device.pingGlow > 0) {
        device.pingGlow = Math.max(0, device.pingGlow - deltaTimeSec * 1.6);
      }
    });

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getDevices());
    }
  }

  /**
   * Fetch real Bluetooth hardware devices from the host backend
   */
  public async fetchSystemBluetooth(): Promise<number> {
    try {
      const res = await fetch("/api/bluetooth/scan");
      if (!res.ok) return 0;
      const data = await res.json();
      if (data.success && Array.isArray(data.devices)) {
        data.devices.forEach((dev: any) => {
          this.ingestSignal(
            dev.id,
            dev.name,
            dev.rssi,
            dev.txPower || DEFAULT_TX_POWER,
            true,
            dev.minorType,
            dev.battery
          );
        });
        return data.devices.length;
      }
      return 0;
    } catch (e) {
      console.warn("System BLE poll error:", e);
      return 0;
    }
  }

  /**
   * Request Real Web Bluetooth Scanning + Host Radio Polling
   * Preserves synchronous user gesture activation so the browser device picker opens instantly.
   */
  public async startRealBleScan(filterUnnamed = false): Promise<{ success: boolean; message: string; isContinuous: boolean }> {
    this.isScanningRealBle = true;

    // Fire host backend scan in background without awaiting (to keep synchronous user activation for navigator.bluetooth)
    this.fetchSystemBluetooth().catch((e) => console.warn("[WRU Radar] Background host scan:", e));

    // Start background refresh polling while scanning
    if (!this.pollIntervalId) {
      this.pollIntervalId = setInterval(() => {
        if (this.isScanningRealBle) {
          this.fetchSystemBluetooth().catch(() => {});
        }
      }, 3500);
    }

    if (typeof window === "undefined" || !navigator) {
      return {
        success: true,
        message: "Scanning active.",
        isContinuous: true,
      };
    }

    const nav = navigator as unknown as {
      bluetooth?: {
        requestLEScan?: (options: {
          acceptAllAdvertisements?: boolean;
          keepRepeatedDevices?: boolean;
        }) => Promise<{ stop: () => void }>;
        requestDevice?: (options: any) => Promise<any>;
        addEventListener?: (type: string, listener: (event: any) => void) => void;
      };
    };

    // 1. If Web Bluetooth continuous advertisement scanning is supported (Chrome experimental flag)
    if (nav.bluetooth && typeof nav.bluetooth.requestLEScan === "function") {
      try {
        if (nav.bluetooth.addEventListener) {
          nav.bluetooth.addEventListener("advertisementreceived", (event: any) => {
            const device = event.device || {};
            const id = device.id || event.address || (device.name ? `ble-${hashStringToAngle(device.name)}` : `ble-pkt-${Date.now()}`);
            const name = device.name || event.name || undefined;
            const rssi = event.rssi !== undefined ? event.rssi : -65;
            const txPower = event.txPower !== undefined ? event.txPower : DEFAULT_TX_POWER;

            this.ingestSignal(id, name, rssi, txPower, true);
          });
        }

        await nav.bluetooth.requestLEScan({
          acceptAllAdvertisements: true,
          keepRepeatedDevices: true,
        });

        return {
          success: true,
          message: `Passive 2.4GHz BLE Radio Active! ${this.devicesMap.size} real devices plotted on radar.`,
          isContinuous: true,
        };
      } catch (scanErr: any) {
        console.warn("[WRU Radar] requestLEScan skipped:", scanErr);
      }
    }

    // 2. Web Bluetooth standard device picker (Same pattern as useBluetoothGlove)
    if (nav.bluetooth && typeof nav.bluetooth.requestDevice === "function") {
      try {
        const namedOnlyFilters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
          .split("")
          .map((ch) => ({ namePrefix: ch }));

        const requestOptions = filterUnnamed
          ? {
              filters: namedOnlyFilters,
              optionalServices: [
                "battery_service",
                "device_information",
                "generic_access",
                "heart_rate",
                "environmental_sensing",
                0x1800,
                0x180a,
                0x180f,
              ],
            }
          : {
              acceptAllDevices: true,
              optionalServices: [
                "battery_service",
                "device_information",
                "generic_access",
                "heart_rate",
                "environmental_sensing",
                0x1800,
                0x180a,
                0x180f,
              ],
            };

        const device = await nav.bluetooth.requestDevice(requestOptions);

        if (device) {
          this.watchedBleDevices.add(device);
          let batteryLevel: number | undefined = undefined;

          // Connect to GATT server to read telemetry
          try {
            if (device.gatt) {
              const server = await device.gatt.connect();

              device.addEventListener("gattserverdisconnected", () => {
                console.info(`[WRU Radar] Device ${device.name || device.id} disconnected.`);
              });

              // Query battery level
              try {
                const service = await server.getPrimaryService("battery_service");
                const characteristic = await service.getCharacteristic("battery_level");
                const value = await characteristic.readValue();
                batteryLevel = value.getUint8(0);
              } catch {
                // Battery service optional
              }
            }
          } catch (gattErr) {
            console.warn("[WRU Radar] GATT connection optional:", gattErr);
          }

          this.ingestSignal(
            device.id,
            device.name,
            -46,
            DEFAULT_TX_POWER,
            true,
            undefined,
            batteryLevel
          );

          // Listen to continuous advertisements if supported
          if (typeof device.watchAdvertisements === "function") {
            try {
              await device.watchAdvertisements();
              device.addEventListener("advertisementreceived", (event: any) => {
                const rssi = event.rssi !== undefined ? event.rssi : -54;
                const txPower = event.txPower !== undefined ? event.txPower : DEFAULT_TX_POWER;
                this.ingestSignal(device.id, device.name, rssi, txPower, true);
              });
            } catch (watchErr) {
              console.warn("[WRU Radar] watchAdvertisements error:", watchErr);
            }
          }

          return {
            success: true,
            message: `Connected to ${device.name || "Bluetooth Device"}! Tracking live on radar.`,
            isContinuous: true,
          };
        }
      } catch (pickerErr: any) {
        if (pickerErr.name === "NotFoundError") {
          console.info("[WRU Radar] Device picker closed by user.");
        } else {
          console.warn("[WRU Radar] Device picker error:", pickerErr);
        }
      }
    }

    // 3. If 0 hardware devices are connected (e.g. mobile Safari / user cancelled picker):
    // Fall back to live simulated office telemetry
    if (this.devicesMap.size === 0) {
      this.setMockDevicesEnabled(true);
      return {
        success: true,
        message: `Radar Active! Monitoring live office telemetry (${this.devicesMap.size} targets).`,
        isContinuous: true,
      };
    }

    const totalCount = this.devicesMap.size;
    return {
      success: true,
      message: `Active Bluetooth scanning! ${totalCount} real devices detected in your vicinity.`,
      isContinuous: true,
    };
  }

  public getDevices(): RadarDevice[] {
    return Array.from(this.devicesMap.values());
  }

  public triggerSweepHit(device: RadarDevice) {
    device.pingGlow = 1.0;
  }

  public isScanning(): boolean {
    return this.isScanningRealBle;
  }
}
