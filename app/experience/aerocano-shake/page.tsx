"use client";

import { useEffect, useState, useRef } from "react";

interface Confetti {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  angle: number;
}

type GameState = "idle" | "playing" | "completed";

export default function AerocanoShakePage() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [timeLeft, setTimeLeft] = useState(15);
  const [shakeCount, setShakeCount] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [motionPermission, setMotionPermission] = useState<"granted" | "denied" | "unsupported" | "prompt">("prompt");
  const [isDesktop, setIsDesktop] = useState(false);

  // Name + score submission
  const [playerName, setPlayerName] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "done" | "error">("idle");

  // Spring-bound offsets
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [sloshSkew, setSloshSkew] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Confetti particles
  const [confetti, setConfetti] = useState<Confetti[]>([]);

  // Derived progress (crema density up to target 100 shakes)
  const progress = Math.min(100, Math.round((shakeCount / 100) * 100));

  // Refs for logic
  const shakeCountRef = useRef(0);
  const gameStateRef = useRef<GameState>("idle");
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const shakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const soundTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile motion refs
  const lastX = useRef<number | null>(null);
  const lastY = useRef<number | null>(null);
  const lastZ = useRef<number | null>(null);
  const lastShakeTime = useRef<number>(0);

  // Desktop drag refs
  const lastDragDirX = useRef<number>(0);
  const lastMouseShakeTime = useRef<number>(0);

  // Web Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const shakeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const shakeGainRef = useRef<GainNode | null>(null);

  // Sync refs to avoid stale closure issues
  useEffect(() => {
    shakeCountRef.current = shakeCount;
  }, [shakeCount]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Detect environment on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsDesktop(!isMobileDevice);

      const DeviceMotionEventClass = (window as any).DeviceMotionEvent;
      if (typeof DeviceMotionEventClass !== "undefined") {
        const requestPermission = DeviceMotionEventClass?.requestPermission;

        if (typeof requestPermission === "function") {
          setMotionPermission("prompt");
        } else {
          setMotionPermission("granted");
        }
      } else {
        setMotionPermission("unsupported");
      }
    }
  }, []);

  // Monitor Game State transitions (Timer and audio chimes)
  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setGameState("completed");
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    if (gameState === "completed") {
      playChime();
      // Spawn confetti
      const colors = ["#d97706", "#f59e0b", "#fbbf24", "#ffffff", "#e4e4e7", "#78350f"];
      const newConfetti = Array.from({ length: 65 }).map((_, i) => {
        const angle = Math.random() * 360;
        return {
          id: i,
          x: 0,
          y: 0,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          delay: Math.random() * 0.25,
          duration: Math.random() * 1.6 + 1.2,
          angle,
        };
      });
      setConfetti(newConfetti);
      stopShakeSound();
    } else {
      setConfetti([]);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState]);

  // Audio Context lazy initializer
  const initAudio = () => {
    if (audioCtxRef.current) return;

    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn("AudioContext class not found in window");
        return;
      }
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Create white noise buffer
      const bufferSize = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // Bandpass Filter to emulate shaker ice/foam sloshing
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1000;
      filter.Q.value = 1.8;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, ctx.currentTime);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start();
      
      shakeSourceRef.current = source;
      shakeGainRef.current = gainNode;
    } catch (e) {
      console.warn("Web Audio API is not supported or blocked: ", e);
    }
  };

  const playShakeSound = (intensity: number) => {
    if (!shakeGainRef.current || !audioCtxRef.current) return;

    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    const now = audioCtxRef.current.currentTime;
    const vol = Math.min(0.25, intensity * 0.08);
    shakeGainRef.current.gain.setValueAtTime(shakeGainRef.current.gain.value, now);
    shakeGainRef.current.gain.linearRampToValueAtTime(vol, now + 0.05);
  };

  const stopShakeSound = () => {
    if (!shakeGainRef.current || !audioCtxRef.current) return;
    const now = audioCtxRef.current.currentTime;
    shakeGainRef.current.gain.setValueAtTime(shakeGainRef.current.gain.value, now);
    shakeGainRef.current.gain.linearRampToValueAtTime(0, now + 0.15);
  };

  const playChime = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const freqs = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);

      const delay = idx * 0.08;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + delay + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.8);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 2.0);
    });
  };

  // Safe shake increment
  const registerShake = () => {
    if (gameStateRef.current !== "playing") return;
    setShakeCount((s) => s + 1);
  };

  // Central feedback dispatcher for vibration, sound, and visual shake indicators
  const triggerShakeFeedback = (intensity: number) => {
    initAudio();
    playShakeSound(intensity);

    setShaking(true);
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = setTimeout(() => {
      setShaking(false);
    }, 200);

    if (soundTimeoutRef.current) clearTimeout(soundTimeoutRef.current);
    soundTimeoutRef.current = setTimeout(() => {
      stopShakeSound();
    }, 150);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(20);
    }
  };

  // Monitor Mobile DeviceMotionEvent (Gyroscope + Accelerometer)
  useEffect(() => {
    if (motionPermission !== "granted") return;

    const handleMotion = (event: DeviceMotionEvent) => {
      if (gameStateRef.current !== "playing") return;

      // Safely extract accelerometer data. If acceleration is present but empty/null (iOS Safari quirk), fall back to accelerationIncludingGravity
      let acc = event.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) {
        acc = event.accelerationIncludingGravity;
      }
      const rot = event.rotationRate;

      let motionScore = 0;

      // 1. Accelerometer parsing
      if (acc) {
        const { x, y, z } = acc;
        if (x !== null && y !== null && z !== null) {
          if (lastX.current !== null && lastY.current !== null && lastZ.current !== null) {
            const deltaX = Math.abs(x - lastX.current);
            const deltaY = Math.abs(y - lastY.current);
            const deltaZ = Math.abs(z - lastZ.current);
            motionScore += deltaX + deltaY + deltaZ;
          }
          lastX.current = x;
          lastY.current = y;
          lastZ.current = z;
        }
      }

      // 2. Gyroscope rotationRate parsing (deg/s)
      if (rot) {
        const { alpha, beta, gamma } = rot;
        if (alpha !== null && beta !== null && gamma !== null) {
          const rotationMagnitude = Math.abs(alpha) + Math.abs(beta) + Math.abs(gamma);
          motionScore += rotationMagnitude * 0.06;
          setSloshSkew(Math.min(25, Math.max(-25, gamma * 0.2)));
        }
      }

      // 3. Threshold check with 140ms debounce to register a single shake motion
      const SHAKE_THRESHOLD = 12; // lowered from 16 for higher sensitivity
      if (motionScore > SHAKE_THRESHOLD) {
        const now = Date.now();
        if (now - lastShakeTime.current > 140) {
          registerShake();
          lastShakeTime.current = now;
          triggerShakeFeedback(motionScore);
        }
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      if (soundTimeoutRef.current) clearTimeout(soundTimeoutRef.current);
    };
  }, [motionPermission]);

  // Register non-passive touchmove listener on container to prevent iOS Safari page bounce/scroll during drag-to-shake
  useEffect(() => {
    const container = containerRef.current;
    if (!container || gameState !== "playing") return;

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || gameStateRef.current !== "playing") return;
      if (e.touches[0]) {
        if (e.cancelable) e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, [gameState]);

  // Request motion permission (iOS trigger) & Start Game
  // NOTE: This MUST remain fully synchronous (no async keyword) to avoid losing gesture context in iOS Safari promise microtasks!
  const startChallenge = () => {
    if (gameStateRef.current !== "idle") return;

    const DeviceMotionEventClass = (window as any).DeviceMotionEvent;

    if (DeviceMotionEventClass && typeof DeviceMotionEventClass.requestPermission === "function") {
      try {
        DeviceMotionEventClass.requestPermission()
          .then((status: string) => {
            const isGranted = status === "granted";
            setMotionPermission(isGranted ? "granted" : "denied");
            
            // Start the game loop after permission status is determined
            try {
              initAudio();
            } catch (err) {
              console.warn("Audio initialization failed:", err);
            }
            setShakeCount(0);
            shakeCountRef.current = 0;
            setTimeLeft(15);
            setGameState("playing");
          })
          .catch((err: any) => {
            console.error("Error asking motion permission:", err);
            setMotionPermission("denied");
            try {
              initAudio();
            } catch (err) {
              console.warn("Audio initialization failed:", err);
            }
            setShakeCount(0);
            shakeCountRef.current = 0;
            setTimeLeft(15);
            setGameState("playing");
          });
      } catch (err) {
        console.error("Synchronous error calling requestPermission:", err);
        setMotionPermission("denied");
        try {
          initAudio();
        } catch (audioErr) {
          console.warn("Audio initialization failed:", audioErr);
        }
        setShakeCount(0);
        shakeCountRef.current = 0;
        setTimeLeft(15);
        setGameState("playing");
      }
    } else {
      setMotionPermission("granted");
      try {
        initAudio();
      } catch (err) {
        console.warn("Audio initialization failed:", err);
      }
      setShakeCount(0);
      shakeCountRef.current = 0;
      setTimeLeft(15);
      setGameState("playing");
    }
  };

  // Pointer drag events for desktop
  const handleDragStart = (clientX: number, clientY: number) => {
    if (gameStateRef.current !== "playing") return;
    initAudio();

    setIsDragging(true);
    isDraggingRef.current = true;
    dragStartRef.current = { x: clientX, y: clientY };
    lastPointerRef.current = { x: clientX, y: clientY, time: Date.now() };
    lastDragDirX.current = 0;
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current || gameStateRef.current !== "playing") return;

    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 90;
    const constraint = distance > maxDist ? maxDist / distance : 1;
    
    const constrainedX = dx * constraint;
    const constrainedY = dy * constraint;

    setOffsetX(constrainedX);
    setOffsetY(constrainedY);
    setRotation(constrainedX * 0.22);
    setSloshSkew(constrainedX * -0.18);

    const now = Date.now();
    const dt = now - lastPointerRef.current.time;
    if (dt > 0) {
      const pdx = clientX - lastPointerRef.current.x;
      const frameDist = Math.abs(pdx);
      
      // Detect drag direction reversals in X-axis for drag-to-shake counting
      if (frameDist > 2) {
        const currentDir = Math.sign(pdx);
        if (currentDir !== lastDragDirX.current) {
          if (now - lastMouseShakeTime.current > 90) {
            registerShake();
            lastMouseShakeTime.current = now;
            triggerShakeFeedback(10);
          }
          lastDragDirX.current = currentDir;
        }
      }
    }

    lastPointerRef.current = { x: clientX, y: clientY, time: now };
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
    setOffsetX(0);
    setOffsetY(0);
    setRotation(0);
    setSloshSkew(0);
    stopShakeSound();
  };

  const handleResetToIdle = () => {
    setShakeCount(0);
    shakeCountRef.current = 0;
    setTimeLeft(15);
    setShaking(false);
    setOffsetX(0);
    setOffsetY(0);
    setRotation(0);
    setSloshSkew(0);
    setConfetti([]);
    stopShakeSound();
    setPlayerName("");
    setSubmitState("idle");
    setGameState("idle");
  };

  const handleSubmitScore = async () => {
    if (!playerName.trim()) return;
    setSubmitState("loading");
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName.trim(), score: shakeCount }),
      });
      const data = await res.json();
      setSubmitState(data.success ? "done" : "error");
    } catch {
      setSubmitState("error");
    }
  };

  const getStatusText = () => {
    if (shakeCount === 0) {
      return isDesktop
        ? "Grab and shake the cup left-right!"
        : "Shake your device or swipe back-forth! 🧊";
    }
    if (shakeCount < 20) return "Froth starting to foam! 🫧";
    if (shakeCount < 50) return "Nice speed! Keep it shaking! 💪";
    if (shakeCount < 80) return "Crema starting to look velvet! 🔥";
    return "PERFECT CREMA! Go for the high score! 🚀☕";
  };

  return (
    <main
      ref={containerRef}
      className="mx-auto flex min-h-screen max-w-md flex-col justify-between bg-zinc-950 px-6 py-12 text-white select-none antialiased relative overflow-hidden"
      onMouseMove={gameState === "playing" ? (e) => handleDragMove(e.clientX, e.clientY) : undefined}
      onMouseUp={gameState === "playing" ? handleDragEnd : undefined}
      onMouseLeave={gameState === "playing" ? handleDragEnd : undefined}
      onTouchEnd={gameState === "playing" ? handleDragEnd : undefined}
    >
      <style>{`
        @keyframes rattle-ice {
          0%, 100% { transform: translate(0, 0) rotate(12deg); }
          20% { transform: translate(-3px, 2px) rotate(-8deg); }
          40% { transform: translate(3px, -2px) rotate(22deg); }
          60% { transform: translate(-2px, -3px) rotate(-15deg); }
          80% { transform: translate(2px, 3px) rotate(18deg); }
        }
        @keyframes bubble-rise {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          100% { transform: translateY(-75px) scale(1.2); opacity: 0; }
        }
        @keyframes confetti-burst {
          0% {
            transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
          15% {
            transform: translate3d(var(--tx), var(--ty), 0) scale(1.2) rotate(45deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--tx-fall), calc(var(--ty-fall) + 300px), 0) scale(0.6) rotate(var(--rot-end));
            opacity: 0;
          }
        }
        @keyframes float-cup {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
        }
        .animate-rattle-ice {
          animation: rattle-ice 0.12s infinite ease-in-out;
        }
        .animate-bubble-rise {
          animation: bubble-rise 1.8s infinite linear;
        }
        .animate-confetti {
          animation: confetti-burst var(--duration) cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }
        .animate-float-cup {
          animation: float-cup 4s infinite ease-in-out;
        }
      `}</style>

      {/* Confetti Render */}
      {confetti.map((c) => {
        const style = {
          "--tx": `${Math.cos((c.angle * Math.PI) / 180) * (Math.random() * 70 + 50)}px`,
          "--ty": `${Math.sin((c.angle * Math.PI) / 180) * (Math.random() * 70 + 50) - (Math.random() * 60 + 60)}px`,
          "--tx-fall": `${Math.cos((c.angle * Math.PI) / 180) * (Math.random() * 120 + 80) + (Math.random() * 60 - 30)}px`,
          "--ty-fall": `${Math.sin((c.angle * Math.PI) / 180) * (Math.random() * 70 + 50) + 160}px`,
          "--rot-end": `${Math.random() * 720 - 360}deg`,
          animationDelay: `${c.delay}s`,
          animationDuration: `${c.duration}s`,
        } as React.CSSProperties;

        return (
          <div
            key={c.id}
            className="absolute rounded-sm pointer-events-none animate-confetti z-50"
            style={{
              ...style,
              backgroundColor: c.color,
              width: c.size,
              height: c.size,
              left: "50%",
              top: "45%",
            }}
          />
        );
      })}

      {/* Header Info */}
      <div className="flex flex-col items-center text-center mt-6 z-10">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Aerocano Lab</span>
        {gameState === "playing" && (
          <div className="mt-4 flex items-center gap-2 bg-zinc-900/60 border border-zinc-850 px-4 py-2 rounded-full backdrop-blur">
            <span className="text-sm">⏱️</span>
            <span className={`font-mono text-sm font-black tracking-wider ${timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-amber-500"}`}>
              {timeLeft}s remaining
            </span>
          </div>
        )}
      </div>

      {/* Central Screen Renderer */}
      <div className="flex flex-col items-center justify-center flex-1 py-8 z-10 w-full">
        {gameState === "idle" && (
          /* Start Screen */
          <div className="flex flex-col items-center text-center w-full max-w-sm animate-fade-in duration-300">
            {/* Ambient visual cup floating */}
            <div className="relative w-40 h-52 flex flex-col justify-end items-center pointer-events-none select-none animate-float-cup my-8">
              <div className="absolute top-2 w-16 h-8 bg-zinc-700/80 border border-zinc-600/80 rounded-t-lg shadow" />
              <div className="absolute top-9 w-24 h-4 bg-zinc-800/80 border-y border-zinc-700/80" />
              <div className="w-24 h-36 bg-gradient-to-b from-zinc-850/40 to-zinc-950/60 border-2 border-zinc-800/60 rounded-b-2xl shadow-xl flex flex-col justify-end">
                <div className="h-[20%] w-full bg-gradient-to-t from-amber-950/60 to-amber-900/60 relative" />
              </div>
            </div>

            <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">
              Aerocano Challenge
            </h2>
            <p className="text-xs text-zinc-400 px-6 leading-relaxed mb-10 max-w-[280px]">
              How many shakes can you get in <strong className="text-amber-500 font-bold">15 seconds</strong>? Shake the espresso to froth the perfect crema!
            </p>

            <button
              type="button"
              onClick={startChallenge}
              className="w-full max-w-[260px] bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-zinc-950 font-black text-sm uppercase py-4 px-6 rounded-xl transition-all duration-200 shadow-xl shadow-amber-950/30 active:scale-95 border border-amber-300/30 font-sans tracking-wide relative z-30 pointer-events-auto cursor-pointer"
            >
              Start Challenge ⚡
            </button>

            {motionPermission === "denied" && (
              <div className="mt-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left w-full max-w-[280px] animate-fade-in duration-300">
                <p className="text-xs font-bold text-amber-500 mb-1.5 flex items-center gap-1.5">
                  <span>⚠️</span> Motion Permission Denied
                </p>
                <p className="text-[11px] text-zinc-400 leading-normal mb-2">
                  The sensor permission is blocked. To enable shake detection:
                </p>
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-white uppercase block mb-1">iOS Safari:</span>
                    <ol className="text-[11px] text-zinc-400 list-decimal pl-4 space-y-1">
                      <li>Tap the <span className="font-bold text-white font-mono">aA</span> icon in the address bar.</li>
                      <li>Select <span className="font-bold text-white">Website Settings</span>.</li>
                      <li>Set <span className="font-bold text-white">Motion & Orientation</span> to <span className="text-amber-500 font-bold">Ask</span> or <span className="text-amber-500 font-bold">Allow</span>.</li>
                    </ol>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-white uppercase block mb-1">Android Chrome:</span>
                    <ol className="text-[11px] text-zinc-400 list-decimal pl-4 space-y-1">
                      <li>Tap the settings/lock icon in the URL bar.</li>
                      <li>Select <span className="font-bold text-white">Permissions</span> or <span className="font-bold text-white">Site Settings</span>.</li>
                      <li>Allow <span className="font-bold text-white">Motion sensors</span>.</li>
                    </ol>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2 text-center">
                  Then reload this page to try again!
                </p>
              </div>
            )}
          </div>
        )}

        {gameState === "playing" && (
          /* Playing Shaker Screen */
          <div
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onTouchStart={(e) => {
              if (e.cancelable) e.preventDefault();
              if (e.touches[0]) handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
            }}
            className="relative focus:outline-none cursor-grab active:cursor-grabbing p-12 touch-none select-none z-10 flex flex-col items-center"
          >
            {/* Live Shake Counter HUD */}
            <div className="flex flex-col items-center mb-6">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest mb-1">Shakes</span>
              <div className="text-5xl font-black text-amber-500 font-mono tracking-tight animate-bounce drop-shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                {shakeCount}
              </div>
            </div>

            <div
              className={`absolute inset-4 bg-amber-500/10 rounded-full blur-2xl transition-all duration-350 pointer-events-none ${
                shaking ? "scale-130 opacity-100 bg-amber-500/25" : "scale-100 opacity-40"
              }`}
            />

            <div
              className="relative w-40 h-52 flex flex-col justify-end items-center pointer-events-none select-none"
              style={{
                transform: `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${rotation}deg)`,
                transition: isDragging ? "none" : "transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
            >
              <div className="absolute top-2 w-16 h-8 bg-zinc-700 border border-zinc-600 rounded-t-lg shadow-md z-20" />
              <div className="absolute top-9 w-24 h-4 bg-zinc-800 border-y border-zinc-700 shadow z-20" />
              
              <div className="w-24 h-36 bg-gradient-to-b from-zinc-800/40 via-zinc-900/60 to-zinc-950/80 border-2 border-zinc-700/60 rounded-b-2xl relative overflow-hidden flex flex-col justify-end shadow-2xl z-10">
                <div
                  className="w-full bg-gradient-to-t from-amber-950 to-amber-850 relative transition-all duration-300 origin-bottom"
                  style={{
                    height: `${Math.max(15, progress)}%`,
                    transform: `skewX(${sloshSkew}deg) scaleY(${1 + Math.abs(offsetY) * 0.001})`,
                  }}
                >
                  {/* Jittery Ice Cubes */}
                  <div
                    className={`absolute bottom-[20%] left-[12%] w-6 h-6 bg-white/10 border border-white/20 rounded-md backdrop-blur-[1px] ${
                      shaking ? "animate-rattle-ice" : "rotate-12"
                    }`}
                  >
                    <div className="w-3 h-3 m-1 bg-white/5 rounded-sm" />
                  </div>
                  <div
                    className={`absolute bottom-[40%] right-[15%] w-7 h-7 bg-white/10 border border-white/20 rounded-md backdrop-blur-[1px] ${
                      shaking ? "animate-rattle-ice" : "-rotate-12"
                    }`}
                    style={{ animationDelay: "0.04s" }}
                  >
                    <div className="w-4 h-4 m-1 bg-white/5 rounded-sm" />
                  </div>
                  <div
                    className={`absolute bottom-[65%] left-[30%] w-5 h-5 bg-white/10 border border-white/20 rounded-md backdrop-blur-[1px] ${
                      shaking ? "animate-rattle-ice" : "rotate-45"
                    }`}
                    style={{ animationDelay: "0.08s" }}
                  >
                    <div className="w-3 h-3 m-0.5 bg-white/5 rounded-sm" />
                  </div>

                  {/* Rising bubbles */}
                  {shakeCount > 0 && (
                    <div className="absolute inset-0 overflow-hidden">
                      <div className="absolute w-1 h-1 rounded-full bg-amber-300/40 bottom-[10%] left-[20%] animate-bubble-rise" />
                      <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-200/30 bottom-[30%] left-[65%] animate-bubble-rise" style={{ animationDelay: "0.4s" }} />
                      <div className="absolute w-1 h-1 rounded-full bg-amber-400/50 bottom-[50%] right-[15%] animate-bubble-rise" style={{ animationDelay: "0.8s" }} />
                      <div className="absolute w-2 h-2 rounded-full bg-amber-200/40 bottom-[20%] right-[40%] animate-bubble-rise" style={{ animationDelay: "1.2s" }} />
                    </div>
                  )}

                  {/* Crema layer */}
                  {shakeCount > 0 && (
                    <div
                      className="absolute -top-3 left-0 right-0 h-4 bg-amber-200/90 blur-[1px] animate-pulse rounded-t-full"
                      style={{
                        opacity: progress / 100,
                      }}
                    />
                  )}
                </div>
              </div>

              <span className="absolute -bottom-6 text-zinc-500 text-[9px] uppercase tracking-widest font-bold text-center w-max opacity-60">
                {isDesktop ? "← GRAB & SHAKE CUP →" : "← SWIPE OR SHAKE PHONE →"}
              </span>
            </div>
          </div>
        )}

        {gameState === "completed" && (
          /* Finished Victory Screen */
          <div className="flex flex-col items-center text-center w-full max-w-sm animate-fade-in duration-500">
            <div className="relative w-36 h-56 my-4 flex items-center justify-center">
              <div className="absolute inset-0 bg-amber-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" />

              <div className="relative w-24 h-48 border border-zinc-800 bg-zinc-900/30 rounded-t-md rounded-b-2xl overflow-hidden flex flex-col justify-end shadow-2xl backdrop-blur-sm">
                <div className="h-[70%] w-full bg-gradient-to-t from-zinc-950 via-amber-950 to-amber-900/90 relative overflow-hidden flex flex-col justify-end">
                  <div className="absolute bottom-6 left-3 w-7 h-7 bg-white/10 border border-white/20 rounded-md rotate-12 flex items-center justify-center">
                    <div className="w-5 h-5 bg-white/5 rounded-sm" />
                  </div>
                  <div className="absolute bottom-16 right-4 w-6 h-6 bg-white/10 border border-white/20 rounded-md -rotate-12 flex items-center justify-center">
                    <div className="w-4 h-4 bg-white/5 rounded-sm" />
                  </div>
                  <div className="absolute bottom-28 left-6 w-8 h-8 bg-white/10 border border-white/20 rounded-md rotate-45 flex items-center justify-center">
                    <div className="w-6 h-6 bg-white/5 rounded-sm" />
                  </div>
                </div>

                <div className="h-[30%] w-full bg-gradient-to-b from-amber-200/95 via-amber-300/80 to-amber-800/95 border-t border-amber-200/40 shadow-inner relative flex flex-col justify-between items-center py-2 animate-pulse">
                  <div className="flex gap-1.5 opacity-80">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/55 animate-ping" />
                    <span className="w-1 h-1 rounded-full bg-white/45" />
                    <span className="w-2 h-2 rounded-full bg-white/35" />
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-extrabold uppercase text-amber-500 tracking-wide">
              Challenge Completed! 🎉
            </h2>
            <div className="flex flex-col items-center mt-2 mb-6">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Your Score</span>
              <span className="text-4xl font-black text-white font-mono mt-0.5">{shakeCount} Shakes</span>
            </div>
            <p className="text-xs text-zinc-400 px-6 mb-8 leading-relaxed max-w-[280px]">
              You successfully frothed a velvety Aerocano crema!
            </p>

            {/* Name + Score submission */}
            <div className="w-full max-w-[240px] flex flex-col gap-3">
              {submitState !== "done" ? (
                <>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name..."
                    maxLength={40}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-amber-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition-colors text-center font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitScore}
                    disabled={!playerName.trim() || submitState === "loading"}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-black text-xs uppercase py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg active:scale-95 border border-amber-300/20 mb-1"
                  >
                    {submitState === "loading" ? "Submitting..." : "Submit Score 🚀"}
                  </button>
                  {submitState === "error" && (
                    <p className="text-xs text-red-400 text-center">Failed to submit. Try again!</p>
                  )}
                </>
              ) : (
                <div className="text-center py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                  <p className="text-emerald-400 font-bold text-sm">Score submitted! ✅</p>
                  <p className="text-zinc-400 text-xs mt-1">Check the leaderboard on the big screen.</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleResetToIdle}
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold text-xs uppercase py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg active:scale-95 border border-zinc-800"
              >
                Play Again 🔄
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Progress & Lower Status */}
      {gameState === "playing" && (
        <div className="flex flex-col items-center w-full gap-5 z-10">
          <div className="w-full font-sans">
            <div className="flex justify-between items-center text-xs text-zinc-400 mb-2 font-mono">
              <span>Crema froth</span>
              <span className="font-bold text-amber-500">{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-3.5 bg-zinc-900 border border-zinc-800 rounded-full overflow-hidden p-[2px]">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="text-xs font-bold uppercase tracking-wider text-center text-zinc-400 h-6">
            {getStatusText()}
          </p>

          {motionPermission === "denied" && (
            <p className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wide text-center mt-1 animate-pulse">
              ⚠️ Motion sensor denied. Swipe the cup to shake!
            </p>
          )}
        </div>
      )}
    </main>
  );
}
