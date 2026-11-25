"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HandLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";
import { PersonCutout } from "./person-cutout";
import { JutsuAudio } from "./jutsu-audio";
import { deleteSavedBackground, drawSavedBackground, loadSavedBackground, saveCameraBackground } from "./saved-background";
import { VideoClock } from "./video-clock";
import { drawLog, drawSmoke, readRamSeal } from "./technique";
import styles from "./page.module.css";

type Phase = "off" | "loading" | "ready" | "charging" | "replaced";
const HAND_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const PERSON_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite";
const MIN_HOLD_MS = 650;

function Icon({ name }: { name: "back" | "camera" | "log" | "stop" | "background" | "delete" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "back" && <path d="m14 5-7 7 7 7M7 12h14" />}
    {name === "camera" && <><path d="M8 6 10 3h4l2 3h4v14H4V6Z" /><circle cx="12" cy="12" r="4" /></>}
    {name === "log" && <><path d="m6 5 14 6v9L6 14Z" /><ellipse cx="6" cy="9.5" rx="3" ry="4.5" /><path d="m9 8 9 4m-9 0 9 4" /></>}
    {name === "stop" && <rect x="6" y="6" width="12" height="12" rx="2" />}
    {name === "background" && <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M5 17l5-6 4 4 3-3 3 5" /><circle cx="15" cy="8" r="1.5" /></>}
    {name === "delete" && <><path d="M4 6h16M9 6V3h6v3M7 6l1 15h8l1-15M10 10v7m4-7v7" /></>}
  </svg>;
}

export default function CameraSubPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<HandLandmarker | null>(null);
  const segmenterRef = useRef<ImageSegmenter | null>(null);
  const cutoutRef = useRef<PersonCutout | null>(null);
  const audioRef = useRef<JutsuAudio | null>(null);
  const savedBackgroundRef = useRef<HTMLImageElement | null>(null);
  const substitutionBackgroundRef = useRef<HTMLImageElement | null>(null);
  const backgroundOperationRef = useRef(0);
  const captureRef = useRef({ deadline: 0, saving: false });
  const placementRef = useRef({ x: 0, floor: 0, size: 0, smokeY: 0, smokeSize: 0 });
  const frameRef = useRef(0);
  const generationRef = useRef(0);
  const clocksRef = useRef({ hands: new VideoClock(), background: new VideoClock() });
  const runtime = useRef({ phase: "off" as Phase, castAt: 0, chargeAt: 0, chargeMs: 1120, holdMs: 1120, holdAt: 0, lastMatch: 0, releaseAt: 0, released: true, x: 0.5, y: 0.58, backgroundIndex: 0 });
  const [phase, setPhase] = useState<Phase>("off");
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [hasBackground, setHasBackground] = useState(false);
  const [usesSavedBackground, setUsesSavedBackground] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const operation = ++backgroundOperationRef.current;
    let cancelled = false;
    void loadSavedBackground().then((background) => {
      if (cancelled || operation !== backgroundOperationRef.current || !background) return;
      savedBackgroundRef.current = background.image;
      setHasBackground(true);
    }).catch(() => { /* Unavailable or invalid storage falls back to segmentation. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    backgroundOperationRef.current++;
    generationRef.current++;
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    detectorRef.current?.close();
    segmenterRef.current?.close();
    audioRef.current?.dispose();
  }, []);

  function changePhase(next: Phase) {
    runtime.current.phase = next;
    setPhase(next);
  }

  function stop() {
    generationRef.current++;
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    detectorRef.current?.close();
    detectorRef.current = null;
    segmenterRef.current?.close();
    segmenterRef.current = null;
    cutoutRef.current = null;
    substitutionBackgroundRef.current = null;
    setUsesSavedBackground(false);
    audioRef.current?.stop();
    captureRef.current = { deadline: 0, saving: false };
    setCountdown(null);
    setSaving(false);
    if (videoRef.current) {
      PersonCutout.clear(videoRef.current);
      videoRef.current.srcObject = null;
    }
    setHasCamera(false);
    runtime.current.holdAt = 0;
    runtime.current.lastMatch = 0;
    runtime.current.released = true;
    changePhase("off");
    setProgress(0);
  }

  function updateSegmentation() {
    const video = videoRef.current;
    const cutout = cutoutRef.current;
    if (!video || !cutout || !segmenterRef.current) return;
    segmenterRef.current.segmentForVideo(video, clocksRef.current.background.next(), (result) => {
      const mask = result.confidenceMasks?.[runtime.current.backgroundIndex];
      if (!mask) throw new Error("Person mask unavailable. Restart the camera.");
      cutout.update(mask.getAsFloat32Array(), mask.width, mask.height, video);
      if (runtime.current.phase === "replaced" && !substitutionBackgroundRef.current) cutout.applyTo(video);
    });
  }

  function cast(now: number) {
    if ((runtime.current.phase !== "ready" && runtime.current.phase !== "charging") || !cutoutRef.current || captureRef.current.deadline || captureRef.current.saving) return;
    const video = videoRef.current!;
    const bounds = cutoutRef.current.bounds;
    const w = video.videoWidth, h = video.videoHeight;
    const size = Math.min(w * 0.48, Math.max(h * 0.28, (bounds?.height ?? 0.7) * h * 0.58));
    const centerX = bounds ? 1 - bounds.x : runtime.current.x;
    placementRef.current = {
      x: Math.max(size * 0.55, Math.min(w - size * 0.55, centerX * w)),
      floor: Math.min(h * 0.94, bounds ? (bounds.y + bounds.height / 2) * h : h * 0.83),
      size,
      smokeY: bounds ? bounds.y * h : h * 0.5,
      smokeSize: Math.max(h * 0.2, (bounds?.height ?? 0.7) * h * 0.65),
    };
    substitutionBackgroundRef.current = savedBackgroundRef.current;
    setUsesSavedBackground(Boolean(substitutionBackgroundRef.current));
    if (substitutionBackgroundRef.current) PersonCutout.clear(video);
    else cutoutRef.current.applyTo(video);
    runtime.current.castAt = now;
    audioRef.current?.play("substitute");
    runtime.current.holdAt = 0;
    runtime.current.releaseAt = 0;
    runtime.current.released = false;
    changePhase("replaced");
    setProgress(0);
  }

  async function start() {
    if (runtime.current.phase !== "off") return;
    audioRef.current ??= new JutsuAudio();
    audioRef.current.unlock();
    const generation = ++generationRef.current;
    setError("");
    changePhase("loading");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Camera access needs HTTPS or localhost.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (generation !== generationRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      if (generation !== generationRef.current) return;
      setHasCamera(true);
      const { FilesetResolver, HandLandmarker, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      if (generation !== generationRef.current) return;
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
      if (generation !== generationRef.current) return;
      let detector: HandLandmarker;
      try {
        detector = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" }, runningMode: "VIDEO", numHands: 2,
          minHandDetectionConfidence: 0.35, minHandPresenceConfidence: 0.35, minTrackingConfidence: 0.35,
        });
      } catch {
        if (generation !== generationRef.current) return;
        detector = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: HAND_MODEL, delegate: "CPU" }, runningMode: "VIDEO", numHands: 2,
          minHandDetectionConfidence: 0.35, minHandPresenceConfidence: 0.35, minTrackingConfidence: 0.35,
        });
      }
      if (generation !== generationRef.current) { detector.close(); return; }
      detectorRef.current = detector;
      let segmenter: ImageSegmenter;
      try {
        segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: PERSON_MODEL, delegate: "GPU" }, runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false,
        });
      } catch {
        if (generation !== generationRef.current) return;
        segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath: PERSON_MODEL, delegate: "CPU" }, runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false,
        });
      }
      if (generation !== generationRef.current) { segmenter.close(); return; }
      segmenterRef.current = segmenter;
      const backgroundIndex = segmenter.getLabels().findIndex((label) => label.toLowerCase().includes("background"));
      runtime.current.backgroundIndex = backgroundIndex >= 0 ? backgroundIndex : 0;
      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Camera effects unavailable in this browser.");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      cutoutRef.current = new PersonCutout();
      updateSegmentation();
      changePhase("ready");
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (generation === generationRef.current) { stop(); setError("Camera disconnected."); }
      }, { once: true });
      let lastVideoTime = -1;
      let lastDetection = 0;
      let lastSegmentation = 0;
      let lastSegmentedVideoTime = -1;
      function render(now: number) {
        if (generation !== generationRef.current) return;
        const state = runtime.current;
        const w = canvas.width, h = canvas.height;
        try {
          context!.clearRect(0, 0, w, h);
          if (!captureRef.current.deadline && !captureRef.current.saving && now - lastSegmentation > 100 && video.currentTime !== lastSegmentedVideoTime) {
            updateSegmentation(); lastSegmentation = now; lastSegmentedVideoTime = video.currentTime;
          }
          const capture = captureRef.current;
          if (capture.deadline) {
            setCountdown(Math.max(0, Math.ceil((capture.deadline - now) / 1000)));
            if (now >= capture.deadline) void finishBackgroundCapture();
          }
          if (state.phase === "charging" && now - state.chargeAt >= state.chargeMs) cast(now);
          if (state.phase === "ready" && !capture.deadline && !capture.saving && now - lastDetection >= 65 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            lastDetection = now;
            const landmarks = detector.detectForVideo(video, clocksRef.current.hands.next()).landmarks;
            const seal = readRamSeal(landmarks);
            if (seal.matched) {
              state.releaseAt = 0;
              if (state.released) {
                if (!state.holdAt) {
                  state.holdAt = now;
                  state.holdMs = Math.max(MIN_HOLD_MS, audioRef.current?.activationLeadMs() ?? 1120);
                  audioRef.current?.play("activate");
                }
                state.lastMatch = now;
                const visible = landmarks.filter((hand) => hand.length >= 21);
                const wristX = visible.reduce((sum, hand) => sum + hand[0].x, 0) / visible.length;
                const wristY = visible.reduce((sum, hand) => sum + hand[0].y, 0) / visible.length;
                state.x = Math.max(0.22, Math.min(0.78, 1 - wristX));
                state.y = Math.max(0.35, Math.min(0.75, wristY + 0.08));
                if (now - state.holdAt >= state.holdMs) cast(now);
              }
            } else {
              if (now - state.lastMatch > 280) state.holdAt = 0;
              if (!state.releaseAt) state.releaseAt = now;
              if (now - state.releaseAt > 350) state.released = true;
            }
            setProgress(state.holdAt ? Math.min(1, (now - state.holdAt) / state.holdMs) : 0);
          }
          if (state.phase === "replaced" && cutoutRef.current) {
            const elapsed = now - state.castAt;
            if (substitutionBackgroundRef.current) drawSavedBackground(context!, substitutionBackgroundRef.current);
            const { x, floor, size, smokeY, smokeSize } = placementRef.current;
            const settling = elapsed < 750 ? Math.exp(-elapsed / 170) * size * 0.22 : 0;
            context!.save();
            context!.translate(x, floor + 2);
            context!.scale(1, 0.15);
            const shadow = context!.createRadialGradient(0, 0, 0, 0, 0, size * 0.58);
            shadow.addColorStop(0, "rgba(12,9,7,0.48)");
            shadow.addColorStop(0.55, "rgba(12,9,7,0.22)");
            shadow.addColorStop(1, "rgba(12,9,7,0)");
            context!.fillStyle = shadow;
            context!.beginPath(); context!.arc(0, 0, size * 0.58, 0, Math.PI * 2); context!.fill();
            context!.restore();
            context!.save();
            context!.filter = `brightness(${cutoutRef.current.brightness}) saturate(0.8)`;
            drawLog(context!, x, floor - size * 0.21 - settling, size, now);
            context!.restore();
            drawSmoke(context!, x, smokeY, smokeSize, elapsed);
          }
          frameRef.current = requestAnimationFrame(render);
        } catch { stop(); setError("Tracking stopped. Restart the camera."); }
      }
      frameRef.current = requestAnimationFrame(render);
    } catch (cause) {
      if (generation !== generationRef.current) return;
      stop();
      const name = cause instanceof Error ? cause.name : "";
      setError(name === "NotAllowedError" ? "Allow camera access, then try again." : name === "NotFoundError" ? "No camera found." : cause instanceof Error ? cause.message : "Camera unavailable.");
    }
  }

  function captureBackground() {
    if (runtime.current.phase !== "ready" || captureRef.current.saving) return;
    backgroundOperationRef.current++;
    if (captureRef.current.deadline) {
      captureRef.current.deadline = 0;
      setCountdown(null);
      return;
    }
    captureRef.current = { deadline: performance.now() + 5000, saving: false };
    runtime.current.holdAt = 0;
    setProgress(0);
    setError("");
    setCountdown(5);
  }

  async function finishBackgroundCapture() {
    const video = videoRef.current;
    if (!video || captureRef.current.saving) return;
    const operation = backgroundOperationRef.current;
    const generation = generationRef.current;
    const isCurrent = () => operation === backgroundOperationRef.current && generation === generationRef.current;
    captureRef.current.deadline = 0;
    captureRef.current.saving = true;
    setCountdown(null);
    setSaving(true);
    try {
      const background = await saveCameraBackground(video, isCurrent);
      if (!isCurrent()) return;
      savedBackgroundRef.current = background.image;
      setHasBackground(true);
    } catch {
      if (isCurrent()) setError("Could not save the background. Allow browser storage and try again.");
    } finally {
      if (isCurrent()) {
        captureRef.current.saving = false;
        setSaving(false);
      }
    }
  }

  function clearBackground() {
    try {
      deleteSavedBackground();
      backgroundOperationRef.current++;
      savedBackgroundRef.current = null;
      setHasBackground(false);
      setError("");
    } catch { setError("Could not delete the saved background. Allow browser storage and try again."); }
  }

  function toggleLog() {
    if (runtime.current.phase === "replaced") {
      if (videoRef.current) PersonCutout.clear(videoRef.current);
      substitutionBackgroundRef.current = null;
      setUsesSavedBackground(false);
      runtime.current.holdAt = 0;
      runtime.current.lastMatch = 0;
      runtime.current.releaseAt = 0;
      runtime.current.released = false;
      changePhase("ready");
    } else if (runtime.current.phase === "ready") {
      audioRef.current?.play("activate");
      runtime.current.chargeAt = performance.now();
      runtime.current.chargeMs = audioRef.current?.activationLeadMs() ?? 1120;
      setProgress(0);
      changePhase("charging");
    }
  }

  const active = phase !== "off" && phase !== "loading";
  return (
    <main className={styles.page}>
      <video ref={videoRef} muted playsInline className={styles.source} style={{ visibility: hasCamera && !(phase === "replaced" && usesSavedBackground) ? "visible" : "hidden" }} aria-label="Live camera feed" />
      <canvas ref={canvasRef} className={styles.canvas} style={{ visibility: phase === "replaced" ? "visible" : "hidden" }} aria-label="Body substitution overlay" />
      <Link href="/proto" className={styles.back} aria-label="Back to prototypes" title="Back"><Icon name="back" /></Link>
      {!active && <button className={`${styles.start} ${phase === "loading" ? styles.loading : ""}`} onClick={start} disabled={phase === "loading"} aria-label={phase === "loading" ? "Loading camera" : "Start camera"} title="Start camera"><Icon name="camera" /></button>}
      {active && <div className={styles.controls}>
        <button className={hasBackground ? styles.backgroundReady : undefined} data-saved={hasBackground} onClick={captureBackground} disabled={phase !== "ready" || saving} aria-label={countdown !== null ? "Cancel background capture" : "Capture background"} title={countdown !== null ? "Cancel capture" : hasBackground ? "Retake saved background (5 seconds)" : "Capture and save empty background (5 seconds)"}><Icon name="background" /></button>
        {hasBackground && <button onClick={clearBackground} disabled={phase !== "ready" || countdown !== null || saving} aria-label="Delete saved background" title="Delete saved background; use segmentation"><Icon name="delete" /></button>}
        <button className={phase === "replaced" ? styles.selected : undefined} onClick={toggleLog} disabled={phase === "charging" || countdown !== null || saving} aria-label={phase === "replaced" ? "Return to camera" : "Show log"} aria-pressed={phase === "replaced"} title={phase === "replaced" ? "Return to camera" : "Show log"}><Icon name="log" /></button>
        <button onClick={stop} aria-label="Stop camera" title="Stop camera"><Icon name="stop" /></button>
      </div>}
      {countdown !== null && <div className={styles.countdown} role="status" aria-label="Step out of frame before background capture">{countdown > 0 ? countdown : <Icon name="background" />}</div>}
      {phase === "loading" && <button className={styles.cancel} onClick={stop} aria-label="Cancel camera startup" title="Cancel"><Icon name="stop" /></button>}
      <progress className={styles.progress} aria-label="Ram seal hold" max={1} value={progress} />
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </main>
  );
}
