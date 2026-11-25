export type Point = { x: number; y: number; z: number };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// The second hand is commonly occluded by the first in a joined Ram seal.
// Accept the visible two-finger silhouette and tolerate briefly missing frames.
export function readRamSeal(hands: Point[][]) {
  for (const hand of hands) {
    if (hand.length < 21) continue;
    const palm = Math.max(0.025, distance(hand[0], hand[9]));
    const raised = (tip: number, pip: number) =>
      hand[tip].y < hand[pip].y - palm * 0.04 &&
      distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.03;
    const folded = (tip: number, pip: number) =>
      hand[tip].y > hand[12].y + palm * 0.2 ||
      distance(hand[tip], hand[0]) < distance(hand[pip], hand[0]) * 1.2;
    if (raised(8, 6) && raised(12, 10) &&
        distance(hand[8], hand[12]) < palm * 1.25 &&
        folded(16, 14) && folded(20, 18)) {
      return { matched: true, hint: "Hold" };
    }
  }
  return { matched: false, hint: "Ram seal" };
}

export function drawLog(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.scale(size / 300, size / 300);
  const bark = ctx.createLinearGradient(0, -60, 0, 60);
  bark.addColorStop(0, "#a37f52"); bark.addColorStop(0.2, "#796047");
  bark.addColorStop(0.6, "#513b2b"); bark.addColorStop(1, "#261d19");
  ctx.fillStyle = bark;
  ctx.beginPath(); ctx.roundRect(-140, -60, 280, 120, 8); ctx.fill();
  ctx.save();
  ctx.clip();
  // Seeded grain stays fixed across frames rather than shimmering.
  for (let i = 0; i < 220; i++) {
    const n = (Math.sin(i * 127.1 + 23) * 43758.5453) % 1;
    const xx = -145 + ((i * 71) % 290), yy = -59 + ((i * 37) % 118);
    ctx.strokeStyle = i % 3 === 0 ? "#d3ac7355" : "#1e17177a";
    ctx.lineWidth = 0.5 + Math.abs(n) * 2.5;
    ctx.beginPath(); ctx.moveTo(xx, yy);
    ctx.bezierCurveTo(xx + 12, yy + n * 8, xx + 28, yy - n * 7, xx + 30 + Math.abs(n) * 65, yy + n * 4); ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = "#211912aa"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(-90 + i * 63, -25 + i % 2 * 48, 13, 4, 0.1, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#775638";
  ctx.beginPath(); ctx.moveTo(-65, -48); ctx.lineTo(-45, -89); ctx.lineTo(-30, -84); ctx.lineTo(-35, -42); ctx.fill();
  ctx.fillStyle = "#b59464";
  ctx.beginPath(); ctx.ellipse(137, 0, 26, 60, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#71513388"; ctx.lineWidth = 1.1;
  for (let i = 1; i <= 7; i++) {
    ctx.beginPath(); ctx.ellipse(137 + Math.sin(i) * 1.5, 0, i * 3.3, i * 7.6, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = "#3c2c21"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(137, 0, 26, 60, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const angle = i * 1.7 + 0.3;
    ctx.beginPath(); ctx.moveTo(137 + Math.cos(angle) * 25, Math.sin(angle) * 58);
    ctx.lineTo(137 + Math.cos(angle + 0.1) * 12, Math.sin(angle + 0.1) * 29); ctx.stroke();
  }
  // Retain the time argument for the shared rendering API; wood remains still.
  void time;
  ctx.restore();
}

export function drawSmoke(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, elapsed: number) {
  const t = elapsed / 1400;
  if (t < 0 || t > 1) return;
  ctx.save();
  for (let i = 0; i < 34; i++) {
    const angle = i * 2.39996;
    const spread = size * (0.05 + t * 0.8) * (0.4 + (i % 5) / 6);
    const px = x + Math.cos(angle) * spread;
    const py = y + Math.sin(angle) * spread * 0.7 - t * size * 0.3;
    const radius = size * (0.15 + (i % 4) * 0.025) * (1 + t * 0.6);
    const glow = ctx.createRadialGradient(px, py, 0, px, py, radius);
    glow.addColorStop(0, `rgba(245,244,225,${(1 - t) * 0.95})`);
    glow.addColorStop(0.7, `rgba(204,211,193,${(1 - t) * 0.75})`);
    glow.addColorStop(1, "rgba(204,211,193,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
