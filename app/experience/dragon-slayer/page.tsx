"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dragonAudio } from "@/lib/dragon-slayer/audio-engine";
import {
  drawDragon,
  drawFireballPieces,
  drawFireballs,
  drawFloatingTexts,
  drawLightsaberBlade,
  drawParticles,
  drawSlashTrail,
  type DragonRenderState,
} from "@/lib/dragon-slayer/dragon-graphics";
import {
  calculateDamage,
  getNextId,
  SABER_COLORS,
  segmentHitsCircle,
  segmentHitsDragonHitbox,
  type DamageResult,
  type Fireball,
  type FireballPiece,
  type FloatingText,
  type Point2D,
  type SaberColorKey,
  type SlashParticle,
  type TimedPoint,
} from "@/lib/dragon-slayer/game-logic";
import { LIGHTSABER_CONFIG } from "@/lib/dragon-slayer/saber-config";
import {
  MAX_TRACKED_HANDS,
  useHandsTracking,
} from "@/lib/hands/useHandsTracking";

const DRAGON_MAX_HP = 100;
const SWORD_SLASH_MIN_PX = 5;
const HIT_COOLDOWN_MS = 120;

export default function DragonSlayerPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Game UI State
  const [dragonHp, setDragonHp] = useState<number>(DRAGON_MAX_HP);
  const [gameState, setGameState] = useState<"ready" | "battle" | "victory">("ready");
  const [saberColorKey, setSaberColorKey] = useState<SaberColorKey>("cyan");
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [cameraOpacity, setCameraOpacity] = useState<number>(0.4);
  const [combo, setCombo] = useState(0);
  const [critCount, setCritCount] = useState(0);
  const [totalHits, setTotalHits] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [battleStartTime, setBattleStartTime] = useState<number>(0);
  const [battleDuration, setBattleDuration] = useState<number>(0);

  // Live Game Loop Refs
  const dragonHpRef = useRef<number>(DRAGON_MAX_HP);
  const gameStateRef = useRef<"ready" | "battle" | "victory">("ready");
  const saberColorKeyRef = useRef<SaberColorKey>("cyan");
  const isAudioMutedRef = useRef(false);
  const comboRef = useRef(0);
  const lastHitTimeRef = useRef(0);

  // Entities Refs
  const fireballsRef = useRef<Fireball[]>([]);
  const fireballPiecesRef = useRef<FireballPiece[]>([]);
  const particlesRef = useRef<SlashParticle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const lastFireballSpawnRef = useRef(0);

  // Dragon Animation State
  const dragonStateRef = useRef<DragonRenderState>({
    x: 0,
    y: 0,
    scale: 1,
    hp: DRAGON_MAX_HP,
    maxHp: DRAGON_MAX_HP,
    phase: 1,
    hitStagger: 0,
    hitFlashTimer: 0,
    isDead: false,
    deathProgress: 0,
    breathCharge: 0,
  });

  // Hand tracking trails (up to 2 hands for dual-wielding lightsabers!)
  const handSwordTrailsRef = useRef<TimedPoint[][]>(
    Array.from({ length: MAX_TRACKED_HANDS }, () => [])
  );
  const prevHandSwordTipsRef = useRef<(TimedPoint | null)[]>(
    Array.from({ length: MAX_TRACKED_HANDS }, () => null)
  );
  const smoothedHandPosRef = useRef<({ x: number; y: number; angle: number; scale: number } | null)[]>(
    Array.from({ length: MAX_TRACKED_HANDS }, () => null)
  );

  // Sync state to refs
  useEffect(() => {
    dragonHpRef.current = dragonHp;
  }, [dragonHp]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    saberColorKeyRef.current = saberColorKey;
  }, [saberColorKey]);

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
    dragonAudio.setMuted(isAudioMuted);
  }, [isAudioMuted]);

  // Hand tracking hook using MediaPipe Hands
  const handleHandError = useCallback((msg: string) => {
    console.error("Hand tracking error:", msg);
  }, []);

  const {
    bindVideoRef,
    handCount,
    handDetected,
    ready: handsReady,
    error: handsError,
    getHandPoses,
  } = useHandsTracking({
    videoRef,
    enabled: true,
    onError: handleHandError,
  });

  // Start the battle
  const startBattle = () => {
    dragonAudio.init();
    dragonAudio.playIgnition();
    dragonAudio.playDragonRoar(false);

    setDragonHp(DRAGON_MAX_HP);
    dragonHpRef.current = DRAGON_MAX_HP;
    setGameState("battle");
    gameStateRef.current = "battle";
    setCombo(0);
    comboRef.current = 0;
    setCritCount(0);
    setTotalHits(0);
    setMaxSpeed(0);
    setCurrentSpeed(0);

    const now = Date.now();
    setBattleStartTime(now);
    lastFireballSpawnRef.current = now;

    dragonStateRef.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.32,
      scale: 1,
      hp: DRAGON_MAX_HP,
      maxHp: DRAGON_MAX_HP,
      phase: 1,
      hitStagger: 0,
      hitFlashTimer: 0,
      isDead: false,
      deathProgress: 0,
      breathCharge: 0,
    };

    fireballsRef.current = [];
    fireballPiecesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
  };

  // Spawn dynamic fireball attacks from Dragon
  const spawnFireball = (dragonX: number, dragonY: number) => {
    const targetX = window.innerWidth * (0.2 + Math.random() * 0.6);
    const targetY = window.innerHeight * 0.85;

    const angle = Math.atan2(targetY - dragonY, targetX - dragonX);
    const speed = 3.2 + Math.random() * 2.0;

    const fb: Fireball = {
      id: getNextId(),
      x: dragonX,
      y: dragonY + 50,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 24,
      life: 1.0,
      rotation: 0,
      color: "#ff4500",
    };

    fireballsRef.current.push(fb);
  };

  // Handle cutting a fireball in half (Fruit Ninja mechanic)
  const handleFireballSlice = (fb: Fireball, hitPoint: Point2D) => {
    dragonAudio.playFireballSlice();

    // Spawn slice pieces
    const leftPiece: FireballPiece = {
      id: getNextId(),
      x: fb.x - 8,
      y: fb.y,
      vx: -2.5 - Math.random() * 2,
      vy: -1.5 - Math.random() * 2,
      r: fb.r * 0.75,
      rotation: 0,
      rotSpeed: -0.1,
      life: 1.0,
      color: "#f97316",
    };
    const rightPiece: FireballPiece = {
      id: getNextId(),
      x: fb.x + 8,
      y: fb.y,
      vx: 2.5 + Math.random() * 2,
      vy: -1.5 - Math.random() * 2,
      r: fb.r * 0.75,
      rotation: 0,
      rotSpeed: 0.1,
      life: 1.0,
      color: "#f97316",
    };
    fireballPiecesRef.current.push(leftPiece, rightPiece);

    // Floating text
    floatingTextsRef.current.push({
      id: getNextId(),
      text: "DEFLECTED! ⚡",
      x: hitPoint.x,
      y: hitPoint.y - 20,
      color: "#38bdf8",
      size: 18,
      vy: -1.5,
      vx: 0,
      life: 1.0,
      maxLife: 1.0,
      isCrit: false,
    });

    // Sparks
    for (let i = 0; i < 12; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pSpeed = 2 + Math.random() * 4;
      particlesRef.current.push({
        id: getNextId(),
        x: hitPoint.x,
        y: hitPoint.y,
        vx: Math.cos(pAngle) * pSpeed,
        vy: Math.sin(pAngle) * pSpeed,
        color: "#f59e0b",
        size: 3 + Math.random() * 3,
        life: 1,
        maxLife: 1,
        shape: "spark",
      });
    }
  };

  // Handle slashing the Dragon Boss
  const handleDragonSlash = (
    hitPoint: Point2D,
    speed: number,
    saberConfig = SABER_COLORS[saberColorKeyRef.current]
  ) => {
    const now = Date.now();
    if (now - lastHitTimeRef.current < HIT_COOLDOWN_MS) {
      return;
    }
    lastHitTimeRef.current = now;

    // Roll damage & 20% critical strike
    const result: DamageResult = calculateDamage(speed);
    const newHp = Math.max(0, dragonHpRef.current - result.totalDamage);

    setDragonHp(newHp);
    dragonHpRef.current = newHp;
    dragonStateRef.current.hp = newHp;
    dragonStateRef.current.hitStagger = 1.0;
    dragonStateRef.current.hitFlashTimer = 1.0;

    // Audio SFX
    dragonAudio.playClash(result.isCritical);

    // Combo system
    const newCombo = comboRef.current + 1;
    comboRef.current = newCombo;
    setCombo(newCombo);
    setTotalHits((prev) => prev + 1);
    if (result.isCritical) {
      setCritCount((prev) => prev + 1);
    }
    setMaxSpeed((prev) => Math.max(prev, speed));

    // Phase checks
    if (newHp <= 60 && dragonStateRef.current.phase === 1) {
      dragonStateRef.current.phase = 2;
      dragonAudio.playDragonRoar(true);
      floatingTextsRef.current.push({
        id: getNextId(),
        text: "PHASE II: ENRAGED! 🔥",
        x: dragonStateRef.current.x,
        y: dragonStateRef.current.y - 120,
        color: "#f97316",
        size: 24,
        vy: -2,
        vx: 0,
        life: 1.0,
        maxLife: 1.0,
        isCrit: false,
      });
    } else if (newHp <= 25 && dragonStateRef.current.phase === 2) {
      dragonStateRef.current.phase = 3;
      dragonAudio.playDragonRoar(true);
      floatingTextsRef.current.push({
        id: getNextId(),
        text: "PHASE III: BERSERK! ⚡",
        x: dragonStateRef.current.x,
        y: dragonStateRef.current.y - 120,
        color: "#a855f7",
        size: 26,
        vy: -2,
        vx: 0,
        life: 1.0,
        maxLife: 1.0,
        isCrit: false,
      });
    }

    // Victory check (HP = 0)
    if (newHp === 0 && gameStateRef.current !== "victory") {
      setGameState("victory");
      gameStateRef.current = "victory";
      dragonStateRef.current.isDead = true;
      dragonAudio.playVictory();
      setBattleDuration(Math.round((Date.now() - battleStartTime) / 1000));
    }

    // Floating Damage Number
    const textStr = result.isCritical
      ? `CRIT! -${result.totalDamage}`
      : result.speedTier === "fast"
      ? `FAST! -${result.totalDamage}`
      : `-${result.totalDamage}`;

    floatingTextsRef.current.push({
      id: getNextId(),
      text: textStr,
      x: hitPoint.x + (Math.random() - 0.5) * 40,
      y: hitPoint.y - 30,
      color: result.isCritical ? "#facc15" : result.speedTier === "fast" ? "#38bdf8" : "#ffffff",
      size: result.isCritical ? 28 : 20,
      vy: result.isCritical ? -3.0 : -2.0,
      vx: (Math.random() - 0.5) * 1.5,
      life: 1.0,
      maxLife: 1.0,
      isCrit: result.isCritical,
    });

    // Particle Burst
    const count = result.isCritical ? 36 : 20;
    for (let i = 0; i < count; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pSpeed = (result.isCritical ? 4 : 2) + Math.random() * (result.isCritical ? 7 : 4);
      particlesRef.current.push({
        id: getNextId(),
        x: hitPoint.x,
        y: hitPoint.y,
        vx: Math.cos(pAngle) * pSpeed,
        vy: Math.sin(pAngle) * pSpeed,
        color: result.isCritical
          ? "#facc15"
          : Math.random() > 0.4
          ? saberConfig.glowColor
          : "#ffffff",
        size: (result.isCritical ? 4 : 2.5) + Math.random() * 3.5,
        life: 1,
        maxLife: 1,
        shape: result.isCritical && Math.random() > 0.5 ? "shard" : "spark",
      });
    }
  };

  // Main Canvas Render & Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (dragonStateRef.current.x === 0) {
        dragonStateRef.current.x = window.innerWidth / 2;
        dragonStateRef.current.y = window.innerHeight * 0.32;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const render = (timeMs: number) => {
      const dt = Math.min(60, timeMs - lastTime);
      lastTime = timeMs;
      const now = Date.now();
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      const saberConfig = SABER_COLORS[saberColorKeyRef.current];

      // 1. UPDATE & DRAW DRAGON BOSS
      const ds = dragonStateRef.current;
      ds.x = w / 2;
      ds.y = h * 0.32;

      // Decay stagger / flash
      if (ds.hitStagger > 0) ds.hitStagger = Math.max(0, ds.hitStagger - dt * 0.006);
      if (ds.hitFlashTimer > 0) ds.hitFlashTimer = Math.max(0, ds.hitFlashTimer - dt * 0.008);

      if (ds.isDead) {
        ds.deathProgress = Math.min(1, ds.deathProgress + dt * 0.0006);
      }

      drawDragon(ctx, ds, timeMs);

      // 2. SPAWN FIREBALL ATTACKS DURING BATTLE
      if (gameStateRef.current === "battle" && !ds.isDead) {
        const spawnInterval = ds.phase === 3 ? 1400 : ds.phase === 2 ? 2200 : 3200;
        if (now - lastFireballSpawnRef.current > spawnInterval) {
          spawnFireball(ds.x, ds.y + 40);
          lastFireballSpawnRef.current = now;
        }
      }

      // 3. UPDATE FIREBALLS
      fireballsRef.current.forEach((fb) => {
        fb.x += fb.vx * (dt / 16.6);
        fb.y += fb.vy * (dt / 16.6);
        fb.rotation += 0.05;
      });
      // Remove offscreen
      fireballsRef.current = fireballsRef.current.filter(
        (fb) => fb.y < h + 100 && fb.x > -100 && fb.x < w + 100
      );

      // Update fireball cut pieces
      fireballPiecesRef.current.forEach((piece) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.2; // gravity
        piece.rotation += piece.rotSpeed;
        piece.life = Math.max(0, piece.life - dt * 0.002);
      });
      fireballPiecesRef.current = fireballPiecesRef.current.filter((p) => p.life > 0);

      // Update particles
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= dt * 0.0025;
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      // Update floating texts
      floatingTextsRef.current.forEach((ft) => {
        ft.y += ft.vy;
        ft.x += ft.vx;
        ft.life -= dt * 0.0016;
      });
      floatingTextsRef.current = floatingTextsRef.current.filter((ft) => ft.life > 0);

      // 4. DRAW FIREBALLS & SLICE PIECES
      drawFireballs(ctx, fireballsRef.current);
      drawFireballPieces(ctx, fireballPiecesRef.current);

      // 5. DRAW WEBCAM HAND TRACKING LIGHTSABERS (HELD INSIDE CLENCHED FIST FACING UP)
      if (handsReady) {
        const handSlots = getHandPoses();
        for (let i = 0; i < MAX_TRACKED_HANDS; i++) {
          if (i >= handSlots.length) {
            handSwordTrailsRef.current[i] = [];
            prevHandSwordTipsRef.current[i] = null;
            smoothedHandPosRef.current[i] = null;
            continue;
          }

          const slot = handSlots[i];
          if (!slot || (!slot.indexTip && !slot.wrist)) {
            handSwordTrailsRef.current[i] = [];
            prevHandSwordTipsRef.current[i] = null;
            smoothedHandPosRef.current[i] = null;
            continue;
          }

          // Extract landmark positions in mirrored canvas coordinates
          const wristX = slot.wrist ? (1 - slot.wrist.x) * w : null;
          const wristY = slot.wrist ? slot.wrist.y * h : null;
          const indexMcpX = slot.indexMcp ? (1 - slot.indexMcp.x) * w : null;
          const indexMcpY = slot.indexMcp ? slot.indexMcp.y * h : null;
          const thumbMcpX = slot.thumbMcp ? (1 - slot.thumbMcp.x) * w : null;
          const thumbMcpY = slot.thumbMcp ? slot.thumbMcp.y * h : null;
          const middleMcpX = slot.middleMcp ? (1 - slot.middleMcp.x) * w : null;
          const middleMcpY = slot.middleMcp ? slot.middleMcp.y * h : null;
          const pinkyMcpX = slot.pinkyMcp ? (1 - slot.pinkyMcp.x) * w : null;
          const pinkyMcpY = slot.pinkyMcp ? slot.pinkyMcp.y * h : null;
          const indexTipX = slot.indexTip ? (1 - slot.indexTip.x) * w : null;
          const indexTipY = slot.indexTip ? slot.indexTip.y * h : null;

          // Compute Hand Physical Size / Camera Proximity Scale
          let handSpan = 110;
          if (middleMcpX !== null && wristX !== null) {
            handSpan = Math.hypot(middleMcpX - wristX, middleMcpY! - wristY!);
          } else if (indexMcpX !== null && wristX !== null) {
            handSpan = Math.hypot(indexMcpX - wristX, indexMcpY! - wristY!);
          }
          const cfg = LIGHTSABER_CONFIG;
          let handScale = cfg.autoScaleWithHand
            ? Math.max(cfg.minHandScale, Math.min(cfg.maxHandScale, handSpan / 80))
            : 1.0;

          // Detect whether hand is in a clenched fist
          let isClenchedFist = true;
          if (indexTipX !== null && indexMcpX !== null && wristX !== null) {
            const tipWristDist = Math.hypot(indexTipX - wristX, indexTipY! - wristY!);
            const mcpWristDist = Math.hypot(indexMcpX - wristX, indexMcpY! - wristY!);
            if (tipWristDist > mcpWristDist * 1.25) {
              isClenchedFist = false;
            }
          }

          // 1. Top of Fist (Thumb / Index Knuckles where the sword emerges UPWARDS)
          let topX = indexMcpX ?? indexTipX ?? w / 2;
          let topY = indexMcpY ?? indexTipY ?? h / 2;
          if (indexMcpX !== null && thumbMcpX !== null) {
            topX = indexMcpX * 0.65 + thumbMcpX * 0.35;
            topY = indexMcpY! * 0.65 + thumbMcpY! * 0.35;
          }

          // 2. Bottom of Fist (Pinky Knuckle / Base of Palm where pommel sits)
          let bottomX = pinkyMcpX ?? wristX ?? topX;
          let bottomY = pinkyMcpY ?? wristY ?? (topY + 90);
          if (pinkyMcpX !== null && wristX !== null) {
            bottomX = pinkyMcpX * 0.6 + wristX * 0.4;
            bottomY = pinkyMcpY! * 0.6 + wristY! * 0.4;
          }

          // 3. Grip Center (Anchored inside the fist / palm)
          let rawGripX = topX * 0.45 + bottomX * 0.55;
          let rawGripY = topY * 0.45 + bottomY * 0.55;
          if (middleMcpX !== null) {
            rawGripX = rawGripX * 0.6 + middleMcpX * 0.4;
            rawGripY = rawGripY * 0.6 + middleMcpY! * 0.4;
          }

          // Apply manual position offsets from LIGHTSABER_CONFIG
          rawGripX += cfg.handOffsetX;
          rawGripY += cfg.handOffsetY;

          // 4. Direction Vector (Points out of top of fist -> UPWARD into the air)
          let dirX = topX - bottomX;
          let dirY = topY - bottomY;

          // If index finger is explicitly pointing straight out
          if (!isClenchedFist && indexTipX !== null && indexMcpX !== null) {
            dirX = indexTipX - indexMcpX;
            dirY = indexTipY! - indexMcpY!;
          }

          // Invert if vector accidentally points downwards while forearm is upright
          if (wristY !== null && dirY > 0 && topY < wristY) {
            dirX = -dirX;
            dirY = -dirY;
          }

          // Default to upright (-90 deg) if too small
          if (Math.hypot(dirX, dirY) < 5) {
            dirX = 0;
            dirY = -1;
          }

          let rawAngle = Math.atan2(dirY, dirX) + ((cfg.angleOffsetDegrees || 0) * Math.PI) / 180;

          // Apply grip depth offset along the blade angle axis
          if (cfg.gripDepthOffset) {
            rawGripX += Math.cos(rawAngle) * cfg.gripDepthOffset * handScale;
            rawGripY += Math.sin(rawAngle) * cfg.gripDepthOffset * handScale;
          }

          // 5. Exponential Smoothing for Jitter-Free Grip & Rotation
          let gripX = rawGripX;
          let gripY = rawGripY;
          let angle = rawAngle;

          const prevSmooth = smoothedHandPosRef.current[i];
          if (!prevSmooth) {
            smoothedHandPosRef.current[i] = { x: rawGripX, y: rawGripY, angle: rawAngle, scale: handScale };
          } else {
            gripX = prevSmooth.x * 0.2 + rawGripX * 0.8;
            gripY = prevSmooth.y * 0.2 + rawGripY * 0.8;
            let dAngle = rawAngle - prevSmooth.angle;
            while (dAngle > Math.PI) dAngle -= Math.PI * 2;
            while (dAngle < -Math.PI) dAngle += Math.PI * 2;
            angle = prevSmooth.angle + dAngle * 0.8;
            handScale = prevSmooth.scale * 0.25 + handScale * 0.75;
            smoothedHandPosRef.current[i] = { x: gripX, y: gripY, angle, scale: handScale };
          }

          // Dynamic reach matching the configured lightsaber dimensions
          const reachPx =
            (cfg.bladeLength + cfg.hiltLength * 0.65) * handScale * cfg.scaleMultiplier;
          const bladeTipX = gripX + Math.cos(angle) * reachPx;
          const bladeTipY = gripY + Math.sin(angle) * reachPx;
          const timedTip: TimedPoint = { x: bladeTipX, y: bladeTipY, time: now };

          const trail = handSwordTrailsRef.current[i];
          trail.push(timedTip);
          if (trail.length > 22) trail.shift();

          const prev = prevHandSwordTipsRef.current[i];
          if (prev) {
            const dist = Math.hypot(bladeTipX - prev.x, bladeTipY - prev.y);
            const dtSpeed = Math.max(1, now - prev.time);
            const speed = dist / dtSpeed;

            if (dist >= SWORD_SLASH_MIN_PX) {
              setCurrentSpeed(Math.round(speed * 10) / 10);
              dragonAudio.updateSwingVelocity(speed);

              if (gameStateRef.current === "battle") {
                // Check Dragon Hitbox Collision
                const dragonHit = segmentHitsDragonHitbox(
                  prev.x,
                  prev.y,
                  bladeTipX,
                  bladeTipY,
                  { x: dragonStateRef.current.x, y: dragonStateRef.current.y },
                  dragonStateRef.current.scale
                );

                if (dragonHit && dragonHit.hit) {
                  handleDragonSlash(dragonHit.hitPoint, speed, saberConfig);
                }

                // Check Fireball Collision
                fireballsRef.current = fireballsRef.current.filter((fb) => {
                  const hit = segmentHitsCircle(prev.x, prev.y, bladeTipX, bladeTipY, fb.x, fb.y, fb.r);
                  if (hit) {
                    handleFireballSlice(fb, { x: fb.x, y: fb.y });
                    return false;
                  }
                  return true;
                });
              }
            }
          }

          prevHandSwordTipsRef.current[i] = timedTip;

          // Draw Glowing Lightsaber & Trail held naturally inside clenched fist
          drawSlashTrail(ctx, trail, saberConfig);
          drawLightsaberBlade(ctx, gripX, gripY, angle, saberConfig, true, handScale, isClenchedFist);
        }
      }

      // 6. DRAW PARTICLES & FLOATING DAMAGE NUMBERS
      drawParticles(ctx, particlesRef.current);
      drawFloatingTexts(ctx, floatingTextsRef.current);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
    };
  }, [handsReady, getHandPoses]);

  const activeSaber = SABER_COLORS[saberColorKey];
  const hpPercent = Math.max(0, (dragonHp / DRAGON_MAX_HP) * 100);

  return (
    <main
      ref={containerRef}
      className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-zinc-950 text-white select-none touch-none"
    >
      {/* Background Ambience */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/40 via-zinc-950 to-black" />
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${activeSaber.glowColor} 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Webcam Video Feed - Mirrored behind canvas */}
      <video
        ref={bindVideoRef}
        muted
        playsInline
        autoPlay
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 pointer-events-none z-0"
        style={{
          transform: "scaleX(-1)",
          opacity: cameraOpacity,
        }}
      />

      {/* Main Game Rendering Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-10 touch-none pointer-events-none" />

      {/* TOP HUD: Boss Health Bar, Tracking Status & Controls */}
      <header className="relative z-30 flex flex-col items-center px-4 pt-4 sm:pt-6">
        <div className="flex w-full max-w-3xl items-center justify-between gap-2">
          <Link
            href="/experience"
            className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 backdrop-blur transition hover:border-zinc-700 hover:text-white"
          >
            ← Back
          </Link>

          {/* Hand Tracking Status Badge */}
          <div
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold backdrop-blur-md transition-all ${
              handsError
                ? "border-red-500/50 bg-red-500/20 text-red-200"
                : !handsReady
                ? "border-amber-500/50 bg-amber-500/20 text-amber-200 animate-pulse"
                : handDetected
                ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "border-cyan-500/40 bg-cyan-950/40 text-cyan-200 animate-pulse"
            }`}
          >
            {handsError ? (
              <span>⚠️ Camera Access Blocked</span>
            ) : !handsReady ? (
              <span>⏳ Initializing Camera &amp; AI Hand Tracking…</span>
            ) : handDetected ? (
              <span>
                🖐️ {handCount === 1 ? "1 Hand Tracked (Blade Active)" : "2 Hands Tracked (Dual Sabers Active!)"}
              </span>
            ) : (
              <span>🖐️ Hold your fist up in front of the camera</span>
            )}
          </div>

          {/* Quick Settings: Camera Opacity & Sound */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCameraOpacity(cameraOpacity === 0.4 ? 0.7 : cameraOpacity === 0.7 ? 0.15 : 0.4)}
              title="Cycle Camera Brightness"
              className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 backdrop-blur hover:text-white"
            >
              📹 {Math.round(cameraOpacity * 100)}%
            </button>

            <button
              type="button"
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              title="Toggle Sound Effects"
              className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 backdrop-blur transition hover:border-zinc-700 hover:text-white"
            >
              {isAudioMuted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>

        {/* Dragon Boss Status Bar */}
        <div className="mt-3 flex w-full max-w-xl flex-col items-center">
          <div className="flex w-full items-baseline justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-widest uppercase text-red-500">
                DRAK&apos;THAR THE IMMOLATOR
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  dragonHp <= 25
                    ? "bg-purple-600/30 text-purple-300 animate-pulse border border-purple-500/50"
                    : dragonHp <= 60
                    ? "bg-red-600/30 text-red-300 border border-red-500/50"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                {dragonHp <= 25 ? "Phase III: Berserk" : dragonHp <= 60 ? "Phase II: Enraged" : "Phase I"}
              </span>
            </div>
            <span className="font-mono text-xs font-bold text-zinc-300">
              {dragonHp} / {DRAGON_MAX_HP} HP
            </span>
          </div>

          {/* Health Bar Track */}
          <div className="relative mt-1.5 h-4 w-full overflow-hidden rounded-full border border-red-950 bg-zinc-900/90 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <div
              className={`h-full transition-all duration-300 ease-out ${
                dragonHp <= 25
                  ? "bg-gradient-to-r from-purple-600 via-fuchsia-500 to-rose-500 shadow-[0_0_15px_rgba(217,70,239,0.8)]"
                  : dragonHp <= 60
                  ? "bg-gradient-to-r from-amber-600 via-orange-500 to-red-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]"
                  : "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]"
              }`}
              style={{ width: `${hpPercent}%` }}
            />
            {/* Gloss highlight */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/30" />
          </div>
        </div>
      </header>

      {/* CENTER OVERLAYS: Ready / Victory / Combat HUD */}
      <div className="relative z-30 flex flex-1 flex-col items-center justify-center p-6 pointer-events-none">
        {gameState === "ready" && (
          <div className="flex flex-col items-center text-center max-w-md bg-zinc-950/85 border border-zinc-800/80 p-8 rounded-3xl backdrop-blur-xl shadow-2xl animate-fade-in pointer-events-auto">
            <div className="text-5xl mb-3 animate-bounce">🐲✨</div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
              Dragon Slayer
            </h1>
            <p className="mt-2 text-xs text-zinc-300 max-w-xs leading-relaxed">
              Clench your fist in front of the camera to grip your <strong className="text-cyan-400 font-bold">Lightsaber</strong>! Swing fast to deal 1–3 HP damage, deflect fireballs, and land 20% critical strikes!
            </p>

            {/* Lightsaber Color Picker */}
            <div className="mt-6 flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                Choose Your Kyber Crystal
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {(Object.keys(SABER_COLORS) as SaberColorKey[]).map((key) => {
                  const s = SABER_COLORS[key];
                  const isSelected = saberColorKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSaberColorKey(key)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? "border-2 shadow-lg"
                          : "border border-zinc-800 bg-zinc-900/60 opacity-60 hover:opacity-100"
                      }`}
                      style={{
                        borderColor: isSelected ? s.glowColor : undefined,
                        backgroundColor: isSelected ? `${s.glowColor}22` : undefined,
                        color: isSelected ? "#ffffff" : "#a1a1aa",
                        boxShadow: isSelected ? `0 0 15px ${s.glowColor}66` : undefined,
                      }}
                    >
                      <span>{s.icon}</span>
                      <span>{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={startBattle}
              className="mt-8 w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-8 py-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-cyan-950/40 transition hover:brightness-110 active:scale-95 cursor-pointer"
            >
              Ignite Blade &amp; Slay ⚡
            </button>
          </div>
        )}

        {gameState === "battle" && (
          <div className="absolute top-28 flex flex-col items-center pointer-events-none">
            {combo > 1 && (
              <div className="rounded-full bg-amber-500/20 border border-amber-500/40 px-4 py-1 text-xs font-black text-amber-300 backdrop-blur animate-pulse">
                🔥 {combo}x COMBO STRIKE!
              </div>
            )}
          </div>
        )}

        {gameState === "victory" && (
          <div className="flex flex-col items-center text-center max-w-md bg-zinc-950/90 border border-amber-500/40 p-8 rounded-3xl backdrop-blur-2xl shadow-[0_0_50px_rgba(245,158,11,0.25)] animate-fade-in pointer-events-auto">
            <div className="text-5xl mb-2">🏆👑</div>
            <h2 className="text-3xl font-black uppercase tracking-tight text-amber-400 sm:text-4xl">
              Dragon Slain!
            </h2>
            <p className="mt-1 text-xs text-zinc-300">
              You defeated Drak&apos;thar the Immolator using your lightsaber!
            </p>

            {/* Combat Scorecard */}
            <div className="mt-6 grid grid-cols-2 gap-3 w-full text-left">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total Slashes</span>
                <span className="text-xl font-black text-white font-mono">{totalHits}</span>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Critical Hits (20%)</span>
                <span className="text-xl font-black text-amber-400 font-mono">
                  {critCount} ({totalHits > 0 ? Math.round((critCount / totalHits) * 100) : 0}%)
                </span>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Max Slash Speed</span>
                <span className="text-xl font-black text-cyan-400 font-mono">{maxSpeed.toFixed(1)} px/ms</span>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block">Time to Slay</span>
                <span className="text-xl font-black text-white font-mono">{battleDuration}s</span>
              </div>
            </div>

            <button
              type="button"
              onClick={startBattle}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-4 text-sm font-black uppercase tracking-wider text-black shadow-xl shadow-amber-950/40 transition hover:brightness-110 active:scale-95 cursor-pointer font-sans"
            >
              Slay Again 🔄
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM HUD: Blade Selector, Slash Velocity Gauge & Instructions */}
      <footer className="relative z-30 flex flex-col items-center px-6 pb-6 pointer-events-auto">
        {gameState === "battle" && (
          <div className="mb-4 flex items-center gap-3">
            {/* Kyber Crystal Color Switcher */}
            <div className="flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-900/80 px-2.5 py-1.5 backdrop-blur">
              {(Object.keys(SABER_COLORS) as SaberColorKey[]).map((key) => {
                const s = SABER_COLORS[key];
                const isSelected = saberColorKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSaberColorKey(key);
                      dragonAudio.playIgnition();
                    }}
                    title={s.name}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      isSelected ? "scale-125 ring-2 ring-white shadow-lg" : "opacity-40 hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: s.glowColor,
                      boxShadow: isSelected ? `0 0 10px ${s.glowColor}` : undefined,
                    }}
                  />
                );
              })}
            </div>

            {/* Velocity / Speed Meter */}
            <div className="flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/80 px-3 py-1.5 text-xs backdrop-blur font-mono">
              <span className="text-zinc-500">SPEED:</span>
              <span
                className={`font-bold ${
                  currentSpeed > 1.3
                    ? "text-cyan-400"
                    : currentSpeed > 0.6
                    ? "text-emerald-400"
                    : "text-zinc-400"
                }`}
              >
                {currentSpeed.toFixed(1)} px/ms
              </span>
              <span className="text-[10px] text-zinc-500">
                {currentSpeed > 1.3 ? "(FAST: 2-3 DMG)" : currentSpeed > 0.6 ? "(MED: 1-3 DMG)" : "(SLOW: 1-2 DMG)"}
              </span>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-zinc-400">
          {handDetected
            ? "✨ Fist tracked! Swing your lightsaber to slash the dragon and deflect fireballs!"
            : "🖐️ Clench your hand in a fist in front of your camera to grip your lightsaber!"}
        </p>
      </footer>
    </main>
  );
}
