"use client";

import { useHandsTracking } from "@/lib/hands/useHandsTracking";
import { useCallback, useEffect, useRef, useState } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  life: number; // 1 down to 0
  type: "water" | "espresso" | "steam" | "aerocano";
};

type IceCubeConfig = {
  dx: number;
  restY: number;
  sz: number;
  rot: number;
  bobSpeed: number;
  bobOffset: number;
  floatDelay?: number;
};

const PITCHER_CUBES: IceCubeConfig[] = [
  // Bottom layer
  { dx: -18, restY: 34, sz: 12, rot: 0.25, bobSpeed: 0.002, bobOffset: 0, floatDelay: 0.1 },
  { dx: -6, restY: 36, sz: 11, rot: -0.15, bobSpeed: 0.0025, bobOffset: 1.5, floatDelay: 0.15 },
  { dx: 6, restY: 38, sz: 13, rot: 0.4, bobSpeed: 0.003, bobOffset: 3, floatDelay: 0.05 },
  { dx: 18, restY: 33, sz: 12, rot: -0.3, bobSpeed: 0.0022, bobOffset: 4.5, floatDelay: 0.2 },
  
  // Middle layer
  { dx: -12, restY: 24, sz: 12, rot: -0.2, bobSpeed: 0.0028, bobOffset: 0.8, floatDelay: 0.3 },
  { dx: 0, restY: 26, sz: 11, rot: 0.15, bobSpeed: 0.0032, bobOffset: 2.1, floatDelay: 0.25 },
  { dx: 12, restY: 25, sz: 13, rot: 0.45, bobSpeed: 0.0024, bobOffset: 3.7, floatDelay: 0.35 },

  // Top layer
  { dx: -6, restY: 14, sz: 11, rot: 0.3, bobSpeed: 0.0035, bobOffset: 1.2, floatDelay: 0.45 },
  { dx: 6, restY: 15, sz: 12, rot: -0.4, bobSpeed: 0.0027, bobOffset: 2.9, floatDelay: 0.4 },
  { dx: 0, restY: 4, sz: 11, rot: 0.1, bobSpeed: 0.0031, bobOffset: 5.1, floatDelay: 0.5 },
];

const STARBUCKS_CUBES: IceCubeConfig[] = [
  { dx: -14, restY: 10, sz: 11, rot: 0.2, bobSpeed: 0.002, bobOffset: 0 },
  { dx: 12, restY: 14, sz: 12, rot: -0.1, bobSpeed: 0.0025, bobOffset: 1.5 },
  { dx: -4, restY: 18, sz: 10, rot: 0.4, bobSpeed: 0.003, bobOffset: 3 },
  { dx: 8, restY: 22, sz: 11, rot: -0.3, bobSpeed: 0.0022, bobOffset: 4.5 },
  { dx: -10, restY: 26, sz: 12, rot: -0.25, bobSpeed: 0.0028, bobOffset: 0.8 },
  { dx: 2, restY: 30, sz: 10, rot: 0.15, bobSpeed: 0.0032, bobOffset: 2.1 },
  { dx: -6, restY: 34, sz: 11, rot: 0.5, bobSpeed: 0.0024, bobOffset: 3.7 },
  { dx: 10, restY: 38, sz: 10, rot: 0.3, bobSpeed: 0.0035, bobOffset: 1.2 },
  { dx: -2, restY: 42, sz: 11, rot: -0.4, bobSpeed: 0.0027, bobOffset: 2.9 },
  { dx: 6, restY: 46, sz: 9, rot: 0.1, bobSpeed: 0.0031, bobOffset: 5.1 },
];

const drawIceCube = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sz: number,
  rot: number
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  const radius = sz * 0.25;
  ctx.beginPath();
  ctx.moveTo(-sz / 2 + radius, -sz / 2);
  ctx.lineTo(sz / 2 - radius, -sz / 2);
  ctx.quadraticCurveTo(sz / 2, -sz / 2, sz / 2, -sz / 2 + radius);
  ctx.lineTo(sz / 2, sz / 2 - radius);
  ctx.quadraticCurveTo(sz / 2, sz / 2, sz / 2 - radius, sz / 2);
  ctx.lineTo(-sz / 2 + radius, sz / 2);
  ctx.quadraticCurveTo(-sz / 2, sz / 2, -sz / 2, sz / 2 - radius);
  ctx.lineTo(-sz / 2, -sz / 2 + radius);
  ctx.quadraticCurveTo(-sz / 2, -sz / 2, -sz / 2 + radius, -sz / 2);
  ctx.closePath();

  const grad = ctx.createLinearGradient(-sz / 2, -sz / 2, sz / 2, sz / 2);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
  grad.addColorStop(0.3, "rgba(224, 242, 254, 0.35)");
  grad.addColorStop(0.7, "rgba(186, 230, 253, 0.2)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0.4)");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 1.0;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-sz * 0.25, -sz * 0.2);
  ctx.lineTo(sz * 0.2, sz * 0.25);
  ctx.moveTo(0, 0);
  ctx.lineTo(sz * 0.2, -sz * 0.25);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.beginPath();
  ctx.arc(-sz / 2 + radius * 1.3, -sz / 2 + radius * 1.3, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

type SimState =
  | "make_americano"     // step 1: mix water + espresso
  | "americano_mixed"     // americano is in the pitcher, ready to move
  | "steaming_idle"       // pitcher is docked at steam wand, wait for steam click
  | "steaming_active"     // steaming countdown (5s)
  | "steaming_complete"   // steamed aerocano in pitcher, ready to pour
  | "pouring_aerocano"    // pouring into starbucks cup
  | "complete";           // finished!

export default function Slide5AerocanoMake() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  // React states for HUD overlay rendering
  const [simState, setSimState] = useState<SimState>("make_americano");
  const [waterPoured, setWaterPoured] = useState(0); 
  const [espressoPoured, setEspressoPoured] = useState(0); 
  const [foamLevel, setFoamLevel] = useState(0); 
  const [starbucksLevel, setStarbucksLevel] = useState(0); 
  const [steamTimeLeft, setSteamTimeLeft] = useState(5.0); 

  // High Performance Mutable Game State Refs
  const simStateRef = useRef<SimState>("make_americano");
  const waterPouredRef = useRef(0);
  const espressoPouredRef = useRef(0);
  const foamLevelRef = useRef(0);
  const starbucksLevelRef = useRef(0);
  const steamTimeLeftRef = useRef(5.0);

  const waterPosRef = useRef({ x: 0, y: 0, angle: 0, isGrabbed: false });
  const espressoPosRef = useRef({ x: 0, y: 0, angle: 0, isGrabbed: false });
  const pitcherPosRef = useRef({ x: 0, y: 0, angle: 0, isGrabbed: false, isDocked: false });
  const mouseStateRef = useRef({ x: 0, y: 0, isDown: false });

  // Audio Context Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const steamGainRef = useRef<GainNode | null>(null);
  const pourGainRef = useRef<GainNode | null>(null);

  const {
    bindVideoRef,
    handCount,
    ready,
    error,
    getHandPoses,
  } = useHandsTracking({
    videoRef,
    enabled: true,
    onError: (msg) => console.error("MediaPipe error:", msg),
  });

  // Init Web Audio synth
  const initAudio = () => {
    if (audioCtxRef.current) return;
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Create white noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Steam synth (highpass noise)
      const steamSource = ctx.createBufferSource();
      steamSource.buffer = buffer;
      steamSource.loop = true;

      const steamFilter = ctx.createBiquadFilter();
      steamFilter.type = "highpass";
      steamFilter.frequency.value = 3500;

      const steamGain = ctx.createGain();
      steamGain.gain.setValueAtTime(0, ctx.currentTime);

      steamSource.connect(steamFilter);
      steamFilter.connect(steamGain);
      steamGain.connect(ctx.destination);
      steamSource.start();
      steamGainRef.current = steamGain;

      // Pouring synth (bandpass noise)
      const pourSource = ctx.createBufferSource();
      pourSource.buffer = buffer;
      pourSource.loop = true;

      const pourFilter = ctx.createBiquadFilter();
      pourFilter.type = "bandpass";
      pourFilter.frequency.value = 450;
      pourFilter.Q.value = 4;

      const pourGain = ctx.createGain();
      pourGain.gain.setValueAtTime(0, ctx.currentTime);

      pourSource.connect(pourFilter);
      pourFilter.connect(pourGain);
      pourGain.connect(ctx.destination);
      pourSource.start();
      pourGainRef.current = pourGain;

    } catch (e) {
      console.warn("Could not create Web Audio Synthesizers:", e);
    }
  };

  const playSteamSound = () => {
    if (!steamGainRef.current || !audioCtxRef.current) return;
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    const now = audioCtxRef.current.currentTime;
    steamGainRef.current.gain.setValueAtTime(steamGainRef.current.gain.value, now);
    steamGainRef.current.gain.linearRampToValueAtTime(0.35, now + 0.1);
  };

  const stopSteamSound = () => {
    if (!steamGainRef.current || !audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    steamGainRef.current.gain.setValueAtTime(steamGainRef.current.gain.value, now);
    steamGainRef.current.gain.linearRampToValueAtTime(0, now + 0.2);
  };

  const playPourSound = (freq = 450, vol = 0.18) => {
    if (!pourGainRef.current || !audioCtxRef.current) return;
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    const now = audioCtxRef.current.currentTime;
    pourGainRef.current.gain.setValueAtTime(pourGainRef.current.gain.value, now);
    pourGainRef.current.gain.linearRampToValueAtTime(vol, now + 0.08);
  };

  const stopPourSound = () => {
    if (!pourGainRef.current || !audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    pourGainRef.current.gain.setValueAtTime(pourGainRef.current.gain.value, now);
    pourGainRef.current.gain.linearRampToValueAtTime(0, now + 0.1);
  };

  const playChime = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const freqs = [293.66, 349.23, 440.00, 587.33, 698.46]; // D4, F4, A4, D5, F5
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      const delay = idx * 0.08;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + delay + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.6);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 1.8);
    });
  };

  // Reset simulation states
  const handleReset = () => {
    simStateRef.current = "make_americano";
    waterPouredRef.current = 0;
    espressoPouredRef.current = 0;
    foamLevelRef.current = 0;
    starbucksLevelRef.current = 0;
    steamTimeLeftRef.current = 5.0;

    setSimState("make_americano");
    setWaterPoured(0);
    setEspressoPoured(0);
    setFoamLevel(0);
    setStarbucksLevel(0);
    setSteamTimeLeft(5.0);

    particlesRef.current = [];
    waterPosRef.current = { x: 0, y: 0, angle: 0, isGrabbed: false };
    espressoPosRef.current = { x: 0, y: 0, angle: 0, isGrabbed: false };
    pitcherPosRef.current = { x: 0, y: 0, angle: 0, isGrabbed: false, isDocked: false };
    mouseStateRef.current = { x: 0, y: 0, isDown: false };
    stopSteamSound();
    stopPourSound();
  };

  // Steaming click trigger
  const triggerSteaming = () => {
    if (simStateRef.current !== "steaming_idle") return;
    initAudio();
    simStateRef.current = "steaming_active";
    setSimState("steaming_active");
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    initAudio();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseStateRef.current = { x, y, isDown: true };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseStateRef.current.x = x;
    mouseStateRef.current.y = y;
  };

  const handleMouseUp = () => {
    mouseStateRef.current.isDown = false;
  };

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    initAudio();
    const canvas = canvasRef.current;
    if (!canvas || !e.touches[0]) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    mouseStateRef.current = { x, y, isDown: true };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !e.touches[0]) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    mouseStateRef.current.x = x;
    mouseStateRef.current.y = y;
    mouseStateRef.current.isDown = true;
  };

  const handleTouchEnd = () => {
    mouseStateRef.current.isDown = false;
  };

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    // Game ticks
    const tick = (now: number) => {
      const dt = Math.min(32, now - lastTime);
      lastTime = now;

      const w = window.innerWidth;
      const h = window.innerHeight;

      // ----------------------------------------------------
      // SCALED LAYOUT & DIMENSIONS
      // ----------------------------------------------------
      const scale = 2.2; 
      const tableY = h - 200; 

      // Slot default positions
      const defaultWaterX = w * 0.12;
      const defaultWaterY = tableY - 90;

      const defaultEspressoX = w * 0.25;
      const defaultEspressoY = tableY - 45;

      const defaultPitcherX = w * 0.38;
      const defaultPitcherY = tableY - 95;

      const machineX = w * 0.52;
      const machineY = tableY - 330;
      const steamWandX = machineX + 50 * scale; 
      const steamWandY = machineY + 110 * scale; 

      const defaultStarbucksX = w * 0.86;
      const defaultStarbucksY = tableY - 110;

      // Initialize positions on first frame
      if (waterPosRef.current.x === 0) {
        waterPosRef.current = { x: defaultWaterX, y: defaultWaterY, angle: 0, isGrabbed: false };
      }
      if (espressoPosRef.current.x === 0) {
        espressoPosRef.current = { x: defaultEspressoX, y: defaultEspressoY, angle: 0, isGrabbed: false };
      }
      if (pitcherPosRef.current.x === 0) {
        pitcherPosRef.current = { x: defaultPitcherX, y: defaultPitcherY, angle: 0, isGrabbed: false, isDocked: false };
      }

      // Clear Screen
      ctx.clearRect(0, 0, w, h);

      // Collect tracked pointers
      const handPoses = getHandPoses();
      const pointers: { x: number; y: number; angle: number; isDown: boolean; source: "hand" | "mouse" }[] = [];

      for (const pose of handPoses) {
        let cx = 0;
        let cy = 0;
        let angle = -Math.PI / 2; // upright default

        // Premium: Track centers of base joints 9 (middle MCP) and 13 (ring MCP) + wrist vector
        if (pose.middleMcp && pose.ringMcp && pose.wrist) {
          cx = (pose.middleMcp.x + pose.ringMcp.x) / 2;
          cy = (pose.middleMcp.y + pose.ringMcp.y) / 2;
          const x_canvas = (1 - cx) * w;
          const y_canvas = cy * h;
          const wrist_x = (1 - pose.wrist.x) * w;
          const wrist_y = pose.wrist.y * h;
          angle = Math.atan2(y_canvas - wrist_y, x_canvas - wrist_x);
        } else if (pose.indexTip && pose.indexDip) {
          cx = pose.indexTip.x;
          cy = pose.indexTip.y;
          const x_canvas = (1 - cx) * w;
          const y_canvas = cy * h;
          const dip_x_canvas = (1 - pose.indexDip.x) * w;
          const dip_y_canvas = pose.indexDip.y * h;
          angle = Math.atan2(y_canvas - dip_y_canvas, x_canvas - dip_x_canvas);
        } else if (pose.indexTip) {
          cx = pose.indexTip.x;
          cy = pose.indexTip.y;
        }

        if (cx !== 0 && cy !== 0) {
          const x_canvas = (1 - cx) * w;
          const y_canvas = cy * h;
          pointers.push({
            x: x_canvas,
            y: y_canvas,
            angle,
            isDown: true,
            source: "hand",
          });
        }
      }

      if (mouseStateRef.current.isDown) {
        pointers.push({
          x: mouseStateRef.current.x,
          y: mouseStateRef.current.y,
          angle: -Math.PI / 2, // upright default
          isDown: true,
          source: "mouse",
        });
      }

      // ----------------------------------------------------
      // GRAB & PHYSICS MANAGEMENT (SCALED RADII)
      // ----------------------------------------------------
      let isWaterTargetGrabbed = false;
      let isEspressoTargetGrabbed = false;
      let isPitcherTargetGrabbed = false;

      // 1. Water Bottle grab
      if (simStateRef.current === "make_americano" && waterPouredRef.current < 50) {
        const currentWaterX = waterPosRef.current.isGrabbed ? waterPosRef.current.x : defaultWaterX;
        const currentWaterY = waterPosRef.current.isGrabbed ? waterPosRef.current.y : defaultWaterY;

        let activeGrabber = pointers.find(
          (p) => Math.sqrt((p.x - currentWaterX) ** 2 + (p.y - currentWaterY) ** 2) < 130
        );

        if (activeGrabber) {
          isWaterTargetGrabbed = true;
          let angle = 0;

          if (activeGrabber.source === "hand") {
            angle = activeGrabber.angle + Math.PI / 2; // hand-guided tilt
          } else {
            // Mouse automatic distance tilt
            const dxPitcher = activeGrabber.x - defaultPitcherX;
            const dyPitcher = activeGrabber.y - (defaultPitcherY - 160);
            const distPitcher = Math.sqrt(dxPitcher * dxPitcher + dyPitcher * dyPitcher);
            if (distPitcher < 200) angle = -Math.PI / 1.6;
          }

          waterPosRef.current = {
            x: activeGrabber.x,
            y: activeGrabber.y,
            angle,
            isGrabbed: true,
          };
        } else {
          // Snap back
          waterPosRef.current = {
            x: waterPosRef.current.x + (defaultWaterX - waterPosRef.current.x) * 0.15,
            y: waterPosRef.current.y + (defaultWaterY - waterPosRef.current.y) * 0.15,
            angle: waterPosRef.current.angle * 0.85,
            isGrabbed: false,
          };
        }
      } else {
        // Locked on table
        waterPosRef.current = {
          x: waterPosRef.current.x + (defaultWaterX - waterPosRef.current.x) * 0.15,
          y: waterPosRef.current.y + (defaultWaterY - waterPosRef.current.y) * 0.15,
          angle: waterPosRef.current.angle * 0.85,
          isGrabbed: false,
        };
      }

      // 2. Espresso Cup grab
      if (simStateRef.current === "make_americano" && espressoPouredRef.current < 50) {
        const currentEspressoX = espressoPosRef.current.isGrabbed ? espressoPosRef.current.x : defaultEspressoX;
        const currentEspressoY = espressoPosRef.current.isGrabbed ? espressoPosRef.current.y : defaultEspressoY;

        let activeGrabber = pointers.find(
          (p) => Math.sqrt((p.x - currentEspressoX) ** 2 + (p.y - currentEspressoY) ** 2) < 120
        );

        if (activeGrabber) {
          isEspressoTargetGrabbed = true;
          let angle = 0;

          if (activeGrabber.source === "hand") {
            angle = activeGrabber.angle + Math.PI / 2; // hand-guided tilt
          } else {
            // Mouse automatic distance tilt
            const dxPitcher = activeGrabber.x - defaultPitcherX;
            const dyPitcher = activeGrabber.y - (defaultPitcherY - 160);
            const distPitcher = Math.sqrt(dxPitcher * dxPitcher + dyPitcher * dyPitcher);
            if (distPitcher < 200) angle = Math.PI / 1.6;
          }

          espressoPosRef.current = {
            x: activeGrabber.x,
            y: activeGrabber.y,
            angle,
            isGrabbed: true,
          };
        } else {
          // Snap back
          espressoPosRef.current = {
            x: espressoPosRef.current.x + (defaultEspressoX - espressoPosRef.current.x) * 0.15,
            y: espressoPosRef.current.y + (defaultEspressoY - espressoPosRef.current.y) * 0.15,
            angle: espressoPosRef.current.angle * 0.85,
            isGrabbed: false,
          };
        }
      } else {
        // Locked on table
        espressoPosRef.current = {
          x: espressoPosRef.current.x + (defaultEspressoX - espressoPosRef.current.x) * 0.15,
          y: espressoPosRef.current.y + (defaultEspressoY - espressoPosRef.current.y) * 0.15,
          angle: espressoPosRef.current.angle * 0.85,
          isGrabbed: false,
        };
      }

      // 3. Pitcher Grab
      const grabbablePitcher =
        simStateRef.current === "americano_mixed" ||
        simStateRef.current === "steaming_complete" ||
        simStateRef.current === "pouring_aerocano";

      if (grabbablePitcher && !pitcherPosRef.current.isDocked) {
        const currentPitcherX = pitcherPosRef.current.isGrabbed ? pitcherPosRef.current.x : defaultPitcherX;
        const currentPitcherY = pitcherPosRef.current.isGrabbed ? pitcherPosRef.current.y : defaultPitcherY;

        let activeGrabber = pointers.find(
          (p) => Math.sqrt((p.x - currentPitcherX) ** 2 + (p.y - currentPitcherY) ** 2) < 150
        );

        if (activeGrabber) {
          isPitcherTargetGrabbed = true;
          let angle = 0;
          let activeState = simStateRef.current;

          if (activeGrabber.source === "hand") {
            angle = activeGrabber.angle + Math.PI / 2; // hand guided tilt
          } else {
            // Mouse automatic distance tilt
            const dxStarbucks = activeGrabber.x - defaultStarbucksX;
            const dyStarbucks = activeGrabber.y - (defaultStarbucksY - 180);
            const distStarbucks = Math.sqrt(dxStarbucks * dxStarbucks + dyStarbucks * dyStarbucks);
            if (distStarbucks < 220) angle = -Math.PI / 1.7;
          }

          if (simStateRef.current === "steaming_complete" || simStateRef.current === "pouring_aerocano") {
            const dxStarbucks = activeGrabber.x - defaultStarbucksX;
            const dyStarbucks = activeGrabber.y - (defaultStarbucksY - 180);
            const distStarbucks = Math.sqrt(dxStarbucks * dxStarbucks + dyStarbucks * dyStarbucks);

            if (distStarbucks < 220) {
              activeState = "pouring_aerocano";
            } else {
              activeState = "steaming_complete";
            }
          }

          if (activeState !== simStateRef.current) {
            simStateRef.current = activeState;
            setSimState(activeState);
          }

          // Check snapping to steam wand
          const dxWand = activeGrabber.x - steamWandX;
          const dyWand = activeGrabber.y - (steamWandY + 90);
          const distWand = Math.sqrt(dxWand * dxWand + dyWand * dyWand);

          if (simStateRef.current === "americano_mixed" && distWand < 110) {
            // Dock the pitcher!
            pitcherPosRef.current = {
              x: steamWandX,
              y: steamWandY + 130,
              angle: 0,
              isGrabbed: false,
              isDocked: true,
            };
            simStateRef.current = "steaming_idle";
            setSimState("steaming_idle");
          } else {
            pitcherPosRef.current = {
              x: activeGrabber.x,
              y: activeGrabber.y,
              angle,
              isGrabbed: true,
              isDocked: false,
            };
          }
        } else {
          // Released, snap back
          const targetX = defaultPitcherX;
          if (simStateRef.current === "pouring_aerocano") {
            simStateRef.current = "steaming_complete";
            setSimState("steaming_complete");
          }

          pitcherPosRef.current = {
            x: pitcherPosRef.current.x + (targetX - pitcherPosRef.current.x) * 0.15,
            y: pitcherPosRef.current.y + (defaultPitcherY - pitcherPosRef.current.y) * 0.15,
            angle: pitcherPosRef.current.angle * 0.85,
            isGrabbed: false,
            isDocked: false,
          };
        }
      } else if (!pitcherPosRef.current.isDocked) {
        // Locked idle on countertop
        pitcherPosRef.current = {
          x: pitcherPosRef.current.x + (defaultPitcherX - pitcherPosRef.current.x) * 0.15,
          y: pitcherPosRef.current.y + (defaultPitcherY - pitcherPosRef.current.y) * 0.15,
          angle: pitcherPosRef.current.angle * 0.85,
          isGrabbed: false,
          isDocked: false,
        };
      }

      // ----------------------------------------------------
      // POUR CHECK & PARTICLE FX (DYNAMIC ROTATION BOUND)
      // ----------------------------------------------------
      let isPouringWater = false;
      let isPouringEspresso = false;
      let isPouringAerocano = false;

      // check if container is over pitcher
      const isOverPitcher = 
        pointers.some((p) => p.source === "hand" ? 
          (waterPosRef.current.x > defaultPitcherX - 140 && waterPosRef.current.x < defaultPitcherX + 140 && waterPosRef.current.y < defaultPitcherY + 50 && waterPosRef.current.y > defaultPitcherY - 260) : false
        ) || 
        (waterPosRef.current.x > defaultPitcherX - 100 && waterPosRef.current.x < defaultPitcherX + 100 && waterPosRef.current.y < defaultPitcherY + 50 && waterPosRef.current.y > defaultPitcherY - 220);

      const isEspressoOverPitcher = 
        pointers.some((p) => p.source === "hand" ? 
          (espressoPosRef.current.x > defaultPitcherX - 140 && espressoPosRef.current.x < defaultPitcherX + 140 && espressoPosRef.current.y < defaultPitcherY + 50 && espressoPosRef.current.y > defaultPitcherY - 260) : false
        ) || 
        (espressoPosRef.current.x > defaultPitcherX - 100 && espressoPosRef.current.x < defaultPitcherX + 100 && espressoPosRef.current.y < defaultPitcherY + 50 && espressoPosRef.current.y > defaultPitcherY - 220);

      // check if pitcher is over Starbucks cup
      const isOverStarbucks =
        pitcherPosRef.current.x > defaultStarbucksX - 140 &&
        pitcherPosRef.current.x < defaultStarbucksX + 140 &&
        pitcherPosRef.current.y < defaultStarbucksY + 50 &&
        pitcherPosRef.current.y > defaultStarbucksY - 265;

      // Pouring Water
      if (simStateRef.current === "make_americano" && waterPosRef.current.isGrabbed && isOverPitcher && (waterPosRef.current.angle < -Math.PI / 10 || waterPosRef.current.angle > Math.PI / 10)) {
        isPouringWater = true;
        waterPouredRef.current = Math.min(50, waterPouredRef.current + dt * 0.045);
        if (waterPouredRef.current >= 50) {
          waterPosRef.current.isGrabbed = false;
          waterPosRef.current.angle = 0;
        }

        // Spawns from nozzle in local (0, -45) coordinates
        const pourAngle = waterPosRef.current.angle;
        const pourX = waterPosRef.current.x + scale * 45 * Math.sin(pourAngle);
        const pourY = waterPosRef.current.y - scale * 45 * Math.cos(pourAngle);

        particlesRef.current.push({
          x: pourX,
          y: pourY,
          vx: -1.0 * Math.sign(pourAngle) + (Math.random() - 0.5) * 1.5,
          vy: 3 + Math.random() * 3,
          color: "#38bdf8",
          radius: 3 + Math.random() * 3,
          life: 1.0,
          type: "water",
        });
        playPourSound(350 + waterPouredRef.current * 4, 0.16);
      }

      // Pouring Espresso
      if (simStateRef.current === "make_americano" && espressoPosRef.current.isGrabbed && isEspressoOverPitcher && (espressoPosRef.current.angle < -Math.PI / 10 || espressoPosRef.current.angle > Math.PI / 10)) {
        isPouringEspresso = true;
        espressoPouredRef.current = Math.min(50, espressoPouredRef.current + dt * 0.045);
        if (espressoPouredRef.current >= 50) {
          espressoPosRef.current.isGrabbed = false;
          espressoPosRef.current.angle = 0;
        }

        // Spawns from nozzle in local (0, -22) coordinates
        const pourAngle = espressoPosRef.current.angle;
        const pourX = espressoPosRef.current.x + scale * 22 * Math.sin(pourAngle);
        const pourY = espressoPosRef.current.y - scale * 22 * Math.cos(pourAngle);

        particlesRef.current.push({
          x: pourX,
          y: pourY,
          vx: -1.0 * Math.sign(pourAngle) + (Math.random() - 0.5) * 1.5,
          vy: 3 + Math.random() * 3,
          color: "#78350f",
          radius: 3 + Math.random() * 2.5,
          life: 1.0,
          type: "espresso",
        });
        playPourSound(450 + espressoPouredRef.current * 3, 0.18);
      }

      // Auto-combine check
      if (simStateRef.current === "make_americano" && waterPouredRef.current >= 48 && espressoPouredRef.current >= 48) {
        simStateRef.current = "americano_mixed";
        setSimState("americano_mixed");
        stopPourSound();
      }

      // If nothing is pouring, fade out pouring audio
      if (!isPouringWater && !isPouringEspresso && !isPouringAerocano) {
        stopPourSound();
      }

      // Steaming Progress
      if (simStateRef.current === "steaming_active") {
        playSteamSound();
        steamTimeLeftRef.current = Math.max(0, steamTimeLeftRef.current - dt * 0.001);
        if (steamTimeLeftRef.current <= 0) {
          simStateRef.current = "steaming_complete";
          setSimState("steaming_complete");
          pitcherPosRef.current.isDocked = false; // release dock lock
          stopSteamSound();
          playChime();
        }
        foamLevelRef.current = Math.min(50, foamLevelRef.current + dt * 0.012);

        // Generate steam particles
        for (let i = 0; i < 2; i++) {
          particlesRef.current.push({
            x: steamWandX + (Math.random() - 0.5) * 40,
            y: steamWandY + 40 + Math.random() * 20,
            vx: (Math.random() - 0.5) * 3,
            vy: -1.5 - Math.random() * 3,
            color: "rgba(255, 255, 255, 0.45)",
            radius: 12 + Math.random() * 18,
            life: 1.0,
            type: "steam",
          });
        }
      }

      // Pouring Aerocano into Starbucks cup
      if (simStateRef.current === "pouring_aerocano" && pitcherPosRef.current.isGrabbed && isOverStarbucks && (pitcherPosRef.current.angle < -Math.PI / 10 || pitcherPosRef.current.angle > Math.PI / 10)) {
        isPouringAerocano = true;
        starbucksLevelRef.current = Math.min(100, starbucksLevelRef.current + dt * 0.075);
        if (starbucksLevelRef.current >= 100) {
          simStateRef.current = "complete";
          setSimState("complete");
          pitcherPosRef.current.isGrabbed = false;
          pitcherPosRef.current.angle = 0;
          stopPourSound();
          playChime();
        }

        // Spawns from spout in local (32, -45) coordinates
        const pourAngle = pitcherPosRef.current.angle;
        const pourX = pitcherPosRef.current.x + scale * (32 * Math.cos(pourAngle) + 45 * Math.sin(pourAngle));
        const pourY = pitcherPosRef.current.y + scale * (32 * Math.sin(pourAngle) - 45 * Math.cos(pourAngle));

        // Pour cascade particles
        particlesRef.current.push({
          x: pourX,
          y: pourY,
          vx: -1.2 * Math.sign(pourAngle) + (Math.random() - 0.5) * 1.5,
          vy: 4 + Math.random() * 3,
          color: "#b45309", // Crema brown/gold
          radius: 4 + Math.random() * 4,
          life: 1.0,
          type: "aerocano",
        });
        playPourSound(280 + starbucksLevelRef.current * 2, 0.22);
      }

      // Update and filter particles
      particlesRef.current = particlesRef.current
        .map((p) => {
          p.x += p.vx;
          p.y += p.vy;

          if (p.type === "steam") {
            p.vy -= 0.05; // Steam rises
            p.vx *= 0.98;
            p.radius += 0.4;
            p.life -= 0.025;
          } else {
            p.vy += 0.25; // gravity for liquids
            p.life -= 0.022;

            // Check collision with frothing pitcher (scaled size)
            if (simStateRef.current === "make_americano") {
              const pitcherCollision =
                p.x > defaultPitcherX - 100 &&
                p.x < defaultPitcherX + 100 &&
                p.y > defaultPitcherY - 150 &&
                p.y < defaultPitcherY + 60;

              if (pitcherCollision) p.life = 0; // absorbed
            }

            // Check collision with Starbucks Cup (scaled size)
            if (simStateRef.current === "pouring_aerocano") {
              const cupCollision =
                p.x > defaultStarbucksX - 95 &&
                p.x < defaultStarbucksX + 95 &&
                p.y > defaultStarbucksY - 180 &&
                p.y < defaultStarbucksY + 110;

              if (cupCollision) p.life = 0;
            }
          }

          return p;
        })
        .filter((p) => p.life > 0 && p.y < h);

      // Sync refs to React states for HUD overlay rendering
      setWaterPoured(waterPouredRef.current);
      setEspressoPoured(espressoPouredRef.current);
      setFoamLevel(foamLevelRef.current);
      setStarbucksLevel(starbucksLevelRef.current);
      setSteamTimeLeft(steamTimeLeftRef.current);

      // ----------------------------------------------------
      // DRAW SCENE OBJECTS
      // ----------------------------------------------------

      // 1. Table/Countertop
      const tableGrad = ctx.createLinearGradient(0, tableY, 0, h);
      tableGrad.addColorStop(0, "#111115");
      tableGrad.addColorStop(1, "#070709");
      ctx.fillStyle = tableGrad;
      ctx.fillRect(0, tableY, w, h);

      ctx.strokeStyle = "#1f1f23";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, tableY);
      ctx.lineTo(w, tableY);
      ctx.stroke();

      // 2. Espresso Machine (Scaled 2.2x)
      ctx.save();
      ctx.shadowColor = "rgba(245, 158, 11, 0.1)";
      ctx.shadowBlur = 30;
      ctx.translate(machineX, machineY);
      ctx.scale(scale, scale);
      
      // Machine main metal body
      ctx.fillStyle = "#1e1b18";
      ctx.fillRect(0, 0, 180, 160);
      ctx.strokeStyle = "#4b453d";
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 180, 160);

      // Drip tray
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(10, 120, 160, 25);
      ctx.strokeRect(10, 120, 160, 25);

      // Steam wand metallic pipe
      ctx.strokeStyle = "#8c8273";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(50, 60);
      ctx.quadraticCurveTo(40, 100, 50, 110);
      ctx.stroke();

      // Steam nozzle tip
      ctx.fillStyle = "#c2b6a3";
      ctx.beginPath();
      ctx.arc(50, 110, 6, 0, Math.PI * 2);
      ctx.fill();

      // Glow indicators (pressure / ready)
      ctx.fillStyle = simStateRef.current === "steaming_active" ? "#ef4444" : "#22c55e"; // red when steaming, green when ready
      ctx.beginPath();
      ctx.arc(30, 30, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 9px monospace";
      ctx.fillText("READY", 45, 33);

      // Steam pressure dial
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(140, 35, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#222";
      ctx.beginPath();
      ctx.arc(140, 35, 12, 0, Math.PI * 2);
      ctx.fill();

      // Needle in dial
      ctx.strokeStyle = simStateRef.current === "steaming_active" ? "#ef4444" : "#a1a1aa";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(140, 35);
      const angleDial = simStateRef.current === "steaming_active" ? -Math.PI / 4 : -Math.PI / 1.2;
      ctx.lineTo(140 + 10 * Math.cos(angleDial), 35 + 10 * Math.sin(angleDial));
      ctx.stroke();

      // Steam Aerate Button
      const scaleWandHovered = pointers.some(
        (p) =>
          p.x > machineX + 35 * scale &&
          p.x < machineX + 145 * scale &&
          p.y > machineY + 70 * scale &&
          p.y < machineY + 102 * scale
      );

      if (simStateRef.current === "steaming_idle") {
        const btnPulse = Math.sin(now * 0.005) * 8 + 15;
        ctx.shadowColor = "#f59e0b";
        ctx.shadowBlur = btnPulse;

        ctx.fillStyle = scaleWandHovered ? "#d97706" : "#f59e0b";
        ctx.fillRect(35, 70, 110, 32);
        ctx.strokeStyle = "#ffffff";
        ctx.strokeRect(35, 70, 110, 32);

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#000000";
        ctx.font = "bold 11px Inter";
        ctx.textAlign = "center";
        ctx.fillText("AERATE ⚡", 90, 90);

        // Hover dwell activator for hand tracking or mouse click
        const handOverBtn = pointers.find(
          (p) =>
            p.x > machineX + 35 * scale &&
            p.x < machineX + 145 * scale &&
            p.y > machineY + 70 * scale &&
            p.y < machineY + 102 * scale
        );

        if (handOverBtn) {
          // Trigger click
          setTimeout(triggerSteaming, 20);
        }
      } else if (simStateRef.current === "steaming_active") {
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(35, 70, 110, 32);

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px Inter";
        ctx.textAlign = "center";
        ctx.fillText(`AERATING ${steamTimeLeftRef.current.toFixed(1)}s`, 90, 90);
      }

      ctx.restore();

      // 3. Water Bottle (Scaled 2.2x)
      ctx.save();
      const wBotX = waterPosRef.current.x;
      const wBotY = waterPosRef.current.y;
      ctx.translate(wBotX, wBotY);
      ctx.rotate(waterPosRef.current.angle);
      ctx.scale(scale, scale);

      // Glass Bottle Body
      ctx.strokeStyle = isWaterTargetGrabbed ? "#60a5fa" : "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-15, -45);
      ctx.lineTo(-15, -35);
      ctx.lineTo(-26, -20);
      ctx.lineTo(-26, 45);
      ctx.lineTo(26, 45);
      ctx.lineTo(26, -20);
      ctx.lineTo(15, -35);
      ctx.lineTo(15, -45);
      ctx.closePath();
      ctx.stroke();

      // Water liquid inside bottle
      const remainingWaterPct = (50 - waterPouredRef.current) / 50;
      if (remainingWaterPct > 0) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.75)";
        ctx.fillRect(-22, 41 - 60 * remainingWaterPct, 44, 60 * remainingWaterPct);
      }

      ctx.fillStyle = isWaterTargetGrabbed ? "#ffffff" : "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 10px Inter";
      ctx.textAlign = "center";
      ctx.fillText("WATER", 0, 8);
      ctx.restore();

      // 4. Espresso Cup (Scaled 2.2x)
      ctx.save();
      const eCupX = espressoPosRef.current.x;
      const eCupY = espressoPosRef.current.y;
      ctx.translate(eCupX, eCupY);
      ctx.rotate(espressoPosRef.current.angle);
      ctx.scale(scale, scale);

      // Ceramic Cup outline
      ctx.strokeStyle = isEspressoTargetGrabbed ? "#f59e0b" : "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-22, -22);
      ctx.lineTo(-18, 22);
      ctx.lineTo(18, 22);
      ctx.lineTo(22, -22);
      ctx.stroke();

      // Cup handle
      ctx.beginPath();
      ctx.arc(22, 0, 10, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // Espresso liquid inside
      const remainingEspressoPct = (50 - espressoPouredRef.current) / 50;
      if (remainingEspressoPct > 0) {
        ctx.fillStyle = "#5c3d2e";
        ctx.fillRect(-17, 20 - 38 * remainingEspressoPct, 34, 38 * remainingEspressoPct);
      }

      ctx.fillStyle = isEspressoTargetGrabbed ? "#ffffff" : "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 8px Inter";
      ctx.textAlign = "center";
      ctx.fillText("ESPRESSO", 0, -2);
      ctx.restore();

      // 5. Starbucks Cup (Scaled 2.2x)
      ctx.save();
      ctx.translate(defaultStarbucksX, defaultStarbucksY);
      ctx.scale(scale, scale);

      // Cup body outline
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-35, -60);
      ctx.lineTo(-25, 50);
      ctx.lineTo(25, 50);
      ctx.lineTo(35, -60);
      ctx.closePath();
      ctx.stroke();

      // Starbucks Green Circle Logo
      ctx.fillStyle = "#00704a";
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px Inter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", 0, 1);

      // Frothed Aerocano liquid inside
      if (starbucksLevelRef.current > 0) {
        const fillH = 105 * (starbucksLevelRef.current / 100);
        ctx.save();
        // Clip to cup inner area
        ctx.beginPath();
        ctx.moveTo(-33, -58);
        ctx.lineTo(-24, 48);
        ctx.lineTo(24, 48);
        ctx.lineTo(33, -58);
        ctx.clip();

        // Brown espresso coffee bottom base
        ctx.fillStyle = "rgba(62, 39, 22, 0.9)";
        ctx.fillRect(-45, 50 - fillH, 90, fillH);

        // Frothed foaming crema cascade gradient top
        const cremaH = Math.min(35, fillH);
        const cremaY = 50 - fillH;
        const foamGrad = ctx.createLinearGradient(0, cremaY, 0, cremaY + cremaH);
        foamGrad.addColorStop(0, "rgba(239, 203, 156, 0.95)"); // light beige top
        foamGrad.addColorStop(0.3, "rgba(180, 83, 9, 0.9)"); // caramel middle
        foamGrad.addColorStop(1, "rgba(62, 39, 22, 0.0)"); // blend into coffee bottom
        ctx.fillStyle = foamGrad;
        ctx.fillRect(-45, cremaY, 90, cremaH);

        // Draw 10 floating ice cubes inside Starbucks cup
        STARBUCKS_CUBES.forEach((cube) => {
          const iceBob = Math.sin(now * cube.bobSpeed + cube.bobOffset) * 1.5;
          const cy = 50 - fillH + cube.restY + iceBob;
          if (cy < 48) {
            drawIceCube(ctx, cube.dx, cy, cube.sz, cube.rot);
          }
        });

        ctx.restore();
      }

      ctx.restore();

      // 6. Milk Frothing Pitcher (Scaled 2.2x)
      ctx.save();
      const pX = pitcherPosRef.current.isDocked ? steamWandX : pitcherPosRef.current.x;
      // Vibration during steaming!
      const shakeOffset = simStateRef.current === "steaming_active" ? (Math.random() - 0.5) * 6 : 0;
      const pY = pitcherPosRef.current.isDocked ? (steamWandY + 130) : pitcherPosRef.current.y;

      ctx.translate(pX + shakeOffset, pY);
      ctx.rotate(pitcherPosRef.current.angle);
      ctx.scale(scale, scale);

      // Pitcher Metallic Jug body
      ctx.strokeStyle = isPitcherTargetGrabbed
        ? "#e4e4e7"
        : pitcherPosRef.current.isDocked
        ? "#f59e0b"
        : "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 4;
      ctx.fillStyle = "#27272a";

      ctx.beginPath();
      ctx.moveTo(-32, -45);
      ctx.lineTo(-32, 45);
      ctx.bezierCurveTo(-32, 55, 32, 55, 32, 45);
      ctx.lineTo(32, -45);
      ctx.quadraticCurveTo(42, -48, 48, -48); // spout lip right side
      ctx.lineTo(32, -45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Handle on left side
      ctx.beginPath();
      ctx.moveTo(-32, -25);
      ctx.bezierCurveTo(-54, -25, -54, 25, -32, 25);
      ctx.stroke();

      // Draw liquid inside Pitcher
      const totalPoured = waterPouredRef.current + espressoPouredRef.current;
      if (totalPoured > 0) {
        ctx.save();
        // Clip to inner pitcher body
        ctx.beginPath();
        ctx.moveTo(-28, -40);
        ctx.lineTo(-28, 40);
        ctx.bezierCurveTo(-28, 48, 28, 48, 28, 40);
        ctx.lineTo(28, -40);
        ctx.closePath();
        ctx.clip();

        const remainingPct = (100 - starbucksLevelRef.current) / 100; // empty as we pour
        const fillHeight = 70 * (totalPoured / 100) * remainingPct;

        if (fillHeight > 0) {
          const liquidY = 44 - fillHeight;
          if (espressoPouredRef.current === 0) {
            // pure water
            ctx.fillStyle = "rgba(56, 189, 248, 0.65)";
            ctx.fillRect(-30, liquidY, 60, fillHeight);
          } else {
            // Americano mixed
            ctx.fillStyle = "rgba(62, 39, 22, 0.95)";
            ctx.fillRect(-30, liquidY, 60, fillHeight);
          }

          // Crema / Foam layer (rises during steaming)
          if (foamLevelRef.current > 0) {
            const foamHeight = 22 * (foamLevelRef.current / 50) * remainingPct;
            const foamY = liquidY;
            const foamGrad = ctx.createLinearGradient(0, foamY, 0, foamY + foamHeight);
            foamGrad.addColorStop(0, "rgba(239, 203, 156, 0.95)"); // frothed beige crema
            foamGrad.addColorStop(1, "rgba(180, 83, 9, 0.0)"); // blending out
            ctx.fillStyle = foamGrad;
            ctx.fillRect(-30, foamY, 60, foamHeight);
          }
        }

        ctx.restore();
      }

      // Draw Ice Cubes inside Pitcher (always present initially, floats as pitcher fills)
      const remainingPitcherPct = (100 - starbucksLevelRef.current) / 100;
      if (remainingPitcherPct > 0.1) {
        ctx.save();
        // Clip to inner pitcher body
        ctx.beginPath();
        ctx.moveTo(-28, -40);
        ctx.lineTo(-28, 40);
        ctx.bezierCurveTo(-28, 48, 28, 48, 28, 40);
        ctx.lineTo(28, -40);
        ctx.closePath();
        ctx.clip();

        const fillHeight = 70 * (totalPoured / 100) * remainingPitcherPct;
        const liquidY = 44 - fillHeight;

        PITCHER_CUBES.forEach((cube) => {
          const iceBob = totalPoured > 0 ? Math.sin(now * cube.bobSpeed + cube.bobOffset) * 1.2 : 0;
          // Float logic: if liquid level rises (liquidY drops), the cube floats up near the liquid surface, otherwise rests at bottom
          const floatOffset = cube.floatDelay ? cube.floatDelay * 14 : 0;
          const cy = totalPoured > 0 
            ? Math.min(cube.restY, liquidY + cube.sz * 0.35 + floatOffset) + iceBob
            : cube.restY;

          drawIceCube(ctx, cube.dx, cy, cube.sz, cube.rot);
        });

        ctx.restore();
      }

      // Inside label
      ctx.fillStyle = isPitcherTargetGrabbed ? "#ffffff" : "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 8px Inter";
      ctx.textAlign = "center";
      ctx.fillText("PITCHER", 0, -6);

      ctx.restore();

      // ----------------------------------------------------
      // DRAW LIQUID & STEAM PARTICLES
      // ----------------------------------------------------
      for (const p of particlesRef.current) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // ----------------------------------------------------
      // DRAW HAND GLOW TRACKERS
      // ----------------------------------------------------
      for (const p of pointers) {
        if (p.source === "hand") {
          ctx.save();
          ctx.shadowColor = "#f59e0b";
          ctx.shadowBlur = 15;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Proceed loop
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, getHandPoses]); // High Performance: dependency array is minimized to prevent tearing down the canvas loop on state changes

  // Status Text HUD helper
  const getStatusText = () => {
    switch (simState) {
      case "make_americano":
        if (waterPoured === 0 && espressoPoured === 0) {
          return "Grab the Water and Espresso and pour them into the Pitcher! 💧☕";
        }
        if (waterPoured < 50 && espressoPoured === 0) {
          return "Water poured! Now add the Espresso shot!";
        }
        if (espressoPoured < 50 && waterPoured === 0) {
          return "Espresso shot added! Now pour the Water!";
        }
        return "Mixing the Americano... almost there!";
      case "americano_mixed":
        return "Americano ready with ice! 🧊 Pick up the pitcher and dock it under the steam wand (middle)!";
      case "steaming_idle":
        return "Docked! Click 'AERATE ⚡' on the espresso machine panel to start steaming!";
      case "steaming_active":
        return "Steam texturing in progress! Injecting micro-bubbles... 🫧";
      case "steaming_complete":
        return "Perfect velvety Aerocano frothed! ☕ Pick up the pitcher and move right to pour it into the cup!";
      case "pouring_aerocano":
        return "Pouring! Watch the cascading crema effect! 😍";
      case "complete":
        return "Aerocano ready! Light, creamy, cascading frothed coffee. Perfect brew! 🎉☕";
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black flex flex-col justify-between">
      {/* Background camera feed */}
      <video
        ref={bindVideoRef}
        muted
        playsInline
        autoPlay
        className="absolute inset-0 h-full w-full object-cover opacity-25 pointer-events-none select-none"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Render Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="absolute inset-0 z-10 touch-none select-none cursor-crosshair"
      />

      {/* Glassmorphic instruction header */}
      <div className="relative z-30 flex flex-col items-center p-6 pt-24 pointer-events-none w-full select-none">
        <div
          className={`px-5 py-2.5 rounded-full border text-xs font-bold uppercase tracking-widest backdrop-blur-md transition-all duration-300 ${
            handCount > 0
              ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
              : "border-white/10 bg-black/40 text-white/50"
          }`}
        >
          {handCount === 0
            ? "💡 Webcam ready. Place hand in frame to control OR click & drag with mouse!"
            : `👉 Hand tracked! Move index finger to grab and pour!`}
        </div>

        <p className="mt-4 text-center text-sm font-semibold tracking-wide text-zinc-100 bg-black/55 px-4 py-2 border border-zinc-800 rounded-xl max-w-xl shadow">
          {getStatusText()}
        </p>
      </div>

      {/* Completed Success Screen Overlay */}
      {simState === "complete" && (
        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-md p-8 rounded-3xl border border-emerald-500/30 bg-black/80 backdrop-blur-xl animate-fade-in shadow-2xl flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-emerald-400 uppercase tracking-tight mb-2">
              Aerocano Ready! ☕✨
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed px-2">
              You mixed the water and espresso shot, docked the pitcher to aerate with pressurized steam, frothed it into a velvety micro-foam head, and poured a premium cascading Aerocano!
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-zinc-950 font-black text-xs uppercase py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg active:scale-95 border border-emerald-300/30 cursor-pointer pointer-events-auto"
          >
            Reset Simulation 🔄
          </button>
        </div>
      )}

      {/* Reset button footer */}
      <div className="relative z-30 flex flex-col items-center p-8 pointer-events-none select-none">
        {error ? (
          <p className="text-red-400 text-xs font-semibold mb-4 bg-red-950/40 border border-red-500/30 px-4 py-2 rounded-full">
            {error}
          </p>
        ) : !ready ? (
          <div className="flex items-center gap-2 mb-4 bg-black/40 px-3.5 py-1.5 rounded-full border border-white/5">
            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Loading MediaPipe Hands…</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleReset}
            className="pointer-events-auto mb-6 px-6 py-2 rounded-full border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
          >
            Reset Simulation
          </button>
        )}
      </div>
    </div>
  );
}
