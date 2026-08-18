export const LIGHTSABER_BLADE_LEN = 340;
export const LIGHTSABER_HILT_LEN = 96;
export const LIGHTSABER_BLADE_WIDTH = 28;
export const LIGHTSABER_TOTAL_REACH = LIGHTSABER_HILT_LEN + LIGHTSABER_BLADE_LEN;

export type SaberColorKey = "cyan" | "red" | "green" | "purple" | "gold" | "white";

export interface SaberColorConfig {
  key: SaberColorKey;
  name: string;
  coreColor: string;
  glowColor: string;
  auraColor: string;
  sparkColor: string;
  description: string;
  icon: string;
}

export const SABER_COLORS: Record<SaberColorKey, SaberColorConfig> = {
  cyan: {
    key: "cyan",
    name: "Jedi Guardian",
    coreColor: "#ffffff",
    glowColor: "#00f0ff",
    auraColor: "rgba(0, 240, 255, 0.4)",
    sparkColor: "#67e8f9",
    description: "Classic plasma blade",
    icon: "💎",
  },
  red: {
    key: "red",
    name: "Sith Inquisitor",
    coreColor: "#fff5f5",
    glowColor: "#ff0055",
    auraColor: "rgba(255, 0, 85, 0.45)",
    sparkColor: "#f43f5e",
    description: "Bleeding kyber crystal",
    icon: "🔥",
  },
  green: {
    key: "green",
    name: "Jedi Consular",
    coreColor: "#ffffff",
    glowColor: "#10b981",
    auraColor: "rgba(16, 185, 129, 0.4)",
    sparkColor: "#34d399",
    description: "Harmonic emerald focus",
    icon: "⚡",
  },
  purple: {
    key: "purple",
    name: "Mace Windu",
    coreColor: "#ffffff",
    glowColor: "#a855f7",
    auraColor: "rgba(168, 85, 247, 0.45)",
    sparkColor: "#c084fc",
    description: "Form VII Vaapad mastery",
    icon: "🌌",
  },
  gold: {
    key: "gold",
    name: "Temple Guard",
    coreColor: "#fffbeb",
    glowColor: "#f59e0b",
    auraColor: "rgba(245, 158, 11, 0.45)",
    sparkColor: "#fbbf24",
    description: "Ancient radiant blade",
    icon: "☀️",
  },
  white: {
    key: "white",
    name: "Ahsoka Pure",
    coreColor: "#ffffff",
    glowColor: "#e0f2fe",
    auraColor: "rgba(224, 242, 254, 0.4)",
    sparkColor: "#ffffff",
    description: "Purified crystal resonance",
    icon: "✨",
  },
};

export interface Point2D {
  x: number;
  y: number;
}

export interface TimedPoint extends Point2D {
  time: number;
}

export type SpeedTier = "slow" | "medium" | "fast";

export interface DamageResult {
  baseDamage: number;
  totalDamage: number;
  isCritical: boolean;
  speedPxPerMs: number;
  speedTier: SpeedTier;
  label: string;
}

export interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
  isCrit: boolean;
}

export interface SlashParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  shape: "spark" | "shard" | "ember";
  rotation?: number;
  rotSpeed?: number;
}

export interface Fireball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  rotation: number;
  color: string;
}

export interface FireballPiece {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rotation: number;
  rotSpeed: number;
  life: number;
  color: string;
}

let nextEntityId = 1;
export function getNextId(): number {
  return nextEntityId++;
}

/**
 * Calculates slash speed (pixels per millisecond) from a trail segment
 */
export function calculateSlashSpeed(p1: TimedPoint, p2: TimedPoint): number {
  const dt = Math.max(1, p2.time - p1.time);
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return dist / dt;
}

/**
 * Calculate damage based on slash speed:
 * - Slow slashes randomize 1 to 2
 * - Fast slashes randomize 2 to 3
 * - Medium slashes randomize 1 to 3
 * - 20% Critical Hit chance applies 2x damage multiplier
 */
export function calculateDamage(speedPxPerMs: number): DamageResult {
  let speedTier: SpeedTier = "medium";
  let baseDamage = 2;

  if (speedPxPerMs < 0.65) {
    speedTier = "slow";
    // Slower swings favor 1 dmg (75% chance for 1, 25% for 2)
    baseDamage = Math.random() < 0.75 ? 1 : 2;
  } else if (speedPxPerMs >= 1.35) {
    speedTier = "fast";
    // Swift swings favor 3 dmg (75% chance for 3, 25% for 2)
    baseDamage = Math.random() < 0.75 ? 3 : 2;
  } else {
    speedTier = "medium";
    // Balanced roll: 1, 2, or 3
    const roll = Math.random();
    if (roll < 0.33) baseDamage = 1;
    else if (roll < 0.67) baseDamage = 2;
    else baseDamage = 3;
  }

  // 20% Critical Hit chance
  const isCritical = Math.random() < 0.20;
  const totalDamage = isCritical ? baseDamage * 2 : baseDamage;

  let label = `-${totalDamage}`;
  if (isCritical) {
    label = `CRIT! -${totalDamage}`;
  } else if (speedTier === "fast") {
    label = `FAST! -${totalDamage}`;
  }

  return {
    baseDamage,
    totalDamage,
    isCritical,
    speedPxPerMs,
    speedTier,
    label,
  };
}

/**
 * Line segment to circle distance test
 */
export function segmentHitsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return Math.hypot(cx - x1, cy - y1) <= r;
  }
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(cx - px, cy - py) <= r;
}

/**
 * Line segment to rotated bounding box or multi-circle hitbox for the Dragon
 */
export function segmentHitsDragonHitbox(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dragonCenter: Point2D,
  scale: number
): { hit: boolean; hitPoint: Point2D } | null {
  // Dragon hitbox composite: Head, Neck, Chest/Core, Wings
  const hitboxes = [
    { name: "head", offset: { x: 0, y: -45 * scale }, r: 48 * scale },
    { name: "mouth", offset: { x: 0, y: -15 * scale }, r: 38 * scale },
    { name: "chest", offset: { x: 0, y: 35 * scale }, r: 65 * scale },
    { name: "leftWing", offset: { x: -75 * scale, y: -10 * scale }, r: 52 * scale },
    { name: "rightWing", offset: { x: 75 * scale, y: -10 * scale }, r: 52 * scale },
    { name: "lowerBody", offset: { x: 0, y: 90 * scale }, r: 55 * scale },
  ];

  for (const box of hitboxes) {
    const cx = dragonCenter.x + box.offset.x;
    const cy = dragonCenter.y + box.offset.y;
    if (segmentHitsCircle(x1, y1, x2, y2, cx, cy, box.r)) {
      // Find intersection closest point
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      let t = 0.5;
      if (lenSq > 1e-6) {
        t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
      }
      return {
        hit: true,
        hitPoint: { x: x1 + t * dx, y: y1 + t * dy },
      };
    }
  }

  return null;
}
