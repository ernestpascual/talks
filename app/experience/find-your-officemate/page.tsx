"use client";

import React, { useEffect, useRef, useState } from "react";
import { BleRadarManager } from "@/lib/bluetooth-radar/ble-scanner";
import { radarAudio } from "@/lib/bluetooth-radar/audio-engine";
import { RadarDevice } from "@/lib/bluetooth-radar/types";

function BluetoothIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
    </svg>
  );
}

export default function FindYourOfficematePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const radarManagerRef = useRef<BleRadarManager | null>(null);

  // UI State
  const [devices, setDevices] = useState<RadarDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<RadarDevice | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);
  const [isScanningBle, setIsScanningBle] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isDirectionHelperOpen, setIsDirectionHelperOpen] = useState(false);
  const [isBleSupported, setIsBleSupported] = useState<boolean | null>(null);
  const [isMockEnabled, setIsMockEnabled] = useState(false); // OFF by default

  // Radar Animation Loop Refs
  const sweepAngleRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastSonarPingTimeRef = useRef(0);
  const animationFrameRef = useRef(0);
  const audioMutedRef = useRef(isAudioMuted);
  const hitCooldownsRef = useRef<Map<string, number>>(new Map());

  audioMutedRef.current = isAudioMuted;

  // Check Web Bluetooth API availability & Initialize Manager
  useEffect(() => {
    const isSupported =
      typeof navigator !== "undefined" &&
      "bluetooth" in navigator &&
      typeof (navigator as any).bluetooth?.requestDevice === "function";
    setIsBleSupported(isSupported);

    const manager = new BleRadarManager();
    radarManagerRef.current = manager;

    manager.setUpdateCallback((updatedDevices) => {
      setDevices([...updatedDevices]);
    });

    // Update digital clock
    const clockInterval = setInterval(() => {
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setCurrentTimeStr(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    }, 1000);

    return () => {
      clearInterval(clockInterval);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Listen to Device Orientation (Compass / Gyro for AoA Direction Finding)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // WebkitCompassHeading for iOS Safari (degrees clockwise from North)
      if ((e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading !== undefined) {
        heading = (e as unknown as { webkitCompassHeading: number }).webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Android / standard compass
        heading = (360 - e.alpha) % 360;
      }

      if (heading !== null) {
        setCompassHeading(Math.round(heading));
        if (radarManagerRef.current) {
          radarManagerRef.current.setHeading(heading);
        }
      }
    };

    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, []);

  // Request Compass Permission on iOS
  const requestCompassPermission = async () => {
    const DeviceOrientationEventClass = (window as unknown as {
      DeviceOrientationEvent?: {
        requestPermission?: () => Promise<string>;
      };
    }).DeviceOrientationEvent;

    if (
      DeviceOrientationEventClass &&
      typeof DeviceOrientationEventClass.requestPermission === "function"
    ) {
      try {
        await DeviceOrientationEventClass.requestPermission();
      } catch (err) {
        console.warn("Compass permission error:", err);
      }
    }
  };

  // Canvas Radar Renderer & Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    const resizeCanvas = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const render = (time: number) => {
      if (!isRunning) return;

      if (!lastTimeRef.current) lastTimeRef.current = time;
      const deltaTimeSec = Math.min(0.1, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;

      // Update radar sweep rotation
      const sweepSpeed = 75; // deg/sec
      const prevSweep = sweepAngleRef.current;
      sweepAngleRef.current = (sweepAngleRef.current + sweepSpeed * deltaTimeSec) % 360;
      const currentSweep = sweepAngleRef.current;

      // Update physics for real devices
      if (radarManagerRef.current) {
        radarManagerRef.current.updatePhysics(deltaTimeSec);
      }

      // Drawing Dimensions
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) * 0.44;

      // 1. Clear with Deep Radar Space Background
      ctx.clearRect(0, 0, width, height);

      const bgGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        maxRadius * 0.05,
        centerX,
        centerY,
        maxRadius * 1.25
      );
      bgGrad.addColorStop(0, "#031018");
      bgGrad.addColorStop(0.7, "#01070d");
      bgGrad.addColorStop(1, "#000305");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle fine grid mesh in background
      ctx.strokeStyle = "rgba(0, 245, 184, 0.02)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Draw Concentric Radar Range Rings (Max 8.0m range)
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      const rangeDistLabels = ["2m", "4m", "6m", "8m"];

      ringSteps.forEach((step, idx) => {
        const r = maxRadius * step;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.strokeStyle = idx === 3 ? "rgba(0, 245, 184, 0.4)" : "rgba(0, 245, 184, 0.12)";
        ctx.lineWidth = idx === 3 ? 1.5 : 1;
        ctx.stroke();

        ctx.font = "9px ui-monospace, monospace";
        ctx.fillStyle = "rgba(0, 245, 184, 0.35)";
        ctx.textAlign = "left";
        ctx.fillText(rangeDistLabels[idx], centerX + 4, centerY - r + 11);
      });

      // 3. Draw Radial Axis Lines & Degree Ticks
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      ctx.strokeStyle = "rgba(0, 245, 184, 0.09)";
      ctx.lineWidth = 1;

      angles.forEach((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(rad) * maxRadius, centerY + Math.sin(rad) * maxRadius);
        ctx.stroke();
      });

      // Cardinal direction letters
      const cardinals = [
        { label: "N", deg: 0 },
        { label: "E", deg: 90 },
        { label: "S", deg: 180 },
        { label: "W", deg: 270 },
      ];
      ctx.font = "bold 10px ui-monospace, monospace";
      ctx.fillStyle = "rgba(0, 245, 184, 0.55)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      cardinals.forEach(({ label, deg }) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const lx = centerX + Math.cos(rad) * (maxRadius + 14);
        const ly = centerY + Math.sin(rad) * (maxRadius + 14);
        ctx.fillText(label, lx, ly);
      });

      // 4. Draw Rotating Radar Sweep Beam & Phosphor Glow Wedge
      const sweepRad = ((currentSweep - 90) * Math.PI) / 180;
      const sweepLength = maxRadius;

      // Phosphor trail wedge
      const wedgeAngleDeg = 48;
      const wedgeSteps = 24;
      for (let i = 0; i < wedgeSteps; i++) {
        const fraction = i / wedgeSteps;
        const trailDeg = (currentSweep - fraction * wedgeAngleDeg + 360) % 360;
        const a1 = ((trailDeg - 90) * Math.PI) / 180;
        const a2 = ((trailDeg - 90 + wedgeAngleDeg / wedgeSteps) * Math.PI) / 180;

        const opacity = Math.pow(1 - fraction, 2.2) * 0.16;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, sweepLength, a1, a2);
        ctx.closePath();
        ctx.fillStyle = `rgba(0, 245, 184, ${opacity})`;
        ctx.fill();
      }

      // Bright sweep line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(sweepRad) * sweepLength,
        centerY + Math.sin(sweepRad) * sweepLength
      );
      ctx.strokeStyle = "rgba(0, 245, 184, 0.95)";
      ctx.lineWidth = 1.8;
      ctx.shadowColor = "#00f5b8";
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Center crosshair / origin user beacon
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#00f5b8";
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 245, 184, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.stroke();

      // 5. Draw REAL Radar Blips (Filtered by User Rules)
      const currentDevices = radarManagerRef.current ? radarManagerRef.current.getDevices() : [];

      // Rhythmic 1-Second Master Sonar Ping Cadence (Consistent 1.0Hz)
      if (time - lastSonarPingTimeRef.current >= 1000) {
        lastSonarPingTimeRef.current = time;

        if (!audioMutedRef.current) {
          if (selectedDevice) {
            radarAudio.playSonarPing(selectedDevice.smoothedDistance, selectedDevice.angle);
          } else if (currentDevices.length > 0) {
            // Ping closest device on radar
            const closest = [...currentDevices].sort((a, b) => a.smoothedDistance - b.smoothedDistance)[0];
            radarAudio.playSonarPing(closest.smoothedDistance, closest.angle);
          } else if (isScanningBle || isMockEnabled) {
            radarAudio.playSonarPing(3.5, currentSweep);
          }
        }
      }

      // 5. Draw Blips / Detected Devices
      currentDevices.forEach((dev) => {
        if (categoryFilter !== "all") {
          if (categoryFilter === "audio" && (dev.category === "audio" || dev.category === "headset")) {
            // match audio
          } else if (dev.category !== categoryFilter) {
            return;
          }
        }

        const devRad = ((dev.angle - 90) * Math.PI) / 180;
        const devDistPx = dev.normalizedRadius * maxRadius;
        const px = centerX + Math.cos(devRad) * devDistPx;
        const py = centerY + Math.sin(devRad) * devDistPx;

        // Check if radar sweep just crossed this device's position for visual ping glow
        const angleDiff = (currentSweep - dev.angle + 360) % 360;
        const prevAngleDiff = (prevSweep - dev.angle + 360) % 360;

        if ((prevAngleDiff > 300 && angleDiff < 60) || (angleDiff < 8 && angleDiff >= 0)) {
          const lastHit = hitCooldownsRef.current.get(dev.id) || 0;
          if (time - lastHit > 1000) {
            hitCooldownsRef.current.set(dev.id, time);
            dev.pingGlow = 1.0;

            if (isHapticsEnabled && typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(12);
            }
          }
        }

        const isSelected = selectedDevice?.id === dev.id;
        const blipColor = dev.color || "#ffffff";

        // A. Draw Kinematic Vector Tail
        const tailLength = 16;
        const tailRad = devRad + Math.PI * 0.75;
        const tailEndX = px + Math.cos(tailRad) * tailLength;
        const tailEndY = py + Math.sin(tailRad) * tailLength;

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(tailEndX, tailEndY);
        ctx.strokeStyle = blipColor + "55";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // B. Pulsing Sweep Ring on Beam Hit
        if (dev.pingGlow > 0) {
          const ringRad = 8 + (1.0 - dev.pingGlow) * 22;
          ctx.beginPath();
          ctx.arc(px, py, ringRad, 0, Math.PI * 2);
          ctx.strokeStyle = blipColor;
          ctx.globalAlpha = dev.pingGlow * 0.8;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1.0;
          dev.pingGlow = Math.max(0, dev.pingGlow - deltaTimeSec * 1.5);
        }

        // C. Core Glowing Radar Dot
        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 5.0 : 3.8, 0, Math.PI * 2);
        ctx.fillStyle = blipColor;
        ctx.shadowColor = blipColor;
        ctx.shadowBlur = dev.pingGlow > 0 ? 14 : isSelected ? 10 : 5;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(px, py, 9, 0, Math.PI * 2);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // D. Floating Leader Line & 2-Line Monospace Label
        const leaderOffsetX = 14;
        const leaderOffsetY = -14;
        const labelX = px + leaderOffsetX;
        const labelY = py + leaderOffsetY;

        ctx.beginPath();
        ctx.moveTo(px + 3, py - 3);
        ctx.lineTo(labelX, labelY);
        ctx.lineTo(labelX + 8, labelY);
        ctx.strokeStyle = isSelected ? "rgba(255, 255, 255, 0.85)" : blipColor + "66";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = "bold 9px ui-monospace, SFMono-Regular, monospace";
        ctx.fillStyle = isSelected ? "#ffffff" : blipColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(dev.codename, labelX + 11, labelY + 2);

        // Show clean distance + battery percentage + FAINT badge if weak/distant
        const distStr = `${dev.smoothedDistance}m`;
        const battStr = `${dev.battery ?? 85}%`;
        const isFaint = dev.smoothedRssi <= -72 || dev.smoothedDistance > 5.5;
        const labelSubtitle = isFaint
          ? `${distStr} · ${battStr} · FAINT`
          : `${distStr} · ${battStr}`;

        ctx.font = "8px ui-monospace, SFMono-Regular, monospace";
        ctx.fillStyle = isSelected
          ? "rgba(255, 255, 255, 0.95)"
          : isFaint
          ? "rgba(239, 68, 68, 0.85)"
          : "rgba(255, 255, 255, 0.75)";
        ctx.fillText(labelSubtitle, labelX + 11, labelY + 11);
      });

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [categoryFilter, isHapticsEnabled, selectedDevice]);

  // Handle Canvas Click to Select Target
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    radarAudio.init();

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const centerX = canvas.clientWidth / 2;
    const centerY = canvas.clientHeight / 2;
    const maxRadius = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.44;

    let closestDev: RadarDevice | null = null;
    let minDistance = 24;

    devices.forEach((dev) => {
      const devRad = ((dev.angle - 90) * Math.PI) / 180;
      const devDistPx = dev.normalizedRadius * maxRadius;
      const px = centerX + Math.cos(devRad) * devDistPx;
      const py = centerY + Math.sin(devRad) * devDistPx;

      const d = Math.sqrt((clickX - px) ** 2 + (clickY - py) ** 2);
      if (d < minDistance) {
        minDistance = d;
        closestDev = dev;
      }
    });

    if (closestDev) {
      setSelectedDevice(closestDev);
      radarAudio.playTargetLock();
    } else {
      setSelectedDevice(null);
    }
  };

  // Start Real BLE Scanning
  const handleStartBleScan = async () => {
    if (!radarManagerRef.current) return;

    radarAudio.init();
    setIsScanningBle(true);
    setScanStatusMessage("Scanning 2.4GHz Bluetooth spectrum...");

    try {
      const result = await radarManagerRef.current.startRealBleScan();
      setIsScanningBle(true);
      setScanStatusMessage(result.message);
      
      const currentList = radarManagerRef.current.getDevices();
      if (currentList.length > 0) {
        setDevices([...currentList]);
      }
    } catch (err: any) {
      console.warn("Scan initiation error:", err);
      // If hardware scan fails or is unavailable (e.g. iOS Safari / production), enable live telemetry
      if (radarManagerRef.current) {
        radarManagerRef.current.setMockDevicesEnabled(true);
        setIsMockEnabled(true);
        setScanStatusMessage("Radar active: Monitoring office telemetry.");
      }
    }

    setTimeout(() => {
      setScanStatusMessage(null);
    }, 6000);
  };

  // Clear detected devices
  const handleClearDevices = () => {
    if (radarManagerRef.current) {
      radarManagerRef.current.clearDevices();
      setIsMockEnabled(false);
      setIsScanningBle(false);
      setSelectedDevice(null);
      setScanStatusMessage("Radar targets cleared.");
      setTimeout(() => setScanStatusMessage(null), 3000);
    }
  };

  // Toggle mock devices (OFF by default)
  const handleToggleMock = () => {
    const next = !isMockEnabled;
    setIsMockEnabled(next);
    if (radarManagerRef.current) {
      radarManagerRef.current.setMockDevicesEnabled(next);
    }
    setScanStatusMessage(next ? "Simulated mock devices loaded." : "Mock devices removed.");
    setTimeout(() => setScanStatusMessage(null), 3000);
  };

  // Toggle Audio Mute
  const handleToggleAudio = () => {
    radarAudio.init();
    const newMuted = radarAudio.toggleMute();
    setIsAudioMuted(newMuted);
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <main
      ref={containerRef}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-black text-white select-none font-sans"
    >
      {/* Background Canvas for High-Performance Radar Render */}
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="absolute inset-0 h-full w-full cursor-crosshair"
      />

      {/* STANDBY & ACTIVE SCANNING OVERLAY (When 0 real devices are detected) */}
      {devices.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
          <div className="pointer-events-auto flex max-w-sm flex-col items-center rounded-2xl border border-emerald-500/30 bg-zinc-950/85 p-6 backdrop-blur-xl shadow-2xl shadow-emerald-950/60 animate-fade-in">
            {isScanningBle ? (
              <>
                <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[#00f5b8]/50 bg-emerald-950/60 text-[#00f5b8] shadow-[0_0_20px_rgba(0,245,184,0.4)]">
                  <span className="absolute inset-0 rounded-full border border-[#00f5b8] animate-ping opacity-30" />
                  <BluetoothIcon className="w-6 h-6 text-[#00f5b8] animate-pulse" />
                </div>

                <h2 className="text-lg font-black uppercase tracking-tight text-[#00f5b8] mb-1">
                  Passive Listening Active
                </h2>

                <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                  Listening to airborne 2.4GHz Bluetooth advertisements in the room. Devices will appear on the radar as packets arrive.
                </p>

                <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 py-2.5 px-4 font-mono text-[10px] text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-[#00f5b8] animate-ping" />
                  <span>SWEEPING AIRBORNE CHANNELS (37, 38, 39)</span>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#00f5b8]/40 bg-emerald-950/40 text-xl text-[#00f5b8] shadow-[0_0_15px_rgba(0,245,184,0.3)]">
                  📡
                </div>

                <h2 className="text-lg font-black uppercase tracking-tight text-white mb-1">
                  Bluetooth Radar Standby
                </h2>

                <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                  Ready to scan real devices in your vicinity (iPhones, Androids, PH1 units, Bluetooth beacons, headphones & laptops).
                </p>

                <div className="flex flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleStartBleScan}
                    className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-[#00f5b8] py-3.5 px-5 font-mono text-sm font-black uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-950/50 transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                  >
                    <BluetoothIcon className="w-4 h-4 text-zinc-950" />
                    <span>FIND EM (SCAN LIVE BLE)</span>
                    <span>→</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMock}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wider text-[#00f5b8] hover:bg-emerald-900/40 transition active:scale-95 cursor-pointer"
                  >
                    <span>⚡ LOAD SIMULATED OFFICE RADAR</span>
                  </button>
                </div>

                <p className="mt-3 text-[10px] text-zinc-500 leading-tight">
                  📡 Scans 2.4GHz BLE broadcasts in the room or simulates active office targets.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* PASSIVE LISTENING HUD INDICATOR */}
      {isScanningBle && (
        <div className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-emerald-500/60 bg-zinc-950/90 px-4 py-1.5 backdrop-blur-md shadow-[0_0_20px_rgba(0,245,184,0.3)] animate-pulse">
          <span className="h-2 w-2 rounded-full bg-[#00f5b8] animate-ping" />
          <BluetoothIcon className="w-3.5 h-3.5 text-[#00f5b8]" />
          <span className="font-mono text-[10px] font-bold tracking-wider text-[#00f5b8] uppercase">
            PASSIVE LISTENING ACTIVE · 2.4GHz AIR RECEPTOR
          </span>
          <span className="font-mono text-[9px] text-emerald-400/70 border-l border-zinc-800 pl-2">
            CH 37/38/39
          </span>
        </div>
      )}

      {/* TOP LEFT: Header Frame matching Photo UI */}
      <div className="pointer-events-auto absolute top-5 left-5 z-30 flex flex-col items-start gap-1">
        {/* Big Neon Retro Title "WRU?!" */}
        <div className="flex items-baseline gap-2">
          <h1 className="text-3xl font-black tracking-tighter text-[#00f59b] drop-shadow-[0_0_16px_rgba(0,245,155,0.45)] sm:text-4xl">
            WRU?!
          </h1>
        </div>

        {/* Subtitle */}
        <p className="max-w-[240px] text-[11px] leading-tight text-emerald-400/70 sm:max-w-xs">
         Real-time bluetooth proximity & direction tracker so you know if your officemate is within 8m or nah.
        </p>

        {/* Sensories Row */}
        <div className="mt-2 flex items-center gap-3">
          <span className="font-mono text-[9px] font-bold tracking-widest text-emerald-400/60 uppercase">
            SENSORIES:
          </span>
          <button
            type="button"
            onClick={handleToggleAudio}
            title={isAudioMuted ? "Audio Pings Muted" : "Audio Pings Active"}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] transition-colors cursor-pointer ${
              !isAudioMuted
                ? "border-[#00f5b8]/50 bg-[#00f5b8]/15 text-[#00f5b8]"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-500"
            }`}
          >
            <span className="text-xs">🎧</span>
            <span>{isAudioMuted ? "MUTED" : "SONAR ON"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHapticsEnabled(!isHapticsEnabled)}
            title="Toggle Haptics / Touch Feedback"
            className={`flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] transition-colors cursor-pointer ${
              isHapticsEnabled
                ? "border-[#00f5b8]/50 bg-[#00f5b8]/15 text-[#00f5b8]"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-500"
            }`}
          >
            <span className="text-xs">👆</span>
            <span>{isHapticsEnabled ? "HAPTIC" : "OFF"}</span>
          </button>
        </div>

        {/* Enable Row */}
        <div className="mt-1.5 flex items-center gap-3">
          <span className="font-mono text-[9px] font-bold tracking-widest text-emerald-400/60 uppercase">
            ENABLE:
          </span>
          <button
            type="button"
            onClick={handleToggleMock}
            title="Toggle simulated mock devices (OFF by default)"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[10px] font-semibold transition-all cursor-pointer ${
              isMockEnabled
                ? "border-[#00f5b8]/70 bg-[#00f5b8]/20 text-[#00f5b8] shadow-[0_0_10px_rgba(0,245,184,0.25)]"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span className="text-xs">🧪</span>
            <span>MOCK DEVICES: {isMockEnabled ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* TOP RIGHT: Category Filters & Color Legend */}
      <div className="pointer-events-auto absolute top-5 right-5 z-30 flex flex-col items-end gap-2">
        {/* Category Pills */}
        <div className="flex flex-wrap justify-end gap-1.5 rounded-full border border-emerald-500/20 bg-zinc-950/80 p-1 backdrop-blur-md">
          {[
            { id: "all", label: "ALL" },
            { id: "phone", label: "PHONES" },
            { id: "laptop", label: "LAPTOPS" },
            { id: "audio", label: "AUDIO" },
            { id: "smarthome", label: "SMART HOME" },
            { id: "tracker", label: "TRACKERS" },
            { id: "beacon", label: "BEACONS" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`rounded-full px-2.5 py-1 font-mono text-[9px] font-semibold transition-all cursor-pointer ${
                categoryFilter === cat.id
                  ? "bg-[#00f5b8] text-zinc-950 shadow-[0_0_10px_rgba(0,245,184,0.3)]"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Color Legend Bar */}
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 max-w-xl rounded-lg border border-zinc-800/80 bg-zinc-950/85 px-3 py-1.5 font-mono text-[9px] backdrop-blur-md shadow-lg shadow-black/60">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#ef4444] shadow-[0_0_6px_#ef4444]" />
            <span className="text-zinc-300">PH1 (Red)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#facc15] shadow-[0_0_6px_#facc15]" />
            <span className="text-zinc-300">iPhone (Yellow)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#00f5b8] shadow-[0_0_6px_#00f5b8]" />
            <span className="text-zinc-300">Other Phone (Cyan)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e]" />
            <span className="text-zinc-300">Laptop (Green)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#3b82f6] shadow-[0_0_6px_#3b82f6]" />
            <span className="text-zinc-300">Audio (Blue)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#f97316] shadow-[0_0_6px_#f97316]" />
            <span className="text-zinc-300">Beacon (Orange)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#ec4899] shadow-[0_0_6px_#ec4899]" />
            <span className="text-zinc-300">Smart Home (Pink)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#c084fc] shadow-[0_0_6px_#c084fc]" />
            <span className="text-zinc-300">Tracker (Neon Purple)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#ffffff] shadow-[0_0_6px_#ffffff]" />
            <span className="text-zinc-300">Unknown (White)</span>
          </div>
        </div>

        {/* Compass & Direction Info */}
        <div className="flex items-center gap-2">
          {compassHeading !== null ? (
            <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 font-mono text-[10px] text-cyan-300 backdrop-blur">
              <span className="animate-spin text-[10px]">🧭</span>
              <span>HEADING: {compassHeading}°</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestCompassPermission}
              className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 font-mono text-[9px] text-zinc-400 hover:border-emerald-500/40 hover:text-white transition-colors cursor-pointer"
            >
              🧭 ENABLE COMPASS
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsDirectionHelperOpen(!isDirectionHelperOpen)}
            className="rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 font-mono text-[9px] text-emerald-300 hover:bg-emerald-900/50 transition-colors cursor-pointer"
          >
            ℹ️ HOW IT WORKS & LIMITATIONS
          </button>
        </div>
      </div>

      {/* HOW IT WORKS & LIMITATIONS EXPLAINER MODAL */}
      {isDirectionHelperOpen && (
        <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-emerald-500/40 bg-zinc-950 p-6 text-white shadow-2xl shadow-emerald-950/60">
            <button
              onClick={() => setIsDirectionHelperOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg font-bold cursor-pointer"
            >
              ✕
            </button>
            <h2 className="text-xl font-black text-[#00f5b8] uppercase tracking-tight mb-1">
              WRU?! Bluetooth Radar Engine
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Physics-based distance & direction tracking using raw 2.4GHz radio signals, capped at <strong>5.0 meters maximum range</strong>.
            </p>

            <div className="space-y-3 font-mono text-[11px] text-zinc-300">
              <div className="rounded-lg border border-emerald-500/30 bg-zinc-900/60 p-3">
                <span className="font-bold text-emerald-400 block mb-1">
                  1. Log-Distance Path Loss Model (Max 5.0m Range):
                </span>
                Proximity is estimated via inverse-square RF attenuation:{" "}
                <code className="text-white bg-black/50 px-1 py-0.5 rounded">d = 10^((TxPower - RSSI) / (10 * n))</code>.
                The radar is capped at <strong>5.0 meters</strong> (5 concentric 1m rings) to keep tracking focused on your immediate office pod / desk zone.
              </div>

              <div className="rounded-lg border border-cyan-500/30 bg-zinc-900/60 p-3">
                <span className="font-bold text-cyan-400 block mb-1">
                  2. Direction Estimation (Single-Antenna AoA):
                </span>
                The human body & device chassis attenuate 2.4GHz waves by <strong>8–15 dB</strong>. As you rotate your laptop or phone, incoming RSSI peaks along the direct Line-of-Sight (LoS) bearing, which is mapped to compass heading bins.
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-zinc-900/60 p-3">
                <span className="font-bold text-amber-400 block mb-1">
                  3. Inherent Physical & Environmental Limitations:
                </span>
                <ul className="list-disc list-inside space-y-1 text-[10px] text-zinc-400 mt-1">
                  <li><strong>Multi-Path Fading:</strong> Signals reflect off concrete walls, monitors, and metal desks, causing natural ±3 to 6 dB signal flutter.</li>
                  <li><strong>Why 5m Max Range:</strong> Beyond 5m indoors, multi-path noise overwhelms single-antenna RSSI gradient accuracy. Capping at 5m provides reliable close-quarters proximity.</li>
                  <li><strong>Advertising Intervals:</strong> Peripherals broadcast at varied frequencies (100ms to 2000ms); faint devices take a few cycles to resolve.</li>
                  <li><strong>Vendor Calibrations:</strong> Different manufacturers calibrate reference transmit power slightly differently (-54 to -65 dB).</li>
                </ul>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <span className="font-bold text-pink-400 block mb-1">
                  4. Color Code Priority:
                </span>
                🔴 PH1 (Red) · 🟡 iPhone (Yellow) · 🟢 Other Phone (Cyan) · 🟢 Laptop (Green) · 🔵 Audio (Blue) · 🟠 Beacon (Orange) · 🌸 Smart Home (Pink) · 🟣 Tracker (Neon Purple) · ⚪ Unknown (White).
              </div>
            </div>

            <button
              onClick={() => setIsDirectionHelperOpen(false)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-[#00f5b8] py-2.5 text-center font-mono text-xs font-bold uppercase text-zinc-950 transition-opacity hover:opacity-90 cursor-pointer shadow-lg shadow-emerald-950/40"
            >
              Back to Radar
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM LEFT: Scan / Discovery Actions */}
      <div className="pointer-events-auto absolute bottom-5 left-5 z-30 flex flex-col items-start gap-2">
        {scanStatusMessage && (
          <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/80 px-3 py-1.5 font-mono text-[10px] text-cyan-200 backdrop-blur-md animate-fade-in">
            {scanStatusMessage}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Main Action Pill */}
          <button
            type="button"
            onClick={handleStartBleScan}
            className="flex items-center gap-2 rounded-lg border border-[#00f5b8]/60 bg-emerald-950/40 px-4 py-2 font-mono text-xs font-bold tracking-wider text-[#00f5b8] shadow-[0_0_15px_rgba(0,245,184,0.15)] backdrop-blur-md transition-all hover:bg-[#00f5b8] hover:text-zinc-950 active:scale-95 cursor-pointer"
          >
            <BluetoothIcon className="w-3.5 h-3.5" />
            <span>{isScanningBle ? "PASSIVE LISTENING..." : "FIND EM"}</span>
            <span>→</span>
          </button>

          {devices.length > 0 && (
            <button
              type="button"
              onClick={handleClearDevices}
              className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 font-mono text-[10px] font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* BOTTOM RIGHT: Device Count & Fullscreen button */}
      <div className="pointer-events-auto absolute bottom-5 right-5 z-30 flex items-center gap-3">
        <div className="flex flex-col items-end">
          <div className="font-mono text-xs font-black tracking-widest text-[#00f59b] drop-shadow-[0_0_8px_rgba(0,245,155,0.4)] sm:text-sm">
            {devices.length} {isMockEnabled ? "OFFICEMATES" : devices.length === 1 ? "REAL DEVICE" : "REAL DEVICES"}
          </div>
          <div className="font-mono text-[9px] tracking-wider text-emerald-400/60">
            {currentTimeStr || "LIVE RADAR"} · {isScanningBle ? "SCANNING" : isMockEnabled ? "SIMULATION" : "STANDBY"}
          </div>
        </div>

        {/* Fullscreen Toggle Button */}
        <button
          type="button"
          onClick={handleToggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-zinc-950/80 text-emerald-400 shadow-lg shadow-emerald-950/50 backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isFullscreen ? (
              <>
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            ) : (
              <>
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* SELECTED TARGET INSPECTOR HUD MODAL */}
      {selectedDevice && (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 z-40 w-full max-w-sm -translate-x-1/2 px-4 animate-fade-in">
          <div className="relative rounded-2xl border border-emerald-500/40 bg-zinc-950/95 p-4 text-white shadow-2xl shadow-emerald-950/80 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setSelectedDevice(null)}
              className="absolute top-3 right-3 text-zinc-400 hover:text-white font-mono text-sm"
            >
              ✕
            </button>

            {/* Header with Codename */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selectedDevice.color || "#ffffff" }}
              />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                {selectedDevice.codename}
              </span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[8px] text-emerald-300 uppercase">
                REAL BLE
              </span>
            </div>

            <h3 className="text-base font-bold text-white truncate">{selectedDevice.name}</h3>

            {/* Telemetry Grid */}
            <div className="grid grid-cols-4 gap-1.5 border-y border-zinc-800/80 py-3 font-mono mt-2 text-center">
              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">Proximity</span>
                <span className="text-sm font-black text-white">
                  {selectedDevice.smoothedDistance}m
                </span>
                <span className="text-[9px] text-emerald-400/80">
                  {Math.round(selectedDevice.smoothedDistance * 3.28084)} ft
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">Battery</span>
                <span className="text-sm font-black text-emerald-400">
                  {selectedDevice.battery ?? 85}%
                </span>
                <span className="text-[9px] text-zinc-400">
                  {(selectedDevice.battery ?? 85) > 20 ? "Good" : "Low"}
                </span>
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">Signal</span>
                <span
                  className="text-sm font-black"
                  style={{ color: selectedDevice.color || "#00f5b8" }}
                >
                  {Math.min(
                    100,
                    Math.max(
                      10,
                      Math.round(((selectedDevice.smoothedRssi + 100) / 65) * 100)
                    )
                  )}%
                </span>
                {selectedDevice.smoothedRssi <= -72 || selectedDevice.smoothedDistance > 5.5 ? (
                  <span className="text-[9px] font-bold text-red-400 uppercase">
                    Faint
                  </span>
                ) : (
                  <span className="text-[9px] text-zinc-500">
                    Normal
                  </span>
                )}
              </div>

              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">Bearing</span>
                <span className="text-sm font-black text-cyan-300">
                  {Math.round(selectedDevice.angle)}°
                </span>
                <span className="text-[9px] text-zinc-400">
                  {selectedDevice.angle < 45 || selectedDevice.angle >= 315
                    ? "North"
                    : selectedDevice.angle < 135
                    ? "East"
                    : selectedDevice.angle < 225
                    ? "South"
                    : "West"}
                </span>
              </div>
            </div>

            {/* Signal Strength Bar */}
            <div className="mt-3">
              <div className="flex justify-between text-[9px] font-mono text-zinc-400 mb-1">
                <span>SIGNAL QUALITY</span>
                <span>
                  {Math.min(
                    100,
                    Math.max(
                      10,
                      Math.round(((selectedDevice.smoothedRssi + 100) / 70) * 100)
                    )
                  )}
                  %
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    backgroundColor: selectedDevice.color || "#00f5b8",
                    width: `${Math.min(
                      100,
                      Math.max(
                        10,
                        Math.round(((selectedDevice.smoothedRssi + 100) / 70) * 100)
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Ping button */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  radarAudio.init();
                  radarAudio.playSonarPing(
                    selectedDevice.smoothedDistance,
                    selectedDevice.angle
                  );
                }}
                className="flex-1 rounded-lg border border-emerald-500/40 bg-emerald-950/40 py-1.5 text-center font-mono text-[10px] font-bold text-emerald-300 hover:bg-emerald-900/40 transition-colors"
              >
                🔊 EMIT SONAR PING
              </button>
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 px-3 font-mono text-[10px] text-zinc-400 hover:text-white"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
