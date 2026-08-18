export type RouteStatus = "public" | "password_protected" | "disabled";

export interface ManagedRoute {
  id: string;
  path: string;
  title: string;
  description: string;
  category: "talks" | "experience";
  status: RouteStatus;
  password?: string;
  disabledMessage?: string;
  updatedAt?: number;
}

export const DEFAULT_MANAGED_ROUTES: ManagedRoute[] = [
  // Master Switches
  {
    id: "all-talks",
    path: "/talks",
    title: "Master Control: All Talks",
    description: "Applies to all /talks routes unless overridden individually.",
    category: "talks",
    status: "public",
  },
  {
    id: "all-experiences",
    path: "/experience",
    title: "Master Control: All Experiences",
    description: "Applies to all /experience routes unless overridden individually.",
    category: "experience",
    status: "public",
  },

  // Individual Talks
  {
    id: "talk-aerocano",
    path: "/talks/aerocano",
    title: "Aerocano Talk Presentation",
    description: "Interactive slide deck with live audience preference widgets.",
    category: "talks",
    status: "public",
  },
  {
    id: "talk-bbdo",
    path: "/talks/bbdo-ai-playday",
    title: "BBDO AI Playday",
    description: "14-slide interactive deck exploring AI workflows & agents.",
    category: "talks",
    status: "public",
  },
  {
    id: "talk-raw-school",
    path: "/talks/raw-school-2026",
    title: "Raw School 2026",
    description: "14-slide creative engineering presentation deck.",
    category: "talks",
    status: "public",
  },

  // Individual Experiences
  {
    id: "exp-dragon-slayer",
    path: "/experience/dragon-slayer",
    title: "Dragon Slayer Lightsaber",
    description: "MediaPipe webcam hand/fist tracking combat arena vs 100 HP dragon.",
    category: "experience",
    status: "public",
  },
  {
    id: "exp-find-officemate",
    path: "/experience/find-your-officemate",
    title: "WRU?! Bluetooth Radar",
    description: "Generative audio-visual BLE radar tracking nearby physical devices.",
    category: "experience",
    status: "public",
  },
  {
    id: "exp-aerocano-shake",
    path: "/experience/aerocano-shake",
    title: "Aerocano Shake-It Sensor",
    description: "Device accelerometer motion shaker with live leaderboard sync.",
    category: "experience",
    status: "public",
  },
  {
    id: "exp-aerocano-survey",
    path: "/experience/aerocano-survey",
    title: "Aerocano Audience Survey",
    description: "Real-time coffee preference and flavor questionnaire.",
    category: "experience",
    status: "public",
  },
  {
    id: "exp-price-demo",
    path: "/experience/raw-school-2026/price-demo",
    title: "Smile Price Facial Tracking",
    description: "Real-time facial smile detection and dynamic pricing demo.",
    category: "experience",
    status: "public",
  },
  {
    id: "exp-ninja",
    path: "/experience/raw-school-2026/ninja",
    title: "Fruit Ninja Hand Tracking",
    description: "Interactive vision-based hand slicing game demo.",
    category: "experience",
    status: "public",
  },
  {
    id: "exp-krebs",
    path: "/experience/raw-school-2026/krebs",
    title: "Krebs Cycle Visualization",
    description: "Interactive cyclic creative node graph visualization.",
    category: "experience",
    status: "public",
  },
];
