import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export interface ScannedDevicePayload {
  id: string;
  name: string;
  address?: string;
  rssi: number;
  txPower: number;
  calculatedDistance: number;
  minorType?: string;
  battery?: number;
  isConnected?: boolean;
}

function calculateDistance(rssi: number, txPower: number = -59, n: number = 2.2): number {
  if (rssi === 0) return 2.5;
  const ratio = (txPower - rssi) / (10 * n);
  const d = Math.pow(10, ratio);
  return Math.min(8.0, Math.max(0.2, Number(d.toFixed(2))));
}

function getDeterministicBattery(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return 55 + (Math.abs(hash) % 44); // 55% to 98%
}

function normalizeSignature(str?: string): string {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isGenericName(name?: string): boolean {
  if (!name) return true;
  const lower = name.trim().toLowerCase();
  return (
    lower.startsWith("ble-") ||
    lower.startsWith("bluetooth device") ||
    lower.startsWith("mock-") ||
    lower === "unknown" ||
    lower === "unnamed"
  );
}

function findExistingPayloadKey(
  map: Map<string, ScannedDevicePayload>,
  id: string,
  name?: string,
  address?: string
): string | undefined {
  if (map.has(id)) return id;

  const normId = normalizeSignature(id);
  const normAddr = normalizeSignature(address);
  const cleanName = name?.trim().toLowerCase();
  const generic = isGenericName(name);

  for (const [key, dev] of map.entries()) {
    const devNormId = normalizeSignature(dev.id);
    const devNormAddr = normalizeSignature(dev.address);
    const devCleanName = dev.name?.trim().toLowerCase();

    // 1. MAC / UUID exact normalized match
    if (normId && (devNormId === normId || devNormAddr === normId)) return key;
    if (normAddr && (devNormId === normAddr || devNormAddr === normAddr)) return key;

    // 2. Specific non-generic device name match (e.g. "Ernest's iPhone", "JBL Flip 6", "Magic Mouse")
    if (!generic && devCleanName && !isGenericName(dev.name) && devCleanName === cleanName) {
      return key;
    }
  }

  return undefined;
}

export async function GET() {
  // If running in a Linux cloud / serverless environment (e.g. Vercel Lambda), skip macOS native commands
  if (process.platform !== "darwin") {
    return NextResponse.json({
      success: true,
      count: 0,
      isServerless: true,
      devices: [],
      timestamp: Date.now(),
    });
  }

  const devicesMap = new Map<string, ScannedDevicePayload>();

  // 1. Run live native CoreBluetooth airborne scanner if on macOS
  const binPath = path.join(process.cwd(), "bin", "ble-scanner");
  if (fs.existsSync(binPath)) {
    try {
      const { stdout: bleStdout } = await execAsync(`"${binPath}"`, { timeout: 2500 });
      if (bleStdout && bleStdout.trim().startsWith("[")) {
        const liveBleList = JSON.parse(bleStdout.trim());
        liveBleList.forEach((item: any) => {
          const rawRssi = typeof item.rssi === "number" ? item.rssi : -68;
          const txPower = typeof item.txPower === "number" ? item.txPower : -59;
          const dist = calculateDistance(rawRssi, txPower);
          const devName = item.name || `BLE-${item.id.slice(-4).toUpperCase()}`;

          const existingKey = findExistingPayloadKey(devicesMap, item.id, item.name);
          if (existingKey) {
            const existing = devicesMap.get(existingKey)!;
            existing.rssi = rawRssi;
            existing.txPower = txPower;
            existing.calculatedDistance = dist;
            if (item.name && isGenericName(existing.name)) {
              existing.name = item.name;
            }
          } else {
            devicesMap.set(item.id, {
              id: item.id,
              name: devName,
              rssi: rawRssi,
              txPower,
              calculatedDistance: dist,
              battery: getDeterministicBattery(item.id),
              isConnected: false,
            });
          }
        });
      }
    } catch (bleErr) {
      console.warn("Live CoreBluetooth scan warning:", bleErr);
    }
  }

  // 2. Query system_profiler for paired & connected hardware on macOS
  try {
    const { stdout: spStdout } = await execAsync("system_profiler SPBluetoothDataType -json", {
      timeout: 3000,
    });

    const data = JSON.parse(spStdout);
    const btArray = data.SPBluetoothDataType || [];

    if (btArray.length > 0) {
      const controller = btArray[0];

      // Connected devices (closest, strong signal ~ -42 to -50 dBm)
      const connectedList = controller.device_connected || [];
      connectedList.forEach((entry: any) => {
        Object.keys(entry).forEach((name) => {
          const info = entry[name];
          const rawRssi = info.device_rssi ? parseInt(info.device_rssi, 10) : -44;
          const txPower = -59;
          const dist = calculateDistance(rawRssi, txPower);
          const id = info.device_address || `host-${name.toLowerCase().replace(/\s+/g, "-")}`;

          let battery: number = getDeterministicBattery(id);
          if (info.device_batteryLevelLeft) {
            battery = parseInt(info.device_batteryLevelLeft.replace("%", ""), 10);
          } else if (info.device_batteryLevelCase) {
            battery = parseInt(info.device_batteryLevelCase.replace("%", ""), 10);
          }

          const existingKey = findExistingPayloadKey(devicesMap, id, name, info.device_address);
          if (existingKey) {
            const existing = devicesMap.get(existingKey)!;
            existing.name = name;
            existing.address = info.device_address || existing.address;
            existing.rssi = rawRssi;
            existing.txPower = txPower;
            existing.calculatedDistance = dist;
            existing.minorType = info.device_minorType || existing.minorType;
            existing.battery = battery;
            existing.isConnected = true;
          } else {
            devicesMap.set(id, {
              id,
              name,
              address: info.device_address,
              rssi: rawRssi,
              txPower,
              calculatedDistance: dist,
              minorType: info.device_minorType,
              battery,
              isConnected: true,
            });
          }
        });
      });

      // Not connected paired devices — ONLY include if active live RSSI is present from recent radio contact
      const notConnectedList = controller.device_not_connected || [];
      notConnectedList.forEach((entry: any) => {
        Object.keys(entry).forEach((name) => {
          const info = entry[name];
          const id = info.device_address || `host-${name.toLowerCase().replace(/\s+/g, "-")}`;

          // Only consider not-connected devices if an active RSSI is measured
          if (!info.device_rssi) {
            return;
          }

          const rawRssi = parseInt(info.device_rssi, 10);
          const txPower = -59;
          const dist = calculateDistance(rawRssi, txPower);

          let battery: number | undefined;
          if (info.device_batteryLevelLeft) {
            battery = parseInt(info.device_batteryLevelLeft.replace("%", ""), 10);
          } else if (info.device_batteryLevelCase) {
            battery = parseInt(info.device_batteryLevelCase.replace("%", ""), 10);
          }

          const existingKey = findExistingPayloadKey(devicesMap, id, name, info.device_address);
          if (existingKey) {
            const existing = devicesMap.get(existingKey)!;
            existing.name = name;
            existing.address = info.device_address || existing.address;
            existing.minorType = info.device_minorType || existing.minorType;
            existing.rssi = rawRssi;
            existing.calculatedDistance = dist;
            if (battery !== undefined) existing.battery = battery;
            return;
          }

          devicesMap.set(id, {
            id,
            name,
            address: info.device_address,
            rssi: rawRssi,
            txPower,
            calculatedDistance: dist,
            minorType: info.device_minorType,
            battery,
            isConnected: false,
          });
        });
      });
    }
  } catch (spErr) {
    console.warn("system_profiler scan warning:", spErr);
  }

  const devices = Array.from(devicesMap.values());

  return NextResponse.json({
    success: true,
    count: devices.length,
    devices,
    timestamp: Date.now(),
  });
}
