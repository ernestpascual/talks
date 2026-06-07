/** Multiplier on fruit radius. 1 = default (~44–70px). Increase for bigger fruits. */
export const FRUIT_SIZE = 3;

/** Multiplier on movement (launch, drift, gravity, slice debris). 1 = default. Lower = slower. */
export const FRUIT_SPEED = 0.2;

/** Multiplier on sword blade, guard, and handle. 1 = default. Increase for a larger sword. */
export const SWORD_SIZE = 2;

/** Peak opacity of slash trails at the sword tip (0–1). Tail of the trail fades to 0. */
export const TRAIL_OPACITY = 0.85;

/** Base sword dimensions (multiplied by SWORD_SIZE). */
export const SWORD_HANDLE_LEN = 32;
export const SWORD_GUARD_W = 10;
export const SWORD_BLADE_LEN = 80;

export type FruitKind = "apple" | "orange" | "lemon";

export type Fruit = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: FruitKind;
  rotation: number;
  rotSpeed: number;
};

export type ShardVertex = { x: number; y: number };

export type FruitPiece = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: FruitKind;
  rotation: number;
  rotSpeed: number;
  life: number;
  /** Original fruit center — used to clip the emoji inside the shard. */
  originX: number;
  originY: number;
  originR: number;
  originRotation: number;
  /** Jagged polygon around (0,0), rotated/translated with the piece. */
  localVerts: ShardVertex[];
};

export type SlashSpark = {
  id: number;
  x: number;
  y: number;
  angle: number;
  life: number;
};

const FRUIT_EMOJI: Record<FruitKind, string> = {
  apple: "🍎",
  orange: "🍊",
  lemon: "🍋",
};

const FRUIT_COLORS: Record<FruitKind, string> = {
  apple: "#e53935",
  orange: "#fb8c00",
  lemon: "#fdd835",
};

const FRUIT_PULP: Record<FruitKind, string> = {
  apple: "#ff6b6b",
  orange: "#ffb74d",
  lemon: "#fff176",
};

let idCounter = 0;
export function nextId() {
  idCounter += 1;
  return idCounter;
}

export function randomKind(): FruitKind {
  const kinds: FruitKind[] = ["apple", "orange", "lemon"];
  return kinds[Math.floor(Math.random() * kinds.length)]!;
}

export function spawnFruit(width: number, height: number): Fruit {
  const r = (44 + Math.random() * 26) * FRUIT_SIZE;
  const x = r + Math.random() * (width - r * 2);
  const speed = height * (0.005 + Math.random() * 0.003) * FRUIT_SPEED;
  return {
    id: nextId(),
    x,
    y: height + r,
    vx: (Math.random() - 0.5) * width * 0.001 * FRUIT_SPEED,
    vy: -speed,
    r,
    kind: randomKind(),
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.08 * FRUIT_SPEED,
  };
}

/** Random piece count per slice: 2, 3, or 4. */
export function randomPieceCount() {
  return 2 + Math.floor(Math.random() * 3);
}

/** Unequal weights that sum to 1 (no wedge near 50% of the circle). */
function randomPieceWeights(count: number): number[] {
  const raw = Array.from({ length: count }, () => 0.12 + Math.random() * 0.88);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

/** Irregular shard outline — jagged arc and cracked edges back to center. */
export function buildShardVertices(
  r: number,
  startAngle: number,
  sweep: number,
): ShardVertex[] {
  const verts: ShardVertex[] = [{ x: 0, y: 0 }];
  const arcSteps = 4 + Math.floor(Math.random() * 4);

  for (let i = 0; i <= arcSteps; i++) {
    const t = i / arcSteps;
    const angle = startAngle + sweep * t;
    const radius = r * (0.76 + Math.random() * 0.28);
    verts.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }

  const edgeSteps = 2 + Math.floor(Math.random() * 3);
  for (let i = edgeSteps; i >= 0; i--) {
    const t = i / edgeSteps;
    const crack = 0.15 + Math.random() * 0.35;
    verts.push({
      x: Math.cos(startAngle) * r * t * crack,
      y: Math.sin(startAngle) * r * t * crack,
    });
  }

  return verts;
}

export function sliceFruit(
  fruit: Fruit,
  slashAngle: number,
  _hitX: number,
  _hitY: number,
): FruitPiece[] {
  const pieceCount = randomPieceCount();
  const weights = randomPieceWeights(pieceCount);
  const cutAngle = slashAngle + (Math.random() - 0.5) * 0.55;
  const speed = (2 + Math.random() * 2.2) * FRUIT_SPEED;
  const spin = (Math.random() - 0.5) * 0.22;

  const pieces: FruitPiece[] = [];
  let wedgeStart = 0;

  for (let i = 0; i < pieceCount; i++) {
    const wedgeSweep = weights[i]! * Math.PI * 2;
    const shardAngle = cutAngle + wedgeStart;
    const midAngle = shardAngle + wedgeSweep / 2;
    const shardR = fruit.r * (0.88 + Math.random() * 0.12);
    const burst = speed * (0.75 + Math.random() * 0.65);
    const centroid = fruit.r * (0.38 + Math.random() * 0.12);

    pieces.push({
      id: nextId(),
      x: fruit.x + Math.cos(midAngle) * centroid,
      y: fruit.y + Math.sin(midAngle) * centroid,
      vx: Math.cos(midAngle) * burst + (Math.random() - 0.5) * 0.8,
      vy: Math.sin(midAngle) * burst - (0.8 + Math.random() * 1),
      kind: fruit.kind,
      rotation: fruit.rotation + shardAngle + (Math.random() - 0.5) * 0.4,
      rotSpeed: spin + (Math.random() - 0.5) * 0.16,
      life: 1,
      originX: fruit.x,
      originY: fruit.y,
      originR: fruit.r,
      originRotation: fruit.rotation,
      localVerts: buildShardVertices(shardR, 0, wedgeSweep),
    });

    wedgeStart += wedgeSweep;
  }

  return pieces;
}

export function segmentHitsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
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

export function normToCanvas(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    x: (1 - x) * width,
    y: y * height,
  };
}

export function slashAngleFromSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  return Math.atan2(y2 - y1, x2 - x1);
}

export type CanvasPoint = { x: number; y: number };

export type FingerPose = {
  tip: { x: number; y: number };
  dip: { x: number; y: number };
};

/** Pixel distance from finger base (handle) to blade tip. */
export function swordReachPx() {
  return (SWORD_HANDLE_LEN + SWORD_GUARD_W + SWORD_BLADE_LEN) * SWORD_SIZE;
}

export function swordBaseCanvas(
  pose: FingerPose,
  width: number,
  height: number,
): CanvasPoint {
  return normToCanvas(pose.tip.x, pose.tip.y, width, height);
}

export function swordAngleFromPose(
  pose: FingerPose,
  width: number,
  height: number,
) {
  const base = swordBaseCanvas(pose, width, height);
  const dip = normToCanvas(pose.dip.x, pose.dip.y, width, height);
  return Math.atan2(base.y - dip.y, base.x - dip.x);
}

/** Blade tip in canvas coordinates (mirrored like the video). */
export function swordTipCanvas(
  pose: FingerPose,
  width: number,
  height: number,
): CanvasPoint {
  const base = swordBaseCanvas(pose, width, height);
  const angle = swordAngleFromPose(pose, width, height);
  const reach = swordReachPx();
  return {
    x: base.x + Math.cos(angle) * reach,
    y: base.y + Math.sin(angle) * reach,
  };
}

export { FRUIT_COLORS, FRUIT_EMOJI, FRUIT_PULP };
