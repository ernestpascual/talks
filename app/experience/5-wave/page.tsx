"use client";

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";

import DmapFrame from "@/app/experience/dmap/DmapFrame";
import DmapSuccess from "@/app/experience/dmap/DmapSuccess";
import { useDmapConfig } from "@/app/experience/dmap/useDmapConfig";
import type { DmapConfig } from "@/lib/dmap";

const WASM_URLS = [
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
];
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

type Direction = "idle" | "left" | "right";
type CameraFacing = "user" | "environment";
type Landmark = { x: number; y: number; z: number };
type WaveConfig = DmapConfig["wave"];

interface TrackingBox {
  centerX: number;
  centerY: number;
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
}

function validOpenHand(landmarks: Landmark[], config: WaveConfig) {
  if (landmarks.length < 21) return false;
  const wrist = landmarks[0];
  const fingertips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
  if (fingertips.filter((tip) => tip.y < wrist.y).length < config.minFingertipsAboveWrist) return false;

  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 0.01 || height < 0.01) return false;
  const aspectRatio = width / height;
  if (aspectRatio < config.minHandAspectRatio || aspectRatio > config.maxHandAspectRatio) return false;
  if ((wrist.y - minY) / height < config.minWristRelativeY) return false;
  const fingertipXs = fingertips.map((tip) => tip.x);
  return Math.max(...fingertipXs) - Math.min(...fingertipXs) >= width * config.minFingertipSpreadRatio;
}

function trackingBox(landmarks: Landmark[], paddingRatio: number): TrackingBox {
  const xs = landmarks.map((point) => point.x);
  const ys = landmarks.map((point) => point.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  const paddingX = (maxX - minX) * paddingRatio;
  const paddingY = (maxY - minY) * paddingRatio;
  minX = Math.max(0, minX - paddingX);
  maxX = Math.min(1, maxX + paddingX);
  minY = Math.max(0, minY - paddingY);
  maxY = Math.min(1, maxY + paddingY);
  return { minX, maxX, minY, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
}

function drawTrackerHud(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, box: TrackingBox, landmarks: Landmark[], now: number) {
  const center = landmarks[9] ?? landmarks[0];
  const centerX = (box.centerX ?? center.x) * canvas.width;
  const centerY = (box.centerY ?? center.y) * canvas.height;
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, 4.5, 0, Math.PI * 2);
  context.fillStyle = "#00F0FF";
  context.shadowColor = "#00F0FF";
  context.shadowBlur = 8;
  context.fill();
  for (let index = 0; index < 2; index += 1) {
    const phase = ((now + index * 700) % 1400) / 1400;
    context.beginPath();
    context.arc(centerX, centerY, 6 + phase * 65, 0, Math.PI * 2);
    context.strokeStyle = `rgba(0, 240, 255, ${Math.max(0, (1 - phase) * 0.85).toFixed(3)})`;
    context.lineWidth = 1.5;
    context.shadowBlur = 6 * (1 - phase);
    context.stroke();
  }
  context.restore();
  const dotCycle = now % 1600 / 1600;
  const dots = `${dotCycle > 0.15 ? "." : ""}${dotCycle > 0.4 ? "." : ""}${dotCycle > 0.65 ? "." : ""}`;
  context.save();
  context.font = "9px monospace";
  context.fillStyle = "#FFFFFF";
  context.textAlign = "center";
  context.fillText(`TRACKING${dots}`, Math.max(45, Math.min(canvas.width - 45, centerX)), centerY + 24 < canvas.height - 15 ? centerY + 24 : centerY - 20);
  context.restore();
}

export default function FiveWavePage() {
  const config = useDmapConfig().wave;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<HandLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const lastDetectionAtRef = useRef(0);
  const trackerRef = useRef({
    direction: "idle" as Direction,
    lastCountAt: 0,
    peakX: null as number | null,
    smoothedX: null as number | null,
    startedAt: 0,
    startX: null as number | null,
  });
  const waveCountRef = useRef(0);

  const [active, setActive] = useState(false);
  const [complete, setComplete] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacing>("user");
  const [handDetected, setHandDetected] = useState(false);
  const [mediaPipeReady, setMediaPipeReady] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [status, setStatus] = useState("CAMERA SENSOR STANDBY");
  const [waveCount, setWaveCount] = useState(0);

  const resetTracking = useCallback(() => {
    trackerRef.current = { direction: "idle", lastCountAt: 0, peakX: null, smoothedX: null, startedAt: 0, startX: null };
    previousFrameRef.current = null;
    lastDetectionAtRef.current = 0;
    waveCountRef.current = 0;
    setWaveCount(0);
    setComplete(false);
  }, []);

  const recordWave = useCallback((now: number) => {
    const tracker = trackerRef.current;
    if (now - tracker.lastCountAt < config.minWaveGapMs) return;
    tracker.lastCountAt = now;
    const next = Math.min(config.targetWaves, waveCountRef.current + 1);
    waveCountRef.current = next;
    setWaveCount(next);
    navigator.vibrate?.(60);
    if (next >= config.targetWaves) {
      setComplete(true);
      setStatus("✓ CONNECTION SUCCESSFUL! ALLIANCE SYNCHRONIZED!");
      navigator.vibrate?.([80, 60, 120]);
    } else {
      setStatus(`WAVE ${next} OF ${config.targetWaves} CONFIRMED! KEEP WAVING...`);
    }
  }, [config.minWaveGapMs, config.targetWaves]);

  const evaluateWave = useCallback((rawX: number, now: number) => {
    const state = trackerRef.current;
    if (state.smoothedX === null) {
      state.smoothedX = rawX;
      state.startX = rawX;
      state.peakX = rawX;
      state.startedAt = now;
      return;
    }

    const smoothing = Math.max(0, Math.min(1, config.smoothingFactor));
    const x = state.smoothedX * (1 - smoothing) + rawX * smoothing;
    state.smoothedX = x;
    if (state.startX === null || state.peakX === null) return;

    if (state.direction === "idle") {
      const delta = x - state.startX;
      if (Math.abs(delta) >= config.minInitialDelta) {
        state.direction = delta > 0 ? "right" : "left";
        state.peakX = x;
        state.startedAt = now;
      }
      return;
    }

    const movingRight = state.direction === "right";
    const extending = movingRight ? x > state.peakX : x < state.peakX;
    if (extending) {
      state.peakX = x;
      return;
    }

    const reversal = Math.abs(state.peakX - x);
    if (reversal < config.minReversalDistance) return;
    const distance = Math.abs(state.peakX - state.startX);
    const duration = now - state.startedAt;
    if (distance >= config.minStrokeDistance && duration >= config.minStrokeDurationMs && duration <= config.maxStrokeDurationMs) {
      recordWave(now);
    }
    state.direction = movingRight ? "left" : "right";
    state.startX = state.peakX;
    state.peakX = x;
    state.startedAt = now;
  }, [config, recordWave]);

  const processOpticalMotion = useCallback((video: HTMLVideoElement): TrackingBox | null => {
    const width = 64;
    const height = 48;
    if (!fallbackCanvasRef.current) {
      fallbackCanvasRef.current = document.createElement("canvas");
      fallbackCanvasRef.current.width = width;
      fallbackCanvasRef.current.height = height;
    }
    const context = fallbackCanvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    try {
      context.drawImage(video, 0, 0, width, height);
      const current = context.getImageData(0, 0, width, height).data;
      const previous = previousFrameRef.current;
      if (!previous || previous.length !== current.length) {
        previousFrameRef.current = new Uint8ClampedArray(current);
        return null;
      }

      let changedPixels = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;
      for (let index = 0; index < current.length; index += 4) {
        const difference = (Math.abs(current[index] - previous[index]) + Math.abs(current[index + 1] - previous[index + 1]) + Math.abs(current[index + 2] - previous[index + 2])) / 3;
        if (difference <= config.opticalPixelDifference) continue;
        const pixelIndex = index / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        changedPixels += 1;
        sumX += x;
        sumY += y;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      previous.set(current);
      if (changedPixels < config.opticalMinimumPixels || changedPixels / (width * height) < config.opticalMotionFraction) return null;
      const normalizedMinX = Math.max(0, minX / width);
      const normalizedMaxX = Math.min(1, (maxX + 1) / width);
      const normalizedMinY = Math.max(0, minY / height);
      const normalizedMaxY = Math.min(1, (maxY + 1) / height);
      return {
        minX: normalizedMinX,
        maxX: normalizedMaxX,
        minY: normalizedMinY,
        maxY: normalizedMaxY,
        centerX: sumX / changedPixels / width,
        centerY: sumY / changedPixels / height,
        width: normalizedMaxX - normalizedMinX,
        height: normalizedMaxY - normalizedMinY,
      };
    } catch {
      return null;
    }
  }, [config.opticalMinimumPixels, config.opticalMotionFraction, config.opticalPixelDifference]);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    let cancelled = false;

    async function initialize() {
      setMediaPipeReady(false);
      setStatus("INITIALIZING HAND RECOGNITION SENSOR...");
      try {
        const detectorOptions = {
          runningMode: "VIDEO" as const,
          numHands: Math.round(config.maxHands),
          minHandDetectionConfidence: config.minHandDetectionConfidence,
          minHandPresenceConfidence: config.minHandPresenceConfidence,
          minTrackingConfidence: config.minTrackingConfidence,
        };
        let detector: HandLandmarker | null = null;
        for (const wasmUrl of WASM_URLS) {
          try {
            const vision = await FilesetResolver.forVisionTasks(wasmUrl);
            if (cancelled) return;
            try {
              detector = await HandLandmarker.createFromOptions(vision, {
                ...detectorOptions,
                baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
              });
            } catch {
              detector = await HandLandmarker.createFromOptions(vision, {
                ...detectorOptions,
                baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
              });
            }
            break;
          } catch {
            detector = null;
          }
        }
        if (!detector) throw new Error("MediaPipe Hand Landmarker could not be initialized.");
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setMediaPipeReady(true);
        setStatus("SEARCHING FOR HAND... RAISE HAND INTO FRAME");

        let previousTimestamp = 0;
        const processFrame = () => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || cancelled) return;
          if (video.readyState >= 2) {
            const now = performance.now();
            const timestamp = Math.max(now, previousTimestamp + 1);
            previousTimestamp = timestamp;
            const context = canvas.getContext("2d");
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 480;
            }
            context?.clearRect(0, 0, canvas.width, canvas.height);
            let mediaPipeHandled = false;
            let rejectedShape = false;

            try {
              const result = detector.detectForVideo(video, timestamp);
              const landmarks = result.landmarks?.[0];
              if (landmarks?.length && !complete) {
                const box = trackingBox(landmarks, config.handBoxPaddingRatio);
                if (!validOpenHand(landmarks, config)) {
                  rejectedShape = true;
                  setHandDetected(false);
                  setStatus("SHOW AN OPEN HAND TO THE CAMERA");
                } else if (box.width * box.height >= config.minHandSizeRatio) {
                  mediaPipeHandled = true;
                  lastDetectionAtRef.current = now;
                  setHandDetected(true);
                  setStatus((current) => current.startsWith("WAVE ") ? current : "HAND LOCKED // WAVE LEFT & RIGHT TO SYNC");
                  evaluateWave(box.centerX, now);
                  if (context) drawTrackerHud(context, canvas, box, landmarks, now);
                } else {
                  rejectedShape = true;
                  setHandDetected(false);
                  setStatus("MOVE CLOSER — HAND IS TOO SMALL TO VERIFY");
                }
              }
            } catch {
              setStatus("MEDIAPIPE RECOVERING — USING OPTICAL MOTION FALLBACK");
            }

            if (!complete && !mediaPipeHandled && !rejectedShape) {
              const opticalBox = processOpticalMotion(video);
              if (opticalBox) {
                lastDetectionAtRef.current = now;
                if (config.handOnlyCounting >= 0.5) {
                  setHandDetected(false);
                  setStatus("MOTION FOUND — RAISE AN OPEN HAND FOR MEDIAPIPE");
                } else {
                  setHandDetected(true);
                  setStatus("OPTICAL MOTION LOCKED // WAVE LEFT & RIGHT");
                  evaluateWave(opticalBox.centerX, now);
                  if (context) {
                    context.save();
                    context.strokeStyle = "#FEE715";
                    context.setLineDash([8, 6]);
                    context.lineWidth = 2;
                    context.strokeRect(opticalBox.minX * canvas.width, opticalBox.minY * canvas.height, opticalBox.width * canvas.width, opticalBox.height * canvas.height);
                    context.restore();
                  }
                }
              } else if (now - lastDetectionAtRef.current > config.handLostTimeoutMs) {
                setHandDetected(false);
                setStatus("NO HAND DETECTED — RAISE AN OPEN HAND");
                trackerRef.current.direction = "idle";
                trackerRef.current.smoothedX = null;
                trackerRef.current.startX = null;
                trackerRef.current.peakX = null;
              }
            }
          }
          animationRef.current = requestAnimationFrame(processFrame);
        };
        animationRef.current = requestAnimationFrame(processFrame);
      } catch {
        setMediaPipeReady(false);
        setStatus("HAND SENSOR FAILED TO LOAD — CHECK CAMERA AND NETWORK ACCESS");
      }
    }

    void initialize();
    return () => {
      cancelled = true;
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, [active, complete, config, evaluateWave, processOpticalMotion]);

  function releaseCameraStream() {
    streamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function startCamera(requestedFacing: CameraFacing = facingMode) {
    if (!window.isSecureContext) {
      setStatus("CAMERA REQUIRES HTTPS OR LOCALHOST");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("THIS BROWSER DOES NOT SUPPORT CAMERA CAPTURE");
      return;
    }

    setStartingCamera(true);
    setMediaPipeReady(false);
    setStatus(requestedFacing === facingMode && !active ? "REQUESTING CAMERA ACCESS..." : "SWITCHING CAMERA...");
    setActive(false);
    releaseCameraStream();

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: requestedFacing },
            height: { ideal: 720 },
            width: { ideal: 1280 },
          },
        });
      } catch (preferredCameraError) {
        const errorName = preferredCameraError instanceof DOMException ? preferredCameraError.name : "";
        if (errorName !== "OverconstrainedError" && errorName !== "NotFoundError") throw preferredCameraError;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is unavailable.");
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error("No video track was returned.");
      videoTrack.onended = () => {
        setActive(false);
        setHandDetected(false);
        setStatus("CAMERA STREAM ENDED — TAP START TO RECONNECT");
      };

      resetTracking();
      setFacingMode(requestedFacing);
      setActive(true);
    } catch (error) {
      releaseCameraStream();
      const errorName = error instanceof DOMException ? error.name : "";
      if (errorName === "NotAllowedError" || errorName === "SecurityError") {
        setStatus("CAMERA ACCESS DENIED — ENABLE CAMERA PERMISSION AND TRY AGAIN");
      } else if (errorName === "NotReadableError") {
        setStatus("CAMERA IS BUSY IN ANOTHER APP OR BROWSER TAB");
      } else if (errorName === "NotFoundError") {
        setStatus("NO CAMERA WAS FOUND ON THIS DEVICE");
      } else {
        setStatus("CAMERA COULD NOT START — CLOSE OTHER CAMERA APPS AND TRY AGAIN");
      }
    } finally {
      setStartingCamera(false);
    }
  }

  function stopCamera() {
    setActive(false);
    setHandDetected(false);
    setMediaPipeReady(false);
    releaseCameraStream();
    setStatus("CAMERA SENSOR STANDBY");
  }

  function simulateWave() {
    if (complete) return;
    const next = Math.min(config.targetWaves, waveCountRef.current + 1);
    waveCountRef.current = next;
    setWaveCount(next);
    navigator.vibrate?.(60);
    if (next >= config.targetWaves) {
      setComplete(true);
      setStatus("✓ CONNECTION SUCCESSFUL! ALLIANCE SYNCHRONIZED!");
    } else {
      setStatus(`SIMULATED: WAVE ${next} OF ${config.targetWaves} CONFIRMED!`);
    }
  }

  function simulateComplete() {
    waveCountRef.current = config.targetWaves;
    setWaveCount(config.targetWaves);
    setComplete(true);
    setStatus("✓ CONNECTION SUCCESSFUL! ALLIANCE SYNCHRONIZED!");
    navigator.vibrate?.([80, 60, 120]);
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
  }, []);

  return (
    <DmapFrame accent="#00F0FF" icon="👋" title="Optical Wave Detection" subtitle="MediaPipe hand tracking verification">
      {complete && <DmapSuccess message={`${config.targetWaves} verified hand waves completed the optical synchronization protocol.`} onRunAgain={() => { resetTracking(); setStatus("SEARCHING FOR HAND... RAISE HAND INTO FRAME"); }} />}
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl border-2 border-[#00F0FF]/60 bg-black">
        <video ref={videoRef} autoPlay muted playsInline className={`h-full min-h-[320px] w-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`} />
        <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full ${facingMode === "user" ? "scale-x-[-1]" : ""}`} />
        {!active && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050718] text-center"><span className="text-6xl">👋</span><p className="mt-4 font-mono text-xs text-white/60">POINT CAMERA AT PARTNER</p></div>}
        {active && <div className={`absolute left-3 top-3 rounded-full border px-3 py-1 font-mono text-[10px] ${handDetected ? "border-emerald-400 bg-emerald-400/20 text-emerald-300" : "border-[#FEE715]/60 bg-black/70 text-[#FEE715]"}`}>{handDetected ? "TRACKING..." : "SCANNING..."}</div>}
        {active && <div className={`absolute bottom-3 left-3 rounded-full border bg-black/75 px-3 py-1 font-mono text-[9px] font-bold ${mediaPipeReady ? "border-[#00F0FF]/60 text-[#00F0FF]" : "animate-pulse border-white/25 text-white/55"}`}>{mediaPipeReady ? "● MEDIAPIPE ONLINE" : "○ LOADING MEDIAPIPE"}</div>}
        {active && <button type="button" onClick={() => void startCamera(facingMode === "user" ? "environment" : "user")} disabled={startingCamera} className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/70 px-3 py-1.5 font-mono text-[10px] font-bold uppercase text-white transition hover:border-[#00F0FF] disabled:opacity-50">↻ Flip</button>}
      </div>

      <div className="mt-4 text-center">
        <p className={`font-mono text-xs font-bold ${complete ? "text-emerald-400" : "text-[#00F0FF]"}`}>{status}</p>
        <p className="mt-1 font-mono text-[10px] text-white/45">Raise an open hand and wave left and right.</p>
      </div>
      <div className="mx-auto mt-4 grid w-full max-w-sm gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(config.targetWaves, 10)}, minmax(0, 1fr))` }}>
        {Array.from({ length: Math.min(config.targetWaves, 10) }, (_, index) => index + 1).map((number) => (
          <div key={number} className={`rounded-xl border-2 py-2 text-center font-mono text-sm font-black ${waveCount >= number ? "border-emerald-400 bg-emerald-500 text-black" : waveCount === number - 1 ? "animate-pulse border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF]" : "border-white/15 text-white/25"}`}>{waveCount >= number ? "✓" : number}<span className="block text-[7px]">WAVE</span></div>
        ))}
      </div>
      {config.simulationEnabled >= 0.5 && (
        <section className="mx-auto mt-3 w-full max-w-sm rounded-xl border border-[#FEE715]/30 bg-[#FEE715]/10 p-2.5 text-center">
          <p className="font-mono text-[10px] font-black uppercase text-[#FEE715]">🧪 Simulation mode active</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={simulateWave} disabled={complete} className="flex-1 rounded-lg bg-[#FEE715] px-2 py-2 font-mono text-[10px] font-black uppercase text-black disabled:opacity-50">+1 Wave ({waveCount}/{config.targetWaves})</button>
            <button type="button" onClick={simulateComplete} disabled={complete} className="flex-1 rounded-lg bg-emerald-500 px-2 py-2 font-mono text-[10px] font-black uppercase text-black disabled:opacity-50">⚡ Auto-pass</button>
          </div>
        </section>
      )}
      <button type="button" disabled={startingCamera} onClick={active ? stopCamera : () => void startCamera()} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-[#00F0FF] to-[#34D399] px-5 py-4 font-mono text-sm font-black uppercase text-black shadow-[0_0_25px_rgba(0,240,255,.35)] disabled:cursor-wait disabled:opacity-60">{startingCamera ? "Starting camera..." : active ? "Stop camera" : "Start 5-wave detection →"}</button>
    </DmapFrame>
  );
}
