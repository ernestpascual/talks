"use client";

import ninjaQr from "@/app/talks/raw-school-2026/img/ninja.png";
import {
  FRUIT_COLORS,
  FRUIT_EMOJI,
  FRUIT_PULP,
  FRUIT_SPEED,
  SWORD_BLADE_LEN,
  SWORD_GUARD_W,
  SWORD_HANDLE_LEN,
  SWORD_SIZE,
  TRAIL_OPACITY,
  segmentHitsCircle,
  slashAngleFromSegment,
  sliceFruit,
  spawnFruit,
  swordAngleFromPose,
  swordBaseCanvas,
  swordTipCanvas,
  type CanvasPoint,
  type Fruit,
  type FruitPiece,
  type SlashSpark,
} from "@/lib/fruit-ninja/game-logic";
import {
  MAX_TRACKED_HANDS,
  useHandsTracking,
} from "@/lib/hands/useHandsTracking";
import { useCallback, useEffect, useRef, useState } from "react";
import QrOverlay from "./QrOverlay";

const GRAVITY = 0.13;
const SPAWN_MS = 1300;
const TRAIL_LENGTH = 12;
const SWORD_SLASH_MIN_PX = 4;

export default function Slide9FruitNinja() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fruitsRef = useRef<Fruit[]>([]);
  const piecesRef = useRef<FruitPiece[]>([]);
  const sparksRef = useRef<SlashSpark[]>([]);
  const scoreRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const rafRef = useRef(0);
  const swordTrailsRef = useRef<CanvasPoint[][]>(
    Array.from({ length: MAX_TRACKED_HANDS }, () => []),
  );
  const prevSwordTipsRef = useRef<(CanvasPoint | null)[]>(
    Array.from({ length: MAX_TRACKED_HANDS }, () => null),
  );

  const [score, setScore] = useState(0);
  const [started, setStarted] = useState(false);

  const handleError = useCallback((message: string) => {
    console.error(message);
  }, []);

  const {
    bindVideoRef,
    handCount,
    handDetected,
    ready,
    error,
    getSwordPoses,
  } = useHandsTracking({
    videoRef,
    enabled: true,
    onError: handleError,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      const w = window.innerWidth;
      const h = window.innerHeight;

      if (started) {
        spawnTimerRef.current += dt;
        if (spawnTimerRef.current >= SPAWN_MS) {
          spawnTimerRef.current = 0;
          fruitsRef.current.push(spawnFruit(w, h));
        }
      }

      const poses = getSwordPoses();

      for (let i = 0; i < MAX_TRACKED_HANDS; i++) {
        if (i >= poses.length) {
          swordTrailsRef.current[i] = [];
          prevSwordTipsRef.current[i] = null;
          continue;
        }

        const pose = poses[i]!;
        const bladeTip = swordTipCanvas(pose, w, h);
        const trail = swordTrailsRef.current[i]!;
        trail.push(bladeTip);
        if (trail.length > TRAIL_LENGTH) trail.shift();

        const prev = prevSwordTipsRef.current[i];
        if (started && prev) {
          const dx = bladeTip.x - prev.x;
          const dy = bladeTip.y - prev.y;
          if (Math.hypot(dx, dy) >= SWORD_SLASH_MIN_PX) {
            const angle = slashAngleFromSegment(
              prev.x,
              prev.y,
              bladeTip.x,
              bladeTip.y,
            );

            fruitsRef.current = fruitsRef.current.filter((fruit) => {
              const hit = segmentHitsCircle(
                prev.x,
                prev.y,
                bladeTip.x,
                bladeTip.y,
                fruit.x,
                fruit.y,
                fruit.r,
              );
              if (hit) {
                const midX = (prev.x + bladeTip.x) / 2;
                const midY = (prev.y + bladeTip.y) / 2;
                piecesRef.current.push(...sliceFruit(fruit, angle, midX, midY));
                sparksRef.current.push({
                  id: performance.now(),
                  x: midX,
                  y: midY,
                  angle,
                  life: 1,
                });
                scoreRef.current += 1;
                setScore(scoreRef.current);
                return false;
              }
              return true;
            });
          }
        }
        prevSwordTipsRef.current[i] = bladeTip;
      }

      fruitsRef.current = fruitsRef.current.filter((f) => {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += GRAVITY * 0.03 * dt * FRUIT_SPEED;
        f.rotation += f.rotSpeed * dt * 0.04;
        return f.y > -f.r * 2 && f.y < h + f.r * 2;
      });

      piecesRef.current = piecesRef.current
        .map((p) => {
          p.x += p.vx * dt * 0.08;
          p.y += p.vy * dt * 0.08;
          p.vy += GRAVITY * 0.04 * dt * FRUIT_SPEED;
          p.vx *= 1 - dt * 0.00015;
          p.rotation += p.rotSpeed * dt * 0.08;
          p.life -= dt * 0.0014;
          return p;
        })
        .filter((p) => p.life > 0 && p.y < h + 160);

      sparksRef.current = sparksRef.current
        .map((s) => ({ ...s, life: s.life - dt * 0.003 }))
        .filter((s) => s.life > 0);

      ctx.clearRect(0, 0, w, h);

      drawFruits(ctx, fruitsRef.current);
      drawPieces(ctx, piecesRef.current);

      for (const trail of swordTrailsRef.current) {
        drawSlashTrail(ctx, trail);
      }

      for (const pose of poses) {
        const base = swordBaseCanvas(pose, w, h);
        const angle = swordAngleFromPose(pose, w, h);
        drawSword(ctx, base.x, base.y, angle);
      }

      drawSparks(ctx, sparksRef.current);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, started, getSwordPoses]);

  function handleStart() {
    fruitsRef.current = [];
    piecesRef.current = [];
    sparksRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    spawnTimerRef.current = 0;
    swordTrailsRef.current = Array.from({ length: MAX_TRACKED_HANDS }, () => []);
    prevSwordTipsRef.current = Array.from(
      { length: MAX_TRACKED_HANDS },
      () => null,
    );
    setStarted(true);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <video
        ref={bindVideoRef}
        muted
        playsInline
        autoPlay
        className="absolute inset-0 h-full w-full object-cover opacity-30"
        style={{ transform: "scaleX(-1)" }}
      />

      <canvas ref={canvasRef} className="absolute inset-0 z-10 touch-none" />

      <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/50 via-transparent to-black/60" />

      <div className="relative z-30 flex min-h-screen flex-col p-6 pointer-events-none">
        <div
          className={`w-fit rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-md ${
            handDetected
              ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
              : "border-white/25 bg-black/50 text-white/70"
          }`}
        >
          {handCount === 0
            ? "Show up to 2 hands to camera"
            : handCount === 1
              ? "1 index finger tracked"
              : "2 index fingers tracked"}
        </div>

        {!started ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <p className="max-w-md text-center text-2xl font-light text-white sm:text-3xl">
              Slash the fruit — up to 2 index fingers
            </p>
            <button
              type="button"
              onClick={handleStart}
              disabled={!ready}
              className="pointer-events-auto rounded-full border border-white/30 bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wider text-black disabled:opacity-40"
            >
              Start
            </button>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="relative pb-2">
          {started ? (
            <p className="text-center text-sm text-white/60 sm:text-base">
              Put your index finger to slice
            </p>
          ) : null}
          <p className="absolute bottom-0 right-0 text-sm tabular-nums text-white/60 sm:text-base">
            {score} sliced
          </p>
        </div>

        {error ? (
          <p className="text-center text-sm text-red-300">{error}</p>
        ) : !ready ? (
          <p className="text-center text-sm text-white/50">Loading hand tracking…</p>
        ) : null}
      </div>

      <QrOverlay image={ninjaQr} ariaLabel="Ninja demo QR code" />
    </div>
  );
}

function drawFruits(ctx: CanvasRenderingContext2D, fruits: Fruit[]) {
  for (const f of fruits) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);
    ctx.font = `${f.r * 1.6}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(FRUIT_EMOJI[f.kind], 0, 0);
    ctx.restore();
  }
}

function traceShard(ctx: CanvasRenderingContext2D, verts: FruitPiece["localVerts"]) {
  if (verts.length < 2) return;
  ctx.moveTo(verts[0]!.x, verts[0]!.y);
  for (let i = 1; i < verts.length; i++) {
    ctx.lineTo(verts[i]!.x, verts[i]!.y);
  }
  ctx.closePath();
}

function drawBrokenPiece(ctx: CanvasRenderingContext2D, piece: FruitPiece) {
  const {
    x,
    y,
    rotation,
    life,
    kind,
    localVerts,
    originX,
    originY,
    originR,
    originRotation,
  } = piece;
  const alpha = Math.max(0, life);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.beginPath();
  traceShard(ctx, localVerts);
  ctx.fillStyle = FRUIT_PULP[kind];
  ctx.globalAlpha = alpha * 0.9;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  traceShard(ctx, localVerts);
  ctx.clip();
  ctx.rotate(-rotation);
  ctx.translate(originX - x, originY - y);
  ctx.rotate(originRotation);
  ctx.font = `${originR * 1.6}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = alpha;
  ctx.fillText(FRUIT_EMOJI[kind], 0, 0);
  ctx.restore();

  ctx.beginPath();
  traceShard(ctx, localVerts);
  ctx.strokeStyle = `rgba(255,255,255,${0.55 * alpha})`;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = FRUIT_COLORS[kind];
  ctx.globalAlpha = alpha * 0.85;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = `rgba(0,0,0,${0.3 * alpha})`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawPieces(ctx: CanvasRenderingContext2D, pieces: FruitPiece[]) {
  for (const p of pieces) {
    drawBrokenPiece(ctx, p);
  }
}

/** Sword base (handle) at index fingertip; blade extends along the finger. */
function drawSword(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
) {
  const s = SWORD_SIZE;
  const bladeLen = SWORD_BLADE_LEN * s;
  const handleLen = SWORD_HANDLE_LEN * s;
  const guardW = SWORD_GUARD_W * s;
  const bladeStart = handleLen + guardW;

  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);
  ctx.shadowColor = "rgba(180, 210, 255, 0.85)";
  ctx.shadowBlur = 14 * s;

  // Handle — grip anchored at fingertip (origin)
  ctx.fillStyle = "#3d2b1f";
  ctx.fillRect(0, -6 * s, handleLen, 12 * s);
  ctx.fillStyle = "#5c4033";
  ctx.beginPath();
  ctx.arc(6 * s, 0, 7 * s, 0, Math.PI * 2);
  ctx.fill();

  // Crossguard
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#d4af37";
  ctx.fillRect(handleLen, -14 * s, guardW, 28 * s);
  ctx.strokeStyle = "rgba(255,220,120,0.6)";
  ctx.strokeRect(handleLen, -14 * s, guardW, 28 * s);

  // Blade — extends forward along the finger
  const bladeEnd = bladeStart + bladeLen;
  const blade = ctx.createLinearGradient(bladeStart, 0, bladeEnd, 0);
  blade.addColorStop(0, "#9aa8c4");
  blade.addColorStop(0.65, "#e8eeff");
  blade.addColorStop(1, "#ffffff");
  ctx.fillStyle = blade;
  ctx.beginPath();
  ctx.moveTo(bladeStart, -5 * s);
  ctx.lineTo(bladeEnd, 0);
  ctx.lineTo(bladeStart, 5 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = Math.max(1, s);
  ctx.stroke();

  ctx.restore();
}

function drawSlashTrail(ctx: CanvasRenderingContext2D, trail: CanvasPoint[]) {
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const last = trail.length - 1;
  for (let i = 1; i < trail.length; i++) {
    const t0 = (i - 1) / last;
    const t1 = i / last;
    const alpha0 = t0 * TRAIL_OPACITY;
    const alpha1 = t1 * TRAIL_OPACITY;

    const grad = ctx.createLinearGradient(
      trail[i - 1]!.x,
      trail[i - 1]!.y,
      trail[i]!.x,
      trail[i]!.y,
    );
    grad.addColorStop(0, `rgba(255,255,255,${alpha0})`);
    grad.addColorStop(1, `rgba(255,255,255,${alpha1})`);

    ctx.strokeStyle = grad;
    ctx.shadowColor = `rgba(255,255,255,${alpha1 * 0.9})`;
    ctx.shadowBlur = 12 * alpha1;
    ctx.beginPath();
    ctx.moveTo(trail[i - 1]!.x, trail[i - 1]!.y);
    ctx.lineTo(trail[i]!.x, trail[i]!.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSparks(ctx: CanvasRenderingContext2D, sparks: SlashSpark[]) {
  for (const s of sparks) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = s.life;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();
    ctx.restore();
  }
}
