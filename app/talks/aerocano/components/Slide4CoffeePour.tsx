"use client";

import { useHandsTracking } from "@/lib/hands/useHandsTracking";
import { useCallback, useEffect, useRef, useState } from "react";

type LiquidParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  life: number;
};

export default function Slide4CoffeePour() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<LiquidParticle[]>([]);
  const rafRef = useRef<number>(0);

  // Pouring state variables
  const [waterAmount, setWaterAmount] = useState(0); // 0 to 50
  const [espressoAmount, setEspressoAmount] = useState(0); // 0 to 50
  const [pourOrder, setPourOrder] = useState<string[]>([]);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<"correct" | "incorrect" | null>(null);

  const [leftCupState, setLeftCupState] = useState({ x: 0, y: 0, angle: -Math.PI / 2, isPouring: false });
  const [rightCupState, setRightCupState] = useState({ x: 0, y: 0, angle: -Math.PI / 2, isPouring: false });

  const handleError = useCallback((message: string) => {
    console.error("Hand tracking error:", message);
  }, []);

  const {
    bindVideoRef,
    handCount,
    ready,
    error,
    getHandPoses,
  } = useHandsTracking({
    videoRef,
    enabled: true,
    onError: handleError,
  });

  // Handle game reset
  const handleReset = () => {
    setWaterAmount(0);
    setEspressoAmount(0);
    setPourOrder([]);
    setValidationMsg(null);
    setValidationStatus(null);
    particlesRef.current = [];
  };

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

    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(32, now - lastTime);
      lastTime = now;

      const w = window.innerWidth;
      const h = window.innerHeight;

      // Clear screen
      ctx.clearRect(0, 0, w, h);

      // Glass dimensions and position
      const glassW = 168;
      const glassH = 252;
      const glassX = w / 2;
      const glassY = h - 180;

      // Track poses
      const poses = getHandPoses();
      let leftFound = false;
      let rightFound = false;

      let currentLeftCup = { x: w * 0.25, y: h * 0.45, angle: -Math.PI / 2, isPouring: false };
      let currentRightCup = { x: w * 0.75, y: h * 0.45, angle: -Math.PI / 2, isPouring: false };

      for (const pose of poses) {
        if (!pose.middleMcp || !pose.ringMcp || !pose.wrist) {
          // Fallback to index tip/dip
          if (!pose.indexTip || !pose.indexDip) continue;
          const x_canvas = (1 - pose.indexTip.x) * w;
          const y_canvas = pose.indexTip.y * h;
          const dip_x_canvas = (1 - pose.indexDip.x) * w;
          const dip_y_canvas = pose.indexDip.y * h;
          const angle = Math.atan2(y_canvas - dip_y_canvas, x_canvas - dip_x_canvas);

          if (x_canvas < w / 2) {
            leftFound = true;
            const isPouring = angle > -Math.PI / 3;
            currentLeftCup = { x: x_canvas, y: y_canvas, angle, isPouring };
          } else {
            rightFound = true;
            const isPouring = angle < -2 * Math.PI / 3;
            currentRightCup = { x: x_canvas, y: y_canvas, angle, isPouring };
          }
          continue;
        }

        // Center of hand (midpoint between middle finger MCP [9] and ring finger MCP [13])
        const cx = (pose.middleMcp.x + pose.ringMcp.x) / 2;
        const cy = (pose.middleMcp.y + pose.ringMcp.y) / 2;
        const x_canvas = (1 - cx) * w;
        const y_canvas = cy * h;

        // Wrist coordinate
        const wrist_x = (1 - pose.wrist.x) * w;
        const wrist_y = pose.wrist.y * h;

        // Angle of palm rotation (wrist -> palm center)
        const angle = Math.atan2(y_canvas - wrist_y, x_canvas - wrist_x);

        if (x_canvas < w / 2) {
          leftFound = true;
          const isPouring = angle > -Math.PI / 3;
          currentLeftCup = { x: x_canvas, y: y_canvas, angle, isPouring };
        } else {
          rightFound = true;
          const isPouring = angle < -2 * Math.PI / 3;
          currentRightCup = { x: x_canvas, y: y_canvas, angle, isPouring };
        }
      }

      setLeftCupState(currentLeftCup);
      setRightCupState(currentRightCup);

      // Game Logic & Glass fill rates
      if (validationStatus === null) {
        if (leftFound && currentLeftCup.isPouring && waterAmount < 50) {
          setWaterAmount((prev) => {
            const next = Math.min(50, prev + dt * 0.05);
            if (next > 0) {
              setPourOrder((ord) => (ord.includes("water") ? ord : [...ord, "water"]));
            }
            return next;
          });

          // Generate water particles (from top-right lip of 3x cup, shifted for handle grab)
          const drawAngle = currentLeftCup.angle + Math.PI / 2;
          const pourX = currentLeftCup.x + 210 * Math.cos(drawAngle) + 90 * Math.sin(drawAngle);
          const pourY = currentLeftCup.y + 210 * Math.sin(drawAngle) - 90 * Math.cos(drawAngle);
          particlesRef.current.push({
            x: pourX,
            y: pourY,
            vx: (Math.random() - 0.5) * 1 + 2,
            vy: 2 + Math.random() * 2,
            color: "#38bdf8",
            radius: 3 + Math.random() * 3,
            life: 1,
          });
        }

        if (rightFound && currentRightCup.isPouring && espressoAmount < 50) {
          setEspressoAmount((prev) => {
            const next = Math.min(50, prev + dt * 0.05);
            if (next > 0) {
              setPourOrder((ord) => (ord.includes("espresso") ? ord : [...ord, "espresso"]));
            }
            return next;
          });

          // Generate espresso particles (from top-left lip of 3x cup, shifted for handle grab)
          const drawAngle = currentRightCup.angle + Math.PI / 2;
          const pourX = currentRightCup.x - 210 * Math.cos(drawAngle) + 90 * Math.sin(drawAngle);
          const pourY = currentRightCup.y - 210 * Math.sin(drawAngle) - 90 * Math.cos(drawAngle);
          particlesRef.current.push({
            x: pourX,
            y: pourY,
            vx: (Math.random() - 0.5) * 1 - 2,
            vy: 2 + Math.random() * 2,
            color: "#854d0e",
            radius: 3 + Math.random() * 3,
            life: 1,
          });
        }
      }

      // Check results
      if (waterAmount >= 45 && espressoAmount >= 45 && validationStatus === null) {
        if (pourOrder[0] === "water") {
          setValidationStatus("correct");
          setValidationMsg("Correct! That's an americano");
        } else {
          setValidationStatus("incorrect");
          setValidationMsg("Uh oh, that's not americano");
        }
      }

      // Update particles
      particlesRef.current = particlesRef.current
        .map((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.25; // gravity
          p.life -= 0.015;

          // Check collision with central glass
          if (
            p.x > glassX - glassW / 2 &&
            p.x < glassX + glassW / 2 &&
            p.y > glassY - glassH &&
            p.y < glassY
          ) {
            p.life = 0; // absorb particle
          }
          return p;
        })
        .filter((p) => p.life > 0 && p.y < h);

      // Draw Glass
      ctx.save();
      // Backdrop shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = 10;

      // Draw liquid in glass
      const totalAmount = waterAmount + espressoAmount; // max 100
      const fillHeight = totalAmount > 0 ? (glassH * (totalAmount / 100) - 6) : 0;
      const surfaceY = glassY - fillHeight;

      if (totalAmount > 0) {
        ctx.beginPath();
        ctx.moveTo(glassX - glassW / 2 + 6, glassY - 3);
        ctx.lineTo(glassX + glassW / 2 - 6, glassY - 3);
        ctx.lineTo(glassX + glassW / 2 - 6, surfaceY);
        ctx.lineTo(glassX - glassW / 2 + 6, surfaceY);
        ctx.closePath();

        if (espressoAmount === 0) {
          // Pure water (translucent light blue)
          ctx.fillStyle = "rgba(56, 189, 248, 0.65)";
          ctx.fill();
        } else {
          // Iced Americano (Rich warm translucent coffee brown)
          ctx.fillStyle = "rgba(62, 39, 22, 0.88)";
          ctx.fill();

          // Golden Crema Layer at the top of the coffee
          ctx.fillStyle = "rgba(198, 164, 126, 0.85)";
          ctx.fillRect(glassX - glassW / 2 + 6, surfaceY, glassW - 12, Math.min(15, fillHeight));
        }
      }

      // Draw Ice Cubes inside the glass (they float when liquid is present)
      const currentTime = performance.now();
      const iceCubes = [
        { x: glassX - 22, baseYOffset: 25, floatOffset: 15, size: 28, angle: 0.2, phase: 0 },
        { x: glassX + 22, baseYOffset: 45, floatOffset: 40, size: 32, angle: -0.4, phase: 1 },
        { x: glassX - 8,  baseYOffset: 65, floatOffset: 65, size: 26, angle: 0.8, phase: 2 },
        { x: glassX + 10, baseYOffset: 85, floatOffset: 90, size: 30, angle: -0.1, phase: 3 },
      ];

      for (const ice of iceCubes) {
        // Calculate y coordinate based on floating formula
        const bob = totalAmount > 0 ? (Math.sin(currentTime * 0.003 + ice.phase) * 3) : 0;
        const targetY = Math.min(surfaceY + ice.floatOffset, glassY - ice.baseYOffset);
        const y = targetY + bob;

        drawIceCube(ctx, ice.x, y, ice.size, ice.angle);
      }

      // Draw glass frame
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 6;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(glassX - glassW / 2, glassY - glassH);
      ctx.lineTo(glassX - glassW / 2, glassY);
      ctx.lineTo(glassX + glassW / 2, glassY);
      ctx.lineTo(glassX + glassW / 2, glassY - glassH);
      ctx.stroke();

      // Draw liquid progress labels inside glass
      ctx.shadowBlur = 0;
      if (totalAmount > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.font = "bold 11px Inter";
        ctx.textAlign = "center";
        ctx.fillText(
          `Water: ${Math.round(waterAmount * 2)}% | Espresso: ${Math.round(espressoAmount * 2)}%`,
          glassX,
          glassY + 25
        );
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "12px Inter";
        ctx.textAlign = "center";
        ctx.fillText("AMERICANO GLASS", glassX, glassY - glassH / 2);
      }
      ctx.restore();

      // Draw liquid particles
      for (const p of particlesRef.current) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Draw Left Cup (Water)
      drawCup(ctx, currentLeftCup.x, currentLeftCup.y, currentLeftCup.angle, "#0ea5e9", "WATER", waterAmount, leftFound, "left");

      // Draw Right Cup (Espresso)
      drawCup(ctx, currentRightCup.x, currentRightCup.y, currentRightCup.angle, "#a16207", "ESPRESSO", espressoAmount, rightFound, "right");

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, waterAmount, espressoAmount, pourOrder, validationStatus, getHandPoses]);

  // Render a simple styled cup (scaled 3x, aligned to handle)
  function drawCup(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    color: string,
    label: string,
    amount: number,
    tracked: boolean,
    side: "left" | "right"
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);

    const w = 210;
    const h = 180;
    // Offset center of cup body so the handle aligns with the hand position at 0,0
    const cx = side === "left" ? w / 2 : -w / 2;

    // Draw cup glow if tracked
    if (tracked) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 45;
    }

    // Cup Body Outline
    ctx.strokeStyle = tracked ? "#ffffff" : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, -h / 2);
    ctx.lineTo(cx - w / 2 + 30, h / 2);
    ctx.lineTo(cx + w / 2 - 30, h / 2);
    ctx.lineTo(cx + w / 2, -h / 2);
    ctx.closePath();
    ctx.stroke();

    // Cup handle (centered around 0,0 to look grabbed by hand)
    ctx.beginPath();
    if (side === "left") {
      ctx.arc(-6, 0, 30, -Math.PI / 2, Math.PI / 2, true);
    } else {
      ctx.arc(6, 0, 30, -Math.PI / 2, Math.PI / 2, false);
    }
    ctx.stroke();

    // Draw liquid inside the cup
    const remaining = 50 - amount;
    if (remaining > 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      const fillH = h * (remaining / 50) - 12;
      ctx.moveTo(cx - w / 2 + 36, h / 2 - 9);
      ctx.lineTo(cx + w / 2 - 36, h / 2 - 9);
      ctx.lineTo(cx + w / 2 - 36 + (h/2 - fillH) * 0.15, h / 2 - fillH);
      ctx.lineTo(cx - w / 2 + 36 - (h/2 - fillH) * 0.15, h / 2 - fillH);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }

    // Label
    ctx.shadowBlur = 0;
    ctx.fillStyle = tracked ? "#ffffff" : "rgba(255, 255, 255, 0.4)";
    ctx.font = "bold 26px Inter";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, 0);

    ctx.restore();
  }

  // Render a simple styled ice cube
  function drawIceCube(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    angle: number
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Draw ice cube shape
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1.5;

    // Rounded rectangle path
    ctx.beginPath();
    const r = 5;
    ctx.moveTo(-size / 2 + r, -size / 2);
    ctx.lineTo(size / 2 - r, -size / 2);
    ctx.quadraticCurveTo(size / 2, -size / 2, size / 2, -size / 2 + r);
    ctx.lineTo(size / 2, size / 2 - r);
    ctx.quadraticCurveTo(size / 2, size / 2, size / 2 - r, size / 2);
    ctx.lineTo(-size / 2 + r, size / 2);
    ctx.quadraticCurveTo(-size / 2, size / 2, -size / 2, size / 2 - r);
    ctx.lineTo(-size / 2, -size / 2 + r);
    ctx.quadraticCurveTo(-size / 2, -size / 2, -size / 2 + r, -size / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw a diagonal reflection line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.moveTo(-size / 3, -size / 3);
    ctx.lineTo(size / 4, size / 4);
    ctx.stroke();

    ctx.restore();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black flex flex-col justify-between">
      {/* Background camera feed */}
      <video
        ref={bindVideoRef}
        muted
        playsInline
        autoPlay
        className="absolute inset-0 h-full w-full object-cover opacity-25"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Render Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-10 touch-none" />

      {/* Glassmorphic instruction header */}
      <div className="relative z-30 flex flex-col items-center p-6 pt-24 pointer-events-none w-full">
        <div
          className={`px-5 py-2.5 rounded-full border text-sm font-semibold tracking-wide backdrop-blur-md transition-all duration-300 ${
            handCount > 0
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : "border-white/20 bg-black/40 text-white/60"
          }`}
        >
          {handCount === 0
            ? "Raise hands to screen to start"
            : `${handCount} hand(s) tracked. Tilt hand to pour!`}
        </div>

        <p className="mt-4 text-center max-w-lg text-sm text-zinc-400 font-light">
          Use your left index finger to control the <span className="text-sky-400 font-medium">Water Cup</span>,
          and your right index finger for the <span className="text-amber-500 font-medium">Espresso Cup</span>.
        </p>
      </div>

      {/* Center Validation Card */}
      {validationMsg && (
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-fit px-8 py-5 rounded-2xl border backdrop-blur-xl animate-fade-in shadow-2xl flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            {validationStatus === "correct" ? (
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <h2
              className={`text-xl font-bold tracking-tight ${
                validationStatus === "correct" ? "text-emerald-400" : "text-rose-500"
              }`}
            >
              {validationMsg}
            </h2>
          </div>
          <p className="text-xs text-zinc-400 text-center">
            {validationStatus === "correct"
              ? "Americano is made by pouring hot water first, then extracting espresso over it!"
              : "Oops, pouring espresso first then adding water is a Long Black, not an Americano!"}
          </p>
        </div>
      )}

      {/* Reset control and loading indicators */}
      <div className="relative z-30 flex flex-col items-center p-8 pointer-events-none">
        {error ? (
          <p className="text-red-400 text-xs font-semibold mb-4 bg-red-950/40 border border-red-500/30 px-4 py-2 rounded-full">{error}</p>
        ) : !ready ? (
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/60 text-xs font-medium tracking-wide">Loading MediaPipe Hands…</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleReset}
            className="pointer-events-auto mb-6 px-6 py-2 rounded-full border border-white/20 hover:border-white/50 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xs font-semibold uppercase tracking-wider text-white"
          >
            Reset Simulation
          </button>
        )}
      </div>
    </div>
  );
}
