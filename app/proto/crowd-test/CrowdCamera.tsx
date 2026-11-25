"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  CrowdTracker,
  DEFAULT_ZONES,
  DIRECTION_ARROWS,
  summarizeCrowd,
  type CrowdZone,
  type PersonTrack,
} from "@/lib/crowd-test/analytics";

import {
  mapDetection,
  mergeDetections,
  scanRegions,
  type LowLightMode,
  type PersonDetection,
  type ScanMode,
} from "@/lib/crowd-test/detection";
import {
  enhanceFrame,
  loadVision,
  type PersonDetector,
} from "@/lib/crowd-test/vision";

import styles from "./crowd-test.module.css";
import CrowdInsights from "./CrowdInsights";
import { Co2Settings, ZoneSettings } from "./AnalyticsSettings";
import { useCo2 } from "./useCo2";
import { useDancingIndex } from "./useDancingIndex";
import DancingPanel from "./DancingPanel";

type Status = "idle" | "starting" | "live" | "error";
type TorchCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  exposureMode?: string[];
};
type ExtraTrackConstraints = MediaTrackConstraintSet & {
  torch?: boolean;
  exposureMode?: string;
};

function cameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError")
      return "Camera access was denied. Allow the camera in your browser’s site settings, then try again.";
    if (error.name === "NotFoundError")
      return "No camera was found. Connect a webcam and try again.";
    if (error.name === "NotReadableError")
      return "The camera is busy. Close other apps using it, then try again.";
    if (error.name === "OverconstrainedError")
      return "This camera is unavailable. Choose another camera and try again.";
  }
  return error instanceof Error
    ? error.message
    : "The camera could not start. Please try again.";
}

export default function CrowdCamera() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState(
    "Ready when you are. Start your camera to count the room.",
  );
  const [collapsed, setCollapsed] = useState(true);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [detections, setDetections] = useState<PersonDetection[]>([]);
  const [peak, setPeak] = useState(0);
  const [scanMs, setScanMs] = useState(0);
  const [scanMode, setScanMode] = useState<ScanMode>("crowd");
  const [lowLight, setLowLight] = useState<LowLightMode>("auto");
  const [gain, setGain] = useState(2);
  const [confidence, setConfidence] = useState(0.35);
  const [showBoxes, setShowBoxes] = useState(true);
  const [mirrored, setMirrored] = useState(false);
  const [enhancement, setEnhancement] = useState({
    brightness: 0,
    enhanced: false,
    previewGain: 1,
  });
  const [cameraSize, setCameraSize] = useState({ width: 16, height: 9 });
  const [viewportAspect, setViewportAspect] = useState(1.6);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchMessage, setTorchMessage] = useState("");
  const [hidden, setHidden] = useState(false);
  const [tracks, setTracks] = useState<PersonTrack[]>([]);
  const [zones, setZones] = useState<CrowdZone[]>(DEFAULT_ZONES);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [hiddenPeople, setHiddenPeople] = useState<Set<number>>(new Set());
  const [showDanceScores, setShowDanceScores] = useState(true);
  const [motionSensitivity, setMotionSensitivity] = useState(1);
  const [danceSession, setDanceSession] = useState(0);
  const [showCenters, setShowCenters] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showDirections, setShowDirections] = useState(true);
  const [drawingZone, setDrawingZone] = useState(false);
  const [draftZone, setDraftZone] = useState<CrowdZone | null>(null);
  const co2 = useCo2(detections.length);
  const summary = useMemo(() => summarizeCrowd(tracks, zones), [tracks, zones]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );
  const trackerRef = useRef(new CrowdTracker());
  const zonesRef = useRef(zones);
  const streamRef = useRef<MediaStream | null>(null);
  const runRef = useRef(0);
  const optionsRef = useRef({ scanMode, lowLight, gain, confidence });
  const dancing = useDancingIndex(
    videoRef,
    tracks,
    status === "live",
    motionSensitivity,
    danceSession,
  );
  const motionById = useMemo(
    () => new Map(dancing.people.map((person) => [person.id, person])),
    [dancing.people],
  );

  useEffect(() => {
    optionsRef.current = { scanMode, lowLight, gain, confidence };
  }, [scanMode, lowLight, gain, confidence]);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    const runToken = runRef;
    const activeStream = streamRef;
    function onVisibility() {
      setHidden(document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      runToken.current++;
      activeStream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height)
        setViewportAspect(entry.contentRect.width / entry.contentRect.height);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  function stopCamera() {
    runRef.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setDetections([]);
    setTracks([]);
    setPeopleOpen(false);
    trackerRef.current = new CrowdTracker();
    setScanMs(0);
    setEnhancement({ brightness: 0, enhanced: false, previewGain: 1 });
    setTorchOn(false);
    setTorchAvailable(false);
    setTorchMessage("");
    setStatus("idle");
    setMessage("Camera stopped. Start again whenever you’re ready.");
  }

  async function startCamera() {
    const run = ++runRef.current;
    const current = () => runRef.current === run;
    let stream: MediaStream | undefined;
    let detector: PersonDetector | undefined;
    setStatus("starting");
    setMessage("Waiting for camera permission…");
    setDetections([]);
    setTracks([]);
    setDanceSession((previous) => previous + 1);
    setHiddenPeople(new Set());
    setPeopleOpen(true);
    setInsightsOpen(false);
    setCollapsed(true);
    trackerRef.current = new CrowdTracker();
    setPeak(0);
    setTorchMessage("");
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access needs HTTPS or localhost. Open this page using a secure address.",
        );
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(cameraId
            ? { deviceId: { exact: cameraId } }
            : { facingMode: { ideal: "environment" } }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });
      if (!current()) return;
      const video = videoRef.current;
      if (!video) return;
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (!current()) return;
      const track = stream.getVideoTracks()[0];
      track.addEventListener(
        "ended",
        () => {
          if (!current()) return;
          stopCamera();
          setStatus("error");
          setMessage("The camera disconnected. Reconnect it and start again.");
        },
        { once: true },
      );
      const capabilities = track.getCapabilities?.() as
        TorchCapabilities | undefined;
      setTorchAvailable(Boolean(capabilities?.torch));
      if (capabilities?.exposureMode?.includes("continuous")) {
        void track
          .applyConstraints({
            advanced: [{ exposureMode: "continuous" } as ExtraTrackConstraints],
          })
          .catch(() => {});
      }
      // Camera labels become available only after permission is granted.
      void navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (current())
            setCameras(
              devices.filter((device) => device.kind === "videoinput"),
            );
        })
        .catch(() => {});
      const vision = await loadVision((progress) => {
        if (current()) setMessage(progress);
      });
      detector = vision.detector;
      if (!current()) return;
      setStatus("live");
      setMessage(
        "Counting visible people. All video processing stays on this device.",
      );
      const frame = document.createElement("canvas");
      const crop = document.createElement("canvas");
      const frameContext = frame.getContext("2d", { willReadFrequently: true });
      const cropContext = crop.getContext("2d");
      if (!frameContext || !cropContext)
        throw new Error(
          "Your browser could not create the camera processing canvas.",
        );

      while (current()) {
        if (document.hidden || video.readyState < 2 || !video.videoWidth) {
          await new Promise((resolve) => window.setTimeout(resolve, 200));
          continue;
        }
        const startedAt = performance.now();
        const options = optionsRef.current;
        const scale = Math.min(
          1,
          1920 / Math.max(video.videoWidth, video.videoHeight),
        );
        frame.width = Math.round(video.videoWidth * scale);
        frame.height = Math.round(video.videoHeight * scale);
        setCameraSize({ width: frame.width, height: frame.height });
        frameContext.drawImage(video, 0, 0, frame.width, frame.height);
        const light = enhanceFrame(
          vision.cv,
          frame,
          options.lowLight,
          options.gain,
        );
        const people: PersonDetection[] = [];
        for (const region of scanRegions(
          frame.width,
          frame.height,
          options.scanMode,
        )) {
          if (!current() || document.hidden) break;
          crop.width = region.width;
          crop.height = region.height;
          cropContext.drawImage(
            frame,
            region.x,
            region.y,
            region.width,
            region.height,
            0,
            0,
            crop.width,
            crop.height,
          );
          const predictions = await detector.detect(
            crop,
            200,
            options.confidence,
          );
          if (!current()) break;
          for (const prediction of predictions) {
            if (
              prediction.class !== "person" ||
              prediction.score < options.confidence
            )
              continue;
            const person = mapDetection(
              prediction,
              region,
              frame.width,
              frame.height,
            );
            if (person) people.push(person);
          }
        }
        if (!current()) break;
        if (!document.hidden) {
          const merged = mergeDetections(people);
          const tracked = trackerRef.current.update(
            merged,
            performance.now(),
            zonesRef.current,
            frame.width,
            frame.height,
          );
          setDetections(merged);
          setTracks(tracked);
          setPeak((previous) => Math.max(previous, merged.length));
          setEnhancement(light);
          setScanMs(performance.now() - startedAt);
        }
        // Do not queue inference faster than the device can finish it.
        await new Promise((resolve) =>
          window.setTimeout(
            resolve,
            Math.max(40, 250 - (performance.now() - startedAt)),
          ),
        );
      }
    } catch (error) {
      if (current()) {
        setStatus("error");
        setMessage(cameraError(error));
        setDetections([]);
        setTracks([]);
        setTorchAvailable(false);
        setTorchOn(false);
      }
    } finally {
      // Inference owns the model until its last awaited scan has finished.
      detector?.dispose();
      stream?.getTracks().forEach((track) => track.stop());
      if (current()) {
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const run = runRef.current;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as ExtraTrackConstraints],
      });
      if (runRef.current === run) {
        setTorchOn(!torchOn);
        setTorchMessage("");
      }
    } catch {
      if (runRef.current === run)
        setTorchMessage(
          "This camera could not turn on its light. Try external lighting or a night-vision camera.",
        );
    }
  }

  const active = status === "starting" || status === "live";
  const count = detections.length;
  const cameraAspect = cameraSize.width / cameraSize.height;
  const countLabel =
    status === "live" && !hidden
      ? "visible people"
      : hidden && active
        ? "scan paused"
        : "people detected";

  function zonePoint(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = imageRef.current!.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width),
    );
    return {
      x: mirrored ? 1 - x : x,
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function startZone(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !imageRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = zonePoint(event);
    drawingRef.current = { ...point, pointerId: event.pointerId };
    setDraftZone({
      id: "draft",
      name: "New zone",
      ...point,
      width: 0,
      height: 0,
    });
  }

  function moveZone(event: ReactPointerEvent<HTMLDivElement>, finish = false) {
    const start = drawingRef.current;
    if (!start || start.pointerId !== event.pointerId || !imageRef.current)
      return;
    const point = zonePoint(event);
    const rectangle = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    };
    if (!finish) {
      setDraftZone({ id: "draft", name: "New zone", ...rectangle });
      return;
    }
    drawingRef.current = null;
    setDraftZone(null);
    if (rectangle.width < 0.03 || rectangle.height < 0.03) return;
    setZones((previous) =>
      previous.length >= 8
        ? previous
        : [
            ...previous,
            {
              id: `zone-${Date.now()}`,
              name: `Zone ${previous.length + 1}`,
              ...rectangle,
            },
          ],
    );
    setDrawingZone(false);
    setCollapsed(false);
  }

  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/proto" className={styles.back}>
          ↗ PROTOTYPE LAB
        </Link>
        <span className={styles.headerNote}>
          <span /> ON-DEVICE VISION
        </span>
      </header>

      <section className={styles.workspace} aria-label="Live crowd camera">
        <div className={styles.stage}>
          <div className={styles.stageTop}>
            <div className={styles.titleGroup}>
              <span className={styles.kicker}>EXPERIMENT / 08</span>
              <h1>
                Crowd test<span>_</span>
              </h1>
            </div>
            <div className={styles.stageActions}>
              <button
                className={styles.previewToggle}
                onClick={() => {
                  setPreviewCollapsed(!previewCollapsed);
                  setDrawingZone(false);
                  setDraftZone(null);
                  drawingRef.current = null;
                }}
                aria-expanded={!previewCollapsed}
                aria-controls="crowd-preview"
                aria-label={
                  previewCollapsed
                    ? "Expand camera preview"
                    : "Collapse camera preview"
                }
              >
                {previewCollapsed ? "+ Show preview" : "− Hide preview"}
              </button>
              <span
                className={`${styles.status} ${status === "live" && !hidden ? styles.statusLive : ""}`}
              >
                <i />
                {status === "live"
                  ? hidden
                    ? "PAUSED"
                    : "LIVE"
                  : status === "starting"
                    ? "CONNECTING"
                    : "STANDBY"}
              </span>
            </div>
          </div>

          <div className={styles.danceMetrics} aria-label="Dancing metrics">
            <div>
              <span>DANCING INDEX</span>
              <strong>
                {dancing.summary.index === null ? "—" : dancing.summary.index}
                <small>/100</small>
              </strong>
            </div>
            <div>
              <span>STEADY PEOPLE</span>
              <strong>{dancing.summary.steady}</strong>
            </div>
            <div>
              <span>MOVING PEOPLE</span>
              <strong>{dancing.summary.moving}</strong>
            </div>
          </div>
          <p className={styles.motionNote}>
            {status !== "live"
              ? "Start the camera to measure movement. Scores need about 2 seconds of observation."
              : hidden
                ? "Movement sampling pauses while this tab is hidden."
                : dancing.error ||
                  (dancing.sceneChanged
                    ? "Camera or lighting changed. Resampling movement…"
                    : `${dancing.summary.measured} measured · ${dancing.summary.sampling} sampling / low detail. Keep the camera fixed. Scores describe visible movement.`)}
          </p>

          <div
            ref={viewportRef}
            id="crowd-preview"
            className={`${styles.viewport} ${previewCollapsed ? styles.viewportCollapsed : ""}`}
          >
            <div
              ref={imageRef}
              className={styles.cameraImage}
              style={{
                width: `${Math.min(1, cameraAspect / viewportAspect) * 100}%`,
                aspectRatio: `${cameraSize.width} / ${cameraSize.height}`,
                transform: mirrored ? "scaleX(-1)" : undefined,
              }}
            >
              <video
                ref={videoRef}
                className={styles.video}
                autoPlay
                muted
                playsInline
                aria-label="Live camera preview"
                style={{ filter: `brightness(${enhancement.previewGain})` }}
              />
              {showHeatmap && status === "live" && (
                <div
                  className={styles.heatmapOverlay}
                  aria-hidden="true"
                  style={{
                    gridTemplateColumns: `repeat(${summary.columns}, 1fr)`,
                    gridTemplateRows: `repeat(${summary.rows}, 1fr)`,
                  }}
                >
                  {summary.heatmap.map((value, index) => (
                    <span
                      key={index}
                      style={{
                        background: value
                          ? `rgba(213,252,81,${0.08 + (value / summary.heatmapMax) * 0.3})`
                          : "transparent",
                      }}
                    />
                  ))}
                </div>
              )}
              {((showZones && status === "live") || drawingZone) &&
                [...zones, ...(draftZone ? [draftZone] : [])].map((zone) => (
                  <div
                    key={zone.id}
                    className={styles.zoneOverlay}
                    style={{
                      left: `${zone.x * 100}%`,
                      top: `${zone.y * 100}%`,
                      width: `${zone.width * 100}%`,
                      height: `${zone.height * 100}%`,
                    }}
                  >
                    <span
                      style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
                    >
                      {zone.name} ·{" "}
                      {summary.zones.find((item) => item.id === zone.id)
                        ?.count ?? 0}
                    </span>
                  </div>
                ))}
              {status === "live" &&
                tracks
                  .filter((person) => !hiddenPeople.has(person.id))
                  .map((person) => (
                    <div
                      key={person.id}
                      data-person-id={person.id}
                      data-motion={
                        motionById.get(person.id)?.status ?? "sampling"
                      }
                      className={`${styles.personBox} ${!showBoxes ? styles.personBoxClear : ""}`}
                      style={{
                        left: `${person.bbox[0] * 100}%`,
                        top: `${person.bbox[1] * 100}%`,
                        width: `${person.bbox[2] * 100}%`,
                        height: `${person.bbox[3] * 100}%`,
                      }}
                    >
                      {(showBoxes || showDirections || showDanceScores) && (
                        <span
                          style={{
                            transform: mirrored ? "scaleX(-1)" : undefined,
                          }}
                        >
                          #{String(person.id).padStart(2, "0")}{" "}
                          {showDirections && DIRECTION_ARROWS[person.direction]}
                          {showBoxes && (
                            <small>
                              {Math.round(person.score * 100)}% ·{" "}
                              {Math.round(person.bbox[3] * cameraSize.height)}px
                            </small>
                          )}
                          {showDanceScores && (
                            <b className={styles.danceScore}>
                              {motionById.get(person.id)?.score === null ||
                              motionById.get(person.id)?.score === undefined
                                ? motionById.get(person.id)?.status ===
                                  "low-detail"
                                  ? "Low detail"
                                  : "Sampling…"
                                : `Dance ${motionById.get(person.id)!.score}/100`}
                            </b>
                          )}
                        </span>
                      )}
                      {showCenters && <i className={styles.personCenter} />}
                    </div>
                  ))}
              {showCenters && summary.centroid && status === "live" && (
                <span
                  className={styles.crowdCenter}
                  title="Crowd center"
                  style={{
                    left: `${summary.centroid[0] * 100}%`,
                    top: `${summary.centroid[1] * 100}%`,
                  }}
                >
                  +
                </span>
              )}
              {drawingZone && (
                <div
                  className={styles.zoneDrawLayer}
                  role="presentation"
                  onPointerDown={startZone}
                  onPointerMove={(event) => moveZone(event)}
                  onPointerUp={(event) => moveZone(event, true)}
                  onPointerCancel={() => {
                    drawingRef.current = null;
                    setDraftZone(null);
                  }}
                />
              )}
            </div>
            {!active && !previewCollapsed && !drawingZone && (
              <div className={styles.emptyState}>
                <div className={styles.viewfinder} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <svg viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="22" r="8" />
                    <path d="M17 49v-5c0-8 6-13 15-13s15 5 15 13v5M12 24a6 6 0 0 0-4 11M52 24a6 6 0 0 1 4 11" />
                  </svg>
                </div>
                <h2>Every person counts.</h2>
                <p>A live view of the people in your frame.</p>
                <button
                  className={styles.primaryButton}
                  onClick={() => void startCamera()}
                >
                  Start camera <span>↗</span>
                </button>
                <span className={styles.emptyNote}>
                  CAMERA PERMISSION REQUIRED · NO RECORDING
                </span>
              </div>
            )}
            {status === "starting" && !previewCollapsed && !drawingZone && (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                <p>{message}</p>
                <small>First load downloads the vision models.</small>
              </div>
            )}
            {previewCollapsed && (
              <p className={styles.previewCollapsedLabel}>
                PREVIEW COLLAPSED
                {status === "live" ? " · COUNTING CONTINUES" : ""}
              </p>
            )}
            <div className={styles.cornerTL} aria-hidden="true" />
            <div className={styles.cornerTR} aria-hidden="true" />
            <div className={styles.cornerBL} aria-hidden="true" />
            <div className={styles.cornerBR} aria-hidden="true" />
            <div className={styles.cameraTag}>
              CAM {active ? "01" : "—"}{" "}
              <span>
                {status === "live"
                  ? `${cameraSize.width} × ${cameraSize.height}`
                  : "AWAITING FEED"}
              </span>
            </div>
            {status === "live" && (
              <div className={styles.lightTag}>
                {enhancement.enhanced ? "◐ LOW-LIGHT BOOST" : "◉ NATURAL LIGHT"}
              </div>
            )}
            {!previewCollapsed && co2.reading && (
              <div className={styles.co2Badge}>
                {co2.reading.ppm.toLocaleString()} ppm CO₂{" "}
                <small>
                  {co2.reading.source}
                  {co2.stale ? " · stale" : ""} · {co2.reading.people} people at
                  sample
                </small>
              </div>
            )}
            {drawingZone && !previewCollapsed && (
              <div className={styles.drawHint}>
                <span>Drag a rectangle on the image to add a zone.</span>
                <button
                  onClick={() => {
                    setDrawingZone(false);
                    setDraftZone(null);
                    drawingRef.current = null;
                  }}
                >
                  Cancel drawing
                </button>
              </div>
            )}
            <div
              className={styles.overlayCount}
              aria-live="polite"
              aria-atomic="true"
            >
              <strong>
                {status === "live" ? String(count).padStart(2, "0") : "—"}
              </strong>
              <div>
                <span>{countLabel}</span>
                <small>PEAK {String(peak).padStart(2, "0")}</small>
              </div>
            </div>
            {!previewCollapsed && (
              <button
                className={styles.peopleToggle}
                aria-controls="crowd-people"
                aria-expanded={peopleOpen}
                onClick={() => {
                  setPeopleOpen(!peopleOpen);
                  setInsightsOpen(false);
                  setCollapsed(true);
                  setDrawingZone(false);
                }}
              >
                People
              </button>
            )}
            {!previewCollapsed && (
              <button
                className={styles.dataToggle}
                aria-controls="crowd-insights"
                aria-expanded={insightsOpen}
                onClick={() => {
                  setInsightsOpen(!insightsOpen);
                  setPeopleOpen(false);
                  setCollapsed(true);
                  setDrawingZone(false);
                }}
              >
                ↗ Data
              </button>
            )}
            {!previewCollapsed && (
              <button
                className={styles.settingsToggle}
                onClick={() => {
                  setCollapsed(!collapsed);
                  setPeopleOpen(false);
                  setInsightsOpen(false);
                  setDrawingZone(false);
                }}
                aria-expanded={!collapsed}
                aria-controls="crowd-settings"
                aria-label={collapsed ? "Expand controls" : "Collapse controls"}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
                </svg>
                Settings<span>{collapsed ? "+" : "−"}</span>
              </button>
            )}
            <div className={styles.cameraControls}>
              <button
                className={active ? styles.stopButton : styles.primaryButton}
                onClick={active ? stopCamera : () => void startCamera()}
              >
                {active
                  ? status === "starting"
                    ? "Cancel camera"
                    : "Stop camera"
                  : "Start camera"}
                <span>{active ? "■" : "↗"}</span>
              </button>
            </div>
            {peopleOpen && !previewCollapsed && (
              <DancingPanel
                people={dancing.people}
                summary={dancing.summary}
                hiddenIds={hiddenPeople}
                onClose={() => setPeopleOpen(false)}
                onToggle={(id) =>
                  setHiddenPeople((previous) => {
                    const next = new Set(previous);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onShowAll={() => setHiddenPeople(new Set())}
                onHideAll={() =>
                  setHiddenPeople(new Set(tracks.map((person) => person.id)))
                }
              />
            )}
            {insightsOpen && !previewCollapsed && (
              <CrowdInsights
                tracks={tracks}
                summary={summary}
                size={cameraSize}
                co2={co2.reading}
                co2Stale={co2.stale}
                onClose={() => setInsightsOpen(false)}
              />
            )}
            <aside
              id="crowd-settings"
              className={styles.panel}
              hidden={collapsed || previewCollapsed}
              aria-label="Crowd counter controls"
            >
              <div className={styles.panelHeader}>
                <span>CAMERA SETTINGS</span>
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  aria-expanded={!collapsed}
                  aria-controls="crowd-controls"
                  aria-label="Close settings"
                >
                  ×
                </button>
              </div>
              <div className={styles.stats}>
                <div>
                  <span>SESSION PEAK</span>
                  <strong>{String(peak).padStart(2, "0")}</strong>
                </div>
                <div>
                  <span>SCAN TIME</span>
                  <strong>
                    {scanMs ? `${(scanMs / 1000).toFixed(2)}s` : "—"}
                  </strong>
                </div>
              </div>

              <div
                id="crowd-controls"
                hidden={collapsed}
                className={styles.controls}
              >
                <div className={styles.controlSection}>
                  <label className={styles.fieldLabel} htmlFor="scan-mode">
                    01 <span>Detection</span>
                  </label>
                  <select
                    id="scan-mode"
                    value={scanMode}
                    onChange={(event) =>
                      setScanMode(event.target.value as ScanMode)
                    }
                  >
                    <option value="live">Live · fastest / 1 view</option>
                    <option value="crowd">Crowd · balanced / 5 views</option>
                    <option value="dense">
                      Dense crowd · detailed / 10 views
                    </option>
                  </select>
                  <p className={styles.hint}>
                    Overlapping views help find smaller, distant people. More
                    views take longer.
                  </p>
                  <label className={styles.rangeLabel} htmlFor="confidence">
                    Minimum confidence{" "}
                    <strong>{Math.round(confidence * 100)}%</strong>
                  </label>
                  <input
                    id="confidence"
                    type="range"
                    min="0.2"
                    max="0.8"
                    step="0.05"
                    value={confidence}
                    onChange={(event) =>
                      setConfidence(Number(event.target.value))
                    }
                  />
                  <div className={styles.rangeEnds}>
                    <span>Find more</span>
                    <span>Be more certain</span>
                  </div>
                </div>

                <div className={styles.controlSection}>
                  <label className={styles.fieldLabel} htmlFor="low-light">
                    02 <span>Low light</span>
                    <span className={styles.autoTag}>
                      {enhancement.enhanced && status === "live"
                        ? "BOOSTING"
                        : "OPENCV"}
                    </span>
                  </label>
                  <select
                    id="low-light"
                    value={lowLight}
                    onChange={(event) =>
                      setLowLight(event.target.value as LowLightMode)
                    }
                  >
                    <option value="auto">Auto enhancement</option>
                    <option value="on">Always enhance</option>
                    <option value="off">Enhancement off</option>
                  </select>
                  <label className={styles.rangeLabel} htmlFor="gain">
                    Shadow boost <strong>{gain.toFixed(1)}×</strong>
                  </label>
                  <input
                    id="gain"
                    type="range"
                    min="1"
                    max="3.5"
                    step="0.1"
                    value={gain}
                    disabled={lowLight === "off"}
                    onChange={(event) => setGain(Number(event.target.value))}
                  />
                  <p className={styles.hint}>
                    Boosts shadows and contrast before detection. Complete
                    darkness needs infrared / night-vision hardware.
                  </p>
                  {status === "live" && enhancement.brightness < 20 && (
                    <p className={styles.darkWarning}>
                      Very little light. Add lighting or use an IR camera for a
                      more reliable count.
                    </p>
                  )}
                  {torchAvailable && (
                    <button
                      className={styles.secondaryButton}
                      onClick={() => void toggleTorch()}
                      aria-pressed={torchOn}
                    >
                      {torchOn
                        ? "Turn camera light off"
                        : "Turn camera light on"}
                    </button>
                  )}
                  {torchMessage && (
                    <p role="status" className={styles.darkWarning}>
                      {torchMessage}
                    </p>
                  )}
                </div>

                <div className={styles.controlSection}>
                  <span className={styles.fieldLabel}>
                    03 <span>Camera & display</span>
                  </span>
                  <label className={styles.srOnly} htmlFor="camera">
                    Camera
                  </label>
                  <select
                    id="camera"
                    value={cameraId}
                    disabled={active}
                    onChange={(event) => setCameraId(event.target.value)}
                  >
                    <option value="">Default camera</option>
                    {cameras.map((camera, index) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                  {active && cameras.length > 1 && (
                    <p className={styles.hint}>
                      Stop the camera to change the input.
                    </p>
                  )}
                  <label className={styles.checkLabel}>
                    <span>Numbered detection boxes</span>
                    <input
                      type="checkbox"
                      checked={showBoxes}
                      onChange={(event) => setShowBoxes(event.target.checked)}
                    />
                  </label>
                  <label className={styles.checkLabel}>
                    <span>Mirror preview</span>
                    <input
                      type="checkbox"
                      checked={mirrored}
                      onChange={(event) => setMirrored(event.target.checked)}
                    />
                  </label>
                  <label className={styles.checkLabel}>
                    <span>Center points & crowd center</span>
                    <input
                      type="checkbox"
                      checked={showCenters}
                      onChange={(event) => setShowCenters(event.target.checked)}
                    />
                  </label>
                  <label className={styles.checkLabel}>
                    <span>Zone boundaries & counts</span>
                    <input
                      type="checkbox"
                      checked={showZones}
                      onChange={(event) => setShowZones(event.target.checked)}
                    />
                  </label>
                  <label className={styles.checkLabel}>
                    <span>Relative density heatmap</span>
                    <input
                      type="checkbox"
                      checked={showHeatmap}
                      onChange={(event) => setShowHeatmap(event.target.checked)}
                    />
                  </label>
                  <label className={styles.checkLabel}>
                    <span>Movement direction arrows</span>
                    <input
                      type="checkbox"
                      checked={showDirections}
                      onChange={(event) =>
                        setShowDirections(event.target.checked)
                      }
                    />
                  </label>
                  <label className={styles.checkLabel}>
                    <span>Dancing scores on boxes</span>
                    <input
                      type="checkbox"
                      checked={showDanceScores}
                      onChange={(event) =>
                        setShowDanceScores(event.target.checked)
                      }
                    />
                  </label>
                  <label
                    className={styles.rangeLabel}
                    htmlFor="motion-sensitivity"
                  >
                    Motion sensitivity{" "}
                    <strong>{motionSensitivity.toFixed(1)}×</strong>
                  </label>
                  <input
                    id="motion-sensitivity"
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={motionSensitivity}
                    onChange={(event) =>
                      setMotionSensitivity(Number(event.target.value))
                    }
                  />
                  <p className={styles.hint}>
                    Movement scores use small image samples and box motion.
                    Higher sensitivity detects subtler changes. Walking, camera
                    motion, or changing light can also affect scores. Tiny or
                    dark detections stay unscored.
                  </p>
                </div>
                <ZoneSettings
                  zones={zones}
                  onChange={setZones}
                  onDraw={() => {
                    setPreviewCollapsed(false);
                    setDrawingZone(true);
                    setDraftZone(null);
                    setCollapsed(true);
                    setInsightsOpen(false);
                    setPeopleOpen(false);
                  }}
                />
                <Co2Settings co2={co2} />
              </div>

              <div className={styles.panelFooter}>
                {!collapsed && (
                  <p>
                    Video stays on your device. Models download on first use.
                    Counts are estimates of visible people, not unique visitors.
                  </p>
                )}
              </div>
            </aside>
          </div>

          <div className={styles.stageBottom}>
            <p
              role={status === "error" ? "alert" : "status"}
              className={status === "error" ? styles.error : ""}
            >
              <span className={styles.messageDot} />
              {message}
            </p>
            <span>OPENCV + COCO-SSD</span>
          </div>
        </div>
      </section>
      <footer className={styles.footer}>
        <span>POINT. DETECT. COUNT.</span>
        <span>
          LIVE CROWD EXPERIMENT <span className={styles.footerCross}>+</span>
        </span>
      </footer>
    </main>
  );
}
