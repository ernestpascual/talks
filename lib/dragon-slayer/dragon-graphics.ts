import {
  Fireball,
  FireballPiece,
  FloatingText,
  Point2D,
  SABER_COLORS,
  SaberColorConfig,
  SlashParticle,
  TimedPoint,
} from "./game-logic";
import { LIGHTSABER_CONFIG } from "./saber-config";

export interface DragonRenderState {
  x: number;
  y: number;
  scale: number;
  hp: number;
  maxHp: number;
  phase: number;
  hitStagger: number; // 0 to 1
  hitFlashTimer: number; // 0 to 1
  isDead: boolean;
  deathProgress: number; // 0 to 1
  breathCharge: number; // 0 to 1
}

/**
 * Renders the Dragon Boss on Canvas
 */
export function drawDragon(
  ctx: CanvasRenderingContext2D,
  state: DragonRenderState,
  timeMs: number
) {
  ctx.save();

  // Floating hover movement
  const hoverY = Math.sin(timeMs * 0.002) * 14;
  const hoverX = Math.cos(timeMs * 0.0012) * 8;
  const breath = Math.sin(timeMs * 0.003) * 0.05;

  // Recoil offset when hit
  const hitShakeX = state.hitStagger > 0 ? (Math.random() - 0.5) * 16 * state.hitStagger : 0;
  const hitShakeY = state.hitStagger > 0 ? (Math.random() - 0.5) * 16 * state.hitStagger : 0;

  const cx = state.x + hoverX + hitShakeX;
  const cy = state.y + hoverY + hitShakeY;
  const s = state.scale * (1 + breath);

  // If dying, scale down and fade
  if (state.isDead) {
    ctx.globalAlpha = Math.max(0, 1 - state.deathProgress);
  }

  ctx.translate(cx, cy);

  // Wing Flap Angle
  const wingFlap = Math.sin(timeMs * 0.004) * 0.28;

  // Determine dragon color theme based on phase
  let primaryColor = "#1e1b4b"; // Deep obsidian / indigo
  let secondaryColor = "#4338ca";
  let magmaGlow = "#f97316"; // Fiery orange
  let eyeColor = "#fbbf24";

  if (state.phase === 2) {
    // Enraged
    primaryColor = "#450a0a";
    secondaryColor = "#991b1b";
    magmaGlow = "#ef4444";
    eyeColor = "#f43f5e";
  } else if (state.phase === 3) {
    // Berserk / Plasma
    primaryColor = "#2e1065";
    secondaryColor = "#6b21a8";
    magmaGlow = "#d946ef";
    eyeColor = "#00f0ff";
  }

  // Hit flash white
  if (state.hitFlashTimer > 0) {
    magmaGlow = "#ffffff";
    primaryColor = "#f87171";
  }

  // 1. BACK TAIL
  ctx.save();
  ctx.beginPath();
  const tailSway = Math.sin(timeMs * 0.003) * 25 * s;
  ctx.moveTo(-10 * s, 100 * s);
  ctx.quadraticCurveTo(-40 * s + tailSway, 170 * s, 10 * s + tailSway * 1.5, 230 * s);
  ctx.quadraticCurveTo(0 * s + tailSway, 170 * s, 15 * s, 100 * s);
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.restore();

  // 2. WINGS (Left & Right)
  // Left Wing
  ctx.save();
  ctx.translate(-50 * s, -10 * s);
  ctx.rotate(-0.35 + wingFlap);
  drawDragonWing(ctx, s, primaryColor, secondaryColor, magmaGlow, false);
  ctx.restore();

  // Right Wing
  ctx.save();
  ctx.translate(50 * s, -10 * s);
  ctx.rotate(0.35 - wingFlap);
  drawDragonWing(ctx, s, primaryColor, secondaryColor, magmaGlow, true);
  ctx.restore();

  // 3. MAIN BODY & CHEST
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 50 * s, 48 * s, 68 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 4 * s;
  ctx.stroke();

  // Glowing Chest Rune Plates (Magma Core)
  const corePulse = 0.7 + Math.sin(timeMs * 0.006) * 0.3;
  ctx.shadowColor = magmaGlow;
  ctx.shadowBlur = 20 * corePulse;
  for (let i = 0; i < 4; i++) {
    const yOff = (20 + i * 22) * s;
    const w = (32 - i * 5) * s;
    ctx.beginPath();
    ctx.moveTo(-w, yOff);
    ctx.lineTo(0, yOff + 10 * s);
    ctx.lineTo(w, yOff);
    ctx.lineTo(0, yOff + 15 * s);
    ctx.closePath();
    ctx.fillStyle = magmaGlow;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  // 4. NECK & HEAD
  ctx.save();
  // Neck
  ctx.beginPath();
  ctx.moveTo(-25 * s, 20 * s);
  ctx.lineTo(-20 * s, -30 * s);
  ctx.lineTo(20 * s, -30 * s);
  ctx.lineTo(25 * s, 20 * s);
  ctx.closePath();
  ctx.fillStyle = primaryColor;
  ctx.fill();

  // Neck Spines
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (-10 - i * 15) * s);
    ctx.lineTo(-8 * s, (-18 - i * 15) * s);
    ctx.lineTo(0, (-22 - i * 15) * s);
    ctx.lineTo(8 * s, (-18 - i * 15) * s);
    ctx.closePath();
    ctx.fillStyle = magmaGlow;
    ctx.fill();
  }

  // Head Base
  ctx.beginPath();
  ctx.moveTo(0, -90 * s); // Snout tip
  ctx.lineTo(38 * s, -45 * s); // Right cheek
  ctx.lineTo(28 * s, -20 * s); // Jaw right
  ctx.lineTo(0, -10 * s); // Chin
  ctx.lineTo(-28 * s, -20 * s); // Jaw left
  ctx.lineTo(-38 * s, -45 * s); // Left cheek
  ctx.closePath();
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 3.5 * s;
  ctx.stroke();

  // Big Fierce Horns
  // Left Horn
  ctx.beginPath();
  ctx.moveTo(-30 * s, -50 * s);
  ctx.quadraticCurveTo(-75 * s, -95 * s, -85 * s, -120 * s);
  ctx.quadraticCurveTo(-60 * s, -85 * s, -18 * s, -58 * s);
  ctx.closePath();
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.strokeStyle = magmaGlow;
  ctx.lineWidth = 2 * s;
  ctx.stroke();

  // Right Horn
  ctx.beginPath();
  ctx.moveTo(30 * s, -50 * s);
  ctx.quadraticCurveTo(75 * s, -95 * s, 85 * s, -120 * s);
  ctx.quadraticCurveTo(60 * s, -85 * s, 18 * s, -58 * s);
  ctx.closePath();
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.strokeStyle = magmaGlow;
  ctx.lineWidth = 2 * s;
  ctx.stroke();

  // Glowing Dragon Eyes
  const eyeGlow = 0.8 + Math.sin(timeMs * 0.008) * 0.2;
  ctx.shadowColor = eyeColor;
  ctx.shadowBlur = 16 * eyeGlow;

  // Left Eye
  ctx.beginPath();
  ctx.moveTo(-22 * s, -48 * s);
  ctx.lineTo(-10 * s, -54 * s);
  ctx.lineTo(-14 * s, -44 * s);
  ctx.closePath();
  ctx.fillStyle = eyeColor;
  ctx.fill();

  // Right Eye
  ctx.beginPath();
  ctx.moveTo(22 * s, -48 * s);
  ctx.lineTo(10 * s, -54 * s);
  ctx.lineTo(14 * s, -44 * s);
  ctx.closePath();
  ctx.fillStyle = eyeColor;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Nostrils / Mouth with glowing breath embers
  ctx.beginPath();
  ctx.arc(-6 * s, -80 * s, 3 * s, 0, Math.PI * 2);
  ctx.arc(6 * s, -80 * s, 3 * s, 0, Math.PI * 2);
  ctx.fillStyle = magmaGlow;
  ctx.fill();

  // Snout lines
  ctx.beginPath();
  ctx.moveTo(0, -90 * s);
  ctx.lineTo(0, -60 * s);
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 2 * s;
  ctx.stroke();

  ctx.restore();

  ctx.restore();
}

/**
 * Helper to render a dragon wing with membranes and bone struts
 */
function drawDragonWing(
  ctx: CanvasRenderingContext2D,
  s: number,
  primary: string,
  secondary: string,
  glow: string,
  flip: boolean
) {
  const dir = flip ? 1 : -1;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(60 * dir * s, -110 * s, 140 * dir * s, -130 * s); // Main wing tip
  ctx.quadraticCurveTo(115 * dir * s, -60 * s, 125 * dir * s, -20 * s); // Claw 1
  ctx.quadraticCurveTo(90 * dir * s, 10 * s, 85 * dir * s, 40 * s); // Claw 2
  ctx.quadraticCurveTo(45 * dir * s, 30 * s, 0, 0); // Base
  ctx.closePath();

  // Wing membrane gradient
  const grad = ctx.createLinearGradient(0, 0, 120 * dir * s, -80 * s);
  grad.addColorStop(0, primary);
  grad.addColorStop(0.6, secondary);
  grad.addColorStop(1, glow);
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Wing bone struts
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(140 * dir * s, -130 * s);
  ctx.moveTo(40 * dir * s, -45 * s);
  ctx.lineTo(125 * dir * s, -20 * s);
  ctx.moveTo(30 * dir * s, -10 * s);
  ctx.lineTo(85 * dir * s, 40 * s);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4 * s;
  ctx.stroke();
}

/**
 * Render Fruit Ninja Lightsaber Slash Trail (Wider, glowing, and intense)
 */
export function drawSlashTrail(
  ctx: CanvasRenderingContext2D,
  trail: TimedPoint[],
  saberConfig: SaberColorConfig
) {
  if (trail.length < 2) return;

  const now = Date.now();
  const activePoints = trail.filter((p) => now - p.time < 280);
  if (activePoints.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const total = activePoints.length - 1;

  // PASS 1: Broad Radiant Neon Glow Aura
  for (let i = 1; i < activePoints.length; i++) {
    const p0 = activePoints[i - 1];
    const p1 = activePoints[i];
    const progress = i / total;
    const ageAlpha = 1 - (now - p1.time) / 280;
    const alpha = Math.max(0, Math.min(1, progress * ageAlpha));

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = saberConfig.glowColor;
    ctx.lineWidth = 38 * alpha + 8;
    ctx.shadowColor = saberConfig.glowColor;
    ctx.shadowBlur = 36 * alpha;
    ctx.globalAlpha = alpha * 0.75;
    ctx.stroke();
  }

  // PASS 2: Middle Vibrant Plasma Flare
  for (let i = 1; i < activePoints.length; i++) {
    const p0 = activePoints[i - 1];
    const p1 = activePoints[i];
    const progress = i / total;
    const ageAlpha = 1 - (now - p1.time) / 280;
    const alpha = Math.max(0, Math.min(1, progress * ageAlpha));

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = saberConfig.sparkColor;
    ctx.lineWidth = 18 * alpha + 4;
    ctx.shadowColor = saberConfig.sparkColor;
    ctx.shadowBlur = 18 * alpha;
    ctx.globalAlpha = alpha * 0.85;
    ctx.stroke();
  }

  // PASS 3: Crisp Pure White-Hot Center Core
  for (let i = 1; i < activePoints.length; i++) {
    const p0 = activePoints[i - 1];
    const p1 = activePoints[i];
    const progress = i / total;
    const ageAlpha = 1 - (now - p1.time) / 280;
    const alpha = Math.max(0, Math.min(1, progress * ageAlpha));

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.strokeStyle = saberConfig.coreColor;
    ctx.lineWidth = 8 * alpha + 2;
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 12 * alpha;
    ctx.globalAlpha = alpha * 0.98;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw the Large, Cinematic Lightsaber as if held in the player's gripped hand
 * (gripX, gripY is the palm/grip anchor center)
 */
export function drawLightsaberBlade(
  ctx: CanvasRenderingContext2D,
  gripX: number,
  gripY: number,
  angle: number,
  saberConfig: SaberColorConfig,
  isSwinging: boolean,
  scale: number = 1.0,
  isClenchedFist: boolean = true
) {
  // Proportional sizing based on user hand size & LIGHTSABER_CONFIG
  const cfg = LIGHTSABER_CONFIG;
  const s = Math.max(cfg.minHandScale, Math.min(cfg.maxHandScale, scale)) * cfg.scaleMultiplier;
  const hiltBack = -cfg.hiltLength * 0.35 * s;
  const hiltLength = cfg.hiltLength * s;
  const hiltWidth = cfg.hiltWidth * s;
  const emitterX = hiltBack + hiltLength;
  const bladeLength = cfg.bladeLength * s;
  const bladeEnd = emitterX + bladeLength;
  const bladeWidth = (isSwinging ? cfg.bladeWidth * 1.2 : cfg.bladeWidth) * s;
  const glowBlur = (isSwinging ? cfg.glowBlur * 1.3 : cfg.glowBlur) * s;
  const coreWidth = cfg.coreWidth * s;

  ctx.save();
  ctx.translate(gripX, gripY);
  ctx.rotate(angle);

  // 1. Broad Neon Outer Bloom (Multi-layered aura)
  ctx.save();
  ctx.shadowColor = saberConfig.glowColor;
  ctx.shadowBlur = glowBlur;

  ctx.beginPath();
  ctx.moveTo(emitterX, -bladeWidth / 2);
  ctx.lineTo(bladeEnd - 18 * s, -bladeWidth / 2.2);
  // Rounded energy cap
  ctx.arc(bladeEnd - 18 * s, 0, bladeWidth / 2.2, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(emitterX, bladeWidth / 2);
  ctx.closePath();
  ctx.fillStyle = saberConfig.glowColor;
  ctx.globalAlpha = 0.9;
  ctx.fill();

  // Secondary soft outer edge for maximum neon radiance
  ctx.shadowBlur = glowBlur * 1.4;
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.restore();

  // 2. Intense White-Hot Pure Plasma Core
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(emitterX + 2 * s, -coreWidth / 2);
  ctx.lineTo(bladeEnd - 12 * s, -coreWidth / 3);
  ctx.arc(bladeEnd - 12 * s, 0, coreWidth / 3, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(emitterX + 2 * s, coreWidth / 2);
  ctx.closePath();
  ctx.fillStyle = saberConfig.coreColor;
  ctx.shadowColor = "#ffffff";
  ctx.shadowBlur = 20 * s;
  ctx.globalAlpha = 1.0;
  ctx.fill();

  // Core energy arc highlights
  ctx.beginPath();
  ctx.moveTo(emitterX + 10 * s, 0);
  ctx.lineTo(bladeEnd - 20 * s, 0);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(3, coreWidth * 0.45);
  ctx.stroke();
  ctx.restore();

  // 3. Heavy Machined Metallic Lightsaber Hilt
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1.0;

  const hideMiddleGrip = cfg.hideHiltUnderFist && isClenchedFist;

  if (!hideMiddleGrip) {
    // --- FULL HILT (When hand is open or pointing) ---
    // Main Cylindrical Body
    const hiltGrad = ctx.createLinearGradient(0, -hiltWidth / 2, 0, hiltWidth / 2);
    hiltGrad.addColorStop(0, "#cbd5e1");
    hiltGrad.addColorStop(0.2, "#f8fafc");
    hiltGrad.addColorStop(0.55, "#64748b");
    hiltGrad.addColorStop(0.85, "#1e293b");
    hiltGrad.addColorStop(1, "#0f172a");

    ctx.fillStyle = hiltGrad;
    ctx.fillRect(hiltBack, -hiltWidth / 2, hiltLength, hiltWidth);

    // Ergonomic Ribbed Grip Inlays (Where fingers wrap)
    ctx.fillStyle = "#090d16";
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(hiltBack + (14 + i * 8) * s, -hiltWidth / 2, 4.5 * s, hiltWidth);
    }

    // Silver grip separators
    ctx.fillStyle = "#94a3b8";
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(hiltBack + (19 + i * 8) * s, -hiltWidth / 2, 2 * s, hiltWidth);
    }
  } else {
    // --- FIST CLENCHED: Middle grip is hidden with soft fade into the hand! ---
    const hiltGrad = ctx.createLinearGradient(0, -hiltWidth / 2, 0, hiltWidth / 2);
    hiltGrad.addColorStop(0, "#cbd5e1");
    hiltGrad.addColorStop(0.2, "#f8fafc");
    hiltGrad.addColorStop(0.55, "#64748b");
    hiltGrad.addColorStop(0.85, "#1e293b");
    hiltGrad.addColorStop(1, "#0f172a");

    // 1. Pommel collar entering bottom of fist
    ctx.fillStyle = hiltGrad;
    ctx.fillRect(hiltBack, -hiltWidth / 2, 20 * s, hiltWidth);

    // Soft fade gradient into hand at bottom
    const pommelFade = ctx.createLinearGradient(hiltBack + 2 * s, 0, hiltBack + 20 * s, 0);
    pommelFade.addColorStop(0, "rgba(15, 23, 42, 0)");
    pommelFade.addColorStop(0.4, "rgba(15, 23, 42, 0.45)");
    pommelFade.addColorStop(0.8, "rgba(10, 15, 30, 0.85)");
    pommelFade.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = pommelFade;
    ctx.fillRect(hiltBack + 2 * s, -hiltWidth / 2 - 1, 18 * s, hiltWidth + 2);

    // 2. Emitter collar entering top of fist
    ctx.fillStyle = hiltGrad;
    ctx.fillRect(emitterX - 32 * s, -hiltWidth / 2, 32 * s, hiltWidth);

    // Soft fade gradient into hand at top
    const emitterFade = ctx.createLinearGradient(emitterX - 12 * s, 0, emitterX - 32 * s, 0);
    emitterFade.addColorStop(0, "rgba(15, 23, 42, 0)");
    emitterFade.addColorStop(0.4, "rgba(15, 23, 42, 0.45)");
    emitterFade.addColorStop(0.8, "rgba(10, 15, 30, 0.85)");
    emitterFade.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = emitterFade;
    ctx.fillRect(emitterX - 32 * s, -hiltWidth / 2 - 1, 20 * s, hiltWidth + 2);
  }

  // Gold Activation Matrix Switch (Near emitter)
  ctx.fillStyle = "#d97706";
  ctx.fillRect(emitterX - 22 * s, -hiltWidth / 2 - 3.5 * s, 14 * s, 6 * s);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(emitterX - 20 * s, -hiltWidth / 2 - 2.5 * s, 10 * s, 4 * s);

  // Emitter Shroud & Flange (Front Claws sticking out of top of fist)
  ctx.fillStyle = "#334155";
  ctx.fillRect(emitterX - 16 * s, -hiltWidth / 2 - 3.5 * s, 16 * s, hiltWidth + 7 * s);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(emitterX - 6 * s, -hiltWidth / 2 - 2.5 * s, 6 * s, hiltWidth + 5 * s);

  // Emitter angled shroud bevel
  ctx.beginPath();
  ctx.moveTo(emitterX - 16 * s, -hiltWidth / 2 - 3.5 * s);
  ctx.lineTo(emitterX, -hiltWidth / 2 - 1.5 * s);
  ctx.lineTo(emitterX - 8 * s, -hiltWidth / 2 + 4 * s);
  ctx.closePath();
  ctx.fillStyle = "#475569";
  ctx.fill();

  // Pommel End Cap & D-Ring (Base sticking out of bottom of fist near wrist)
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(hiltBack - 8 * s, -hiltWidth / 2 - 2.5 * s, 8 * s, hiltWidth + 5 * s);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(hiltBack - 8 * s, 0, 9 * s, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.stroke();

  ctx.restore();

  ctx.restore();
}

/**
 * Draw incoming fireballs that player can slice
 */
export function drawFireballs(ctx: CanvasRenderingContext2D, fireballs: Fireball[]) {
  for (const fb of fireballs) {
    ctx.save();
    ctx.translate(fb.x, fb.y);
    ctx.rotate(fb.rotation);

    // Outer plasma corona
    ctx.shadowColor = "#ff4500";
    ctx.shadowBlur = 24;

    const radGrad = ctx.createRadialGradient(0, 0, fb.r * 0.2, 0, 0, fb.r);
    radGrad.addColorStop(0, "#ffffff");
    radGrad.addColorStop(0.3, "#fef08a");
    radGrad.addColorStop(0.7, "#f97316");
    radGrad.addColorStop(1, "rgba(220, 38, 38, 0)");

    ctx.beginPath();
    ctx.arc(0, 0, fb.r, 0, Math.PI * 2);
    ctx.fillStyle = radGrad;
    ctx.fill();

    // Trailing flame orbs
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + fb.rotation * 2;
      const dist = fb.r * 0.55;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, fb.r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
    }

    ctx.restore();
  }
}

/**
 * Draw sliced fireball shards
 */
export function drawFireballPieces(ctx: CanvasRenderingContext2D, pieces: FireballPiece[]) {
  for (const p of pieces) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = Math.max(0, p.life);

    ctx.shadowColor = "#f97316";
    ctx.shadowBlur = 12 * p.life;

    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI); // Half circle slice
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Draw combat particles (sparks, embers, crit shards)
 */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: SlashParticle[]) {
  for (const p of particles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;

    if (p.shape === "spark") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(-p.vx * 3, -p.vy * 3);
      ctx.lineTo(p.vx * 2, p.vy * 2);
      ctx.stroke();
    } else if (p.shape === "shard") {
      if (p.rotation) ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
    } else {
      // Ember
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/**
 * Draw Floating Damage Text with bouncy scaling and neon glow
 */
export function drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]) {
  for (const t of texts) {
    ctx.save();
    ctx.translate(t.x, t.y);
    const alpha = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = alpha;

    // Scale pop on spawn
    const scale = t.isCrit ? 1.4 + (1 - alpha) * 0.3 : 1.0;
    ctx.scale(scale, scale);

    ctx.font = t.isCrit ? "bold 26px sans-serif" : "900 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Text outline
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 5;
    ctx.strokeText(t.text, 0, 0);

    // Glowing fill
    ctx.shadowColor = t.color;
    ctx.shadowBlur = t.isCrit ? 20 : 10;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);

    ctx.restore();
  }
}
