"use client";

import Link from "next/link";
import { increment, onValue, ref, serverTimestamp, update } from "firebase/database";
import { useEffect, useState } from "react";

import { useDmapConfig } from "@/app/experience/dmap/useDmapConfig";
import type { DmapConfig } from "@/lib/dmap";
import { realtimeDatabase } from "@/lib/firebase";

type SectionKey = keyof DmapConfig;

interface ControlField {
  description: string;
  key: string;
  label: string;
  max: number;
  min: number;
  step: number;
  unit: string;
}

const SECTIONS: Array<{
  accent: string;
  fields: ControlField[];
  key: SectionKey;
  route: string;
  subtitle: string;
  title: string;
}> = [
  {
    key: "wave",
    title: "Optical 5-Wave / MediaPipe",
    subtitle: "Human-hand detection confidence and wave gesture timing.",
    accent: "#00F0FF",
    route: "/experience/5-wave",
    fields: [
      { key: "targetWaves", label: "Required waves", min: 1, max: 10, step: 1, unit: "waves", description: "Sets how many valid left-right hand strokes complete the activity." },
      { key: "maxHands", label: "Maximum hands", min: 1, max: 2, step: 1, unit: "hands", description: "Sets how many hands MediaPipe may detect, while the activity follows the first hand." },
      { key: "minHandDetectionConfidence", label: "Detection confidence", min: 0.1, max: 0.99, step: 0.01, unit: "0–1", description: "Sets the confidence MediaPipe needs to identify a hand in a new camera frame." },
      { key: "minHandPresenceConfidence", label: "Presence confidence", min: 0.1, max: 0.99, step: 0.01, unit: "0–1", description: "Sets the confidence needed to keep treating the tracked object as a real hand." },
      { key: "minTrackingConfidence", label: "Tracking confidence", min: 0.1, max: 0.99, step: 0.01, unit: "0–1", description: "Sets the confidence needed to follow the same hand between frames." },
      { key: "minHandSizeRatio", label: "Minimum hand area", min: 0.005, max: 0.3, step: 0.005, unit: "frame ratio", description: "Rejects a detected hand when its bounding-box area is too small in the camera frame." },
      { key: "minFingertipsAboveWrist", label: "Fingertips above wrist", min: 1, max: 5, step: 1, unit: "fingers", description: "Sets how many fingertip landmarks must sit above the wrist before the shape counts as an open hand." },
      { key: "minHandAspectRatio", label: "Minimum hand aspect", min: 0.1, max: 1, step: 0.05, unit: "width ÷ height", description: "Rejects landmark groups that are too narrow to resemble a hand." },
      { key: "maxHandAspectRatio", label: "Maximum hand aspect", min: 1, max: 5, step: 0.1, unit: "width ÷ height", description: "Rejects landmark groups that are too wide to resemble a hand." },
      { key: "minWristRelativeY", label: "Minimum wrist position", min: 0, max: 1, step: 0.05, unit: "box ratio", description: "Requires the wrist to sit far enough toward the bottom of the detected hand box." },
      { key: "minFingertipSpreadRatio", label: "Fingertip spread", min: 0, max: 1, step: 0.05, unit: "box ratio", description: "Requires the fingertips to spread across enough of the hand width to reject face-like shapes." },
      { key: "handBoxPaddingRatio", label: "Tracker box padding", min: 0, max: 0.5, step: 0.05, unit: "box ratio", description: "Adds proportional space around the hand bounds used for tracking and the HUD." },
      { key: "minStrokeDistance", label: "Stroke distance", min: 0.005, max: 0.2, step: 0.005, unit: "frame ratio", description: "Sets the minimum horizontal travel required before a wave stroke can count." },
      { key: "minReversalDistance", label: "Reversal distance", min: 0.005, max: 0.15, step: 0.005, unit: "frame ratio", description: "Sets how far the hand must move back after a peak to confirm a direction change." },
      { key: "minStrokeDurationMs", label: "Minimum stroke duration", min: 10, max: 1000, step: 10, unit: "ms", description: "Rejects movements faster than this value as camera jitter or accidental flicks." },
      { key: "maxStrokeDurationMs", label: "Maximum stroke duration", min: 200, max: 5000, step: 100, unit: "ms", description: "Rejects movements slower than this value as drifting instead of intentional waving." },
      { key: "minWaveGapMs", label: "Wave gap", min: 50, max: 1000, step: 10, unit: "ms", description: "Sets the minimum pause between counted strokes to prevent double counting." },
      { key: "minInitialDelta", label: "Initial movement", min: 0.002, max: 0.1, step: 0.002, unit: "frame ratio", description: "Sets how far the hand must first move before the detector commits to a direction." },
      { key: "smoothingFactor", label: "Tracking responsiveness", min: 0.05, max: 1, step: 0.05, unit: "0–1", description: "Weights the newest hand position, so higher values react faster while lower values smooth more jitter." },
      { key: "handLostTimeoutMs", label: "Hand-lost timeout", min: 50, max: 2000, step: 50, unit: "ms", description: "Sets how long MediaPipe can miss the hand before wave-direction tracking resets." },
      { key: "opticalPixelDifference", label: "Optical pixel difference", min: 1, max: 100, step: 1, unit: "RGB delta", description: "Sets how much a low-resolution pixel must change before the optical fallback treats it as motion." },
      { key: "opticalMotionFraction", label: "Optical motion area", min: 0.001, max: 0.5, step: 0.005, unit: "frame ratio", description: "Sets the minimum portion of the fallback frame that must change to report motion." },
      { key: "opticalMinimumPixels", label: "Optical changed pixels", min: 1, max: 500, step: 1, unit: "pixels", description: "Sets the absolute minimum changed pixels required by the optical fallback." },
      { key: "handOnlyCounting", label: "MediaPipe-only counting", min: 0, max: 1, step: 1, unit: "0 off / 1 on", description: "Keeps optical fallback informational when set to one, or allows fallback motion to count waves when set to zero." },
      { key: "simulationEnabled", label: "Simulation controls", min: 0, max: 1, step: 1, unit: "0 off / 1 on", description: "Shows manual wave and auto-complete controls for testing when set to one." },
    ],
  },
  {
    key: "handshake",
    title: "Kinetic Handshake",
    subtitle: "Accelerometer, gravity, jerk, and gyroscope thresholds.",
    accent: "#FEE715",
    route: "/experience/handshake",
    fields: [
      { key: "targetShakes", label: "Required shakes", min: 1, max: 10, step: 1, unit: "shakes", description: "Sets how many qualifying motion strokes complete the handshake." },
      { key: "shakeThreshold", label: "Motion threshold", min: 0.2, max: 20, step: 0.1, unit: "m/s² equivalent", description: "Sets the minimum strongest combined sensor intensity required to count a shake." },
      { key: "debounceMs", label: "Shake debounce", min: 50, max: 1500, step: 10, unit: "ms", description: "Sets the minimum time between counted shakes to prevent one movement counting repeatedly." },
      { key: "rotationDivisor", label: "Gyroscope divisor", min: 1, max: 100, step: 1, unit: "divisor", description: "Converts rotation speed into comparable intensity, so a lower value makes rotation more influential." },
      { key: "jerkMultiplier", label: "Jerk multiplier", min: 0, max: 5, step: 0.1, unit: "×", description: "Controls how strongly sudden acceleration changes contribute to handshake detection." },
    ],
  },
  {
    key: "holdTap",
    title: "Joint Hold Tap",
    subtitle: "Two-person contact duration and pointer pressure.",
    accent: "#C084FC",
    route: "/experience/hold-tap",
    fields: [
      { key: "holdDurationMs", label: "Required hold", min: 500, max: 15000, step: 100, unit: "ms", description: "Sets how long both contact pads must remain pressed at the same time." },
      { key: "tickIntervalMs", label: "Timer update interval", min: 16, max: 500, step: 1, unit: "ms", description: "Sets how often the progress display updates while both partners are holding." },
      { key: "minimumPressure", label: "Minimum pointer pressure", min: 0, max: 1, step: 0.05, unit: "0–1", description: "Requires this pointer pressure when the device reports it, while zero keeps normal touchscreens compatible." },
    ],
  },
];

export default function DmapControlPage() {
  const config = useDmapConfig();
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ lastUpdatedAt?: number; lastUpdatedField?: string; revision?: number }>({});

  useEffect(() => onValue(ref(realtimeDatabase, ".info/connected"), (snapshot) => setFirebaseConnected(snapshot.val() === true)), []);

  useEffect(() => onValue(ref(realtimeDatabase, "dmap/sync"), (snapshot) => {
    setSyncInfo((snapshot.val() as typeof syncInfo | null) ?? {});
  }), []);

  function changeValue(section: SectionKey, field: string, rawValue: string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    void update(ref(realtimeDatabase, "dmap"), {
      [`config/${section}/${field}`]: value,
      "sync/lastUpdatedAt": serverTimestamp(),
      "sync/lastUpdatedField": `${section}.${field}`,
      "sync/revision": increment(1),
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-[#F0EEE9] sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(#00F0FF 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="rounded-3xl border-2 border-[#00F0FF]/40 bg-gradient-to-br from-[#0c1033] via-[#050718] to-black p-6 shadow-[0_0_50px_rgba(0,240,255,.15)] sm:p-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#00F0FF]">DMAP Mission Control</p>
          <h1 className="mt-2 text-3xl font-black uppercase sm:text-4xl">Detection thresholds</h1>
          <p className="mt-2 max-w-3xl font-mono text-xs leading-relaxed text-white/55">Every change is saved to Firebase immediately and applied live by all open activity screens; lower sensitivity thresholds usually detect more movement but can increase false positives.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px]">
            <span className={`rounded-full border px-3 py-1 ${firebaseConnected ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-amber-400/50 bg-amber-400/10 text-amber-300"}`}>
              {firebaseConnected ? "● FIREBASE LIVE" : "○ CONNECTING TO FIREBASE"}
            </span>
            <span className="text-white/40">Revision {syncInfo.revision ?? 0}</span>
            {syncInfo.lastUpdatedField && <span className="text-white/40">Last change: {syncInfo.lastUpdatedField}</span>}
            {syncInfo.lastUpdatedAt && <span className="text-white/40">{new Date(syncInfo.lastUpdatedAt).toLocaleTimeString()}</span>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {SECTIONS.map((section) => <Link key={section.key} href={section.route} className="rounded-xl border px-4 py-2 font-mono text-xs font-bold uppercase" style={{ borderColor: `${section.accent}88`, color: section.accent }}>{section.title} →</Link>)}
          </div>
        </header>

        <div className="mt-6 space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.key} className="rounded-3xl border-2 bg-[#080a20]/95 p-5 sm:p-6" style={{ borderColor: `${section.accent}55`, boxShadow: `0 0 36px ${section.accent}14` }}>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
                <div><h2 className="text-xl font-black uppercase" style={{ color: section.accent }}>{section.title}</h2><p className="mt-1 font-mono text-xs text-white/45">{section.subtitle}</p></div>
                <Link href={section.route} className="font-mono text-[10px] text-white/50 underline hover:text-white">Open activity</Link>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {section.fields.map((field) => {
                  const sectionValues = config[section.key] as unknown as Record<string, number>;
                  const value = sectionValues[field.key as string];
                  return (
                    <label key={String(field.key)} className="rounded-2xl border border-white/10 bg-black/50 p-4">
                      <span className="flex items-center justify-between gap-3"><span className="text-sm font-bold">{field.label}</span><span className="font-mono text-[10px] text-white/40">{field.unit}</span></span>
                      <p className="mt-1 min-h-8 font-mono text-[10px] leading-relaxed text-white/45">{field.description}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <input type="range" min={field.min} max={field.max} step={field.step} value={value} onChange={(event) => changeValue(section.key, String(field.key), event.target.value)} className="min-w-0 flex-1" style={{ accentColor: section.accent }} />
                        <input type="number" min={field.min} max={field.max} step={field.step} value={value} onChange={(event) => changeValue(section.key, String(field.key), event.target.value)} className="w-24 rounded-lg border border-white/15 bg-black px-2 py-1.5 font-mono text-xs outline-none" style={{ color: section.accent }} />
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
