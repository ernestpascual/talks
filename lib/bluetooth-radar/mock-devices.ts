import { DeviceCategory } from "./types";

export interface MockOfficemateTemplate {
  name: string;
  codename: string;
  role: string;
  category: DeviceCategory;
  baseAngle: number;
  baseDistance: number; // in meters (0.5 to 5.0m max)
  driftSpeed: number; // movement rate
  battery: number;
}

export const MOCK_OFFICE_DEVICES: MockOfficemateTemplate[] = [
  // 1. PH1 in name -> RED (#ef4444)
  {
    name: "Studio PH1 Receiver & Mic",
    codename: "PH1-MIC",
    role: "Production Studio",
    category: "audio",
    baseAngle: 215,
    baseDistance: 1.6,
    driftSpeed: 0.1,
    battery: 85,
  },
  {
    name: "Meeting Room PH1 Hub",
    codename: "PH1-HUB",
    role: "Conference System",
    category: "beacon",
    baseAngle: 145,
    baseDistance: 4.2,
    driftSpeed: 0.02,
    battery: 100,
  },

  // 2. iPhone -> YELLOW (#facc15)
  {
    name: "Jian's iPhone 15 Pro",
    codename: "RYR1570",
    role: "Copywriter",
    category: "phone",
    baseAngle: 66,
    baseDistance: 2.4,
    driftSpeed: 0.45,
    battery: 64,
  },
  {
    name: "Ernest's iPhone 16 Pro",
    codename: "EP-IPHN",
    role: "Creative Technologist",
    category: "phone",
    baseAngle: 42,
    baseDistance: 1.1,
    driftSpeed: 0.15,
    battery: 92,
  },

  // 3. Different phone (Android, Pixel, Galaxy) -> CYAN (#00f5b8)
  {
    name: "Kat's Pixel 9 Pro",
    codename: "KT-PX09",
    role: "Brand Director",
    category: "phone",
    baseAngle: 185,
    baseDistance: 2.0,
    driftSpeed: 0.3,
    battery: 81,
  },
  {
    name: "Rico's Galaxy Z Fold6",
    codename: "RC-ZFLD",
    role: "Managing Director",
    category: "phone",
    baseAngle: 170,
    baseDistance: 3.2,
    driftSpeed: 0.4,
    battery: 52,
  },

  // 4. Laptops -> GREEN (#22c55e)
  {
    name: "Ernest's MacBook Pro M3",
    codename: "EP-MBP",
    role: "Creative Technologist",
    category: "laptop",
    baseAngle: 25,
    baseDistance: 1.3,
    driftSpeed: 0.12,
    battery: 95,
  },
  {
    name: "Maya's ThinkPad X1",
    codename: "NAX2162",
    role: "Senior Strategist",
    category: "laptop",
    baseAngle: 72,
    baseDistance: 3.8,
    driftSpeed: 0.15,
    battery: 56,
  },

  // 5. Audio Devices -> BLUE (#3b82f6)
  {
    name: "Sarah's AirPods Max",
    codename: "SWR3665",
    role: "Art Director",
    category: "audio",
    baseAngle: 58,
    baseDistance: 2.9,
    driftSpeed: 0.25,
    battery: 78,
  },
  {
    name: "Dave's Sony WH-1000XM5",
    codename: "SWR3288",
    role: "Executive Producer",
    category: "audio",
    baseAngle: 115,
    baseDistance: 2.3,
    driftSpeed: 0.18,
    battery: 45,
  },

  // 6. Beacons -> ORANGE (#f97316)
  {
    name: "Wayfinding BLE Beacon B4",
    codename: "BCN-B04",
    role: "Navigation Beacon",
    category: "beacon",
    baseAngle: 240,
    baseDistance: 4.5,
    driftSpeed: 0.01,
    battery: 90,
  },

  // 7. Smart Home -> PINK (#ec4899)
  {
    name: "Philips Hue Studio Light",
    codename: "HUE-LGT",
    role: "Studio Lighting",
    category: "smarthome",
    baseAngle: 305,
    baseDistance: 3.5,
    driftSpeed: 0.01,
    battery: 100,
  },
  {
    name: "Meeting Room 4K Apple TV",
    codename: "DLH2451",
    role: "Presentation Display",
    category: "smarthome",
    baseAngle: 75,
    baseDistance: 4.1,
    driftSpeed: 0.02,
    battery: 100,
  },

  // 8. Smart Trackers -> NEON PURPLE (#c084fc)
  {
    name: "Ernest's AirTag (Keys)",
    codename: "TAG-KEY",
    role: "Asset Tracker",
    category: "tracker",
    baseAngle: 350,
    baseDistance: 1.8,
    driftSpeed: 0.2,
    battery: 88,
  },
  {
    name: "Office Drone Tile Tracker",
    codename: "TILE-01",
    role: "Hardware Kit",
    category: "tracker",
    baseAngle: 130,
    baseDistance: 6.8,
    driftSpeed: 0.05,
    battery: 70,
  },

  // 9. Unknown device -> WHITE (#ffffff)
  {
    name: "Unknown BLE Tag (0x4A2F)",
    codename: "UNK-4A2F",
    role: "Unidentified Beacon",
    category: "unknown",
    baseAngle: 330,
    baseDistance: 4.6,
    driftSpeed: 0.05,
    battery: 70,
  },
  {
    name: "Generic BLE Peripheral",
    codename: "BLE-E729",
    role: "Unknown Sensor",
    category: "unknown",
    baseAngle: 280,
    baseDistance: 3.7,
    driftSpeed: 0.08,
    battery: 50,
  },
];
