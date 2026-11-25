"use client";

import { onValue, ref, runTransaction, update } from "firebase/database";
import { useEffect, useMemo, useState } from "react";

import { DataGuide, GuideSection } from "@/app/proto/components/DataGuide";
import { realtimeDatabase } from "@/lib/firebase";

interface HoldSession {
  active?: boolean;
  connectedAtClient?: number;
  createdAt?: number;
  currentHold?: Record<string, unknown>;
  device?: Record<string, unknown>;
  holdCount?: number;
  lastActive?: number;
  lastHold?: Record<string, unknown>;
  totalHoldDurationMs?: number;
}

const HOLD_GUIDE: GuideSection[] = [
  {
    title: "Session and hold values",
    items: [
      { label: "Device ID", description: "Identifies one browser persistently, which lets you recognize the same participant after reconnecting." },
      { label: "active", description: "Shows whether the Hold page is connected now, which helps you separate live devices from saved sessions." },
      { label: "createdAt", description: "Records the Firebase server time when the session first appeared, which helps you order first-time joins." },
      { label: "connectedAtClient", description: "Records the device-clock time of the latest connection, which helps track reconnects while allowing for inaccurate clocks." },
      { label: "lastActive", description: "Records the latest Firebase server time for a hold or connection update, which helps identify stale devices." },
      { label: "holdCount", description: "Counts completed presses on the Hold target, which can act as an interaction or round score." },
      { label: "totalHoldDurationMs", description: "Adds every completed hold duration in milliseconds, which measures total engagement time." },
      { label: "currentHold.durationMs", description: "Shows how many milliseconds the active press has lasted, which supports live charging or progress mechanics." },
      { label: "currentHold.startedAtClient", description: "Records the device-clock time when the current press began, which helps align local motion samples." },
      { label: "currentHold.sampleCount", description: "Counts pointer-move samples during the active press, which indicates how much movement detail was captured." },
      { label: "currentHold.movementDistance", description: "Adds pointer travel in CSS pixels during the active press, which can distinguish a steady hold from a drag." },
      { label: "currentHold.maxPressure", description: "Keeps the highest pressure seen during the active press, which can power a squeeze-strength mechanic." },
      { label: "lastHold.durationMs", description: "Stores the completed press length in milliseconds, which is the main result for hold challenges." },
      { label: "lastHold.startedAtClient", description: "Records the device-clock time when the completed hold began, which helps reconstruct its timing." },
      { label: "lastHold.endedAtClient", description: "Records the device-clock time when the completed hold ended, which helps verify its duration." },
      { label: "lastHold.recordedAt", description: "Records the Firebase server time when the result was saved, which provides a shared clock across devices." },
      { label: "lastHold.sampleCount", description: "Stores how many pointer samples the completed hold produced, which helps judge movement resolution." },
      { label: "lastHold.movementDistance", description: "Stores total pointer travel during the completed hold in CSS pixels, which can score steadiness." },
      { label: "lastHold.maxPressure", description: "Stores the highest normalized pressure during the completed hold, which can score force on supported hardware." },
      { label: "Disconnect-all timestamp", description: "Stores when all Hold devices were told to disconnect, which lets connected pages stop themselves once per command." },
      { label: "Delete-all timestamp", description: "Stores when all Hold sessions were deleted, which stops connected pages without recreating removed records." },
    ],
  },
  {
    title: "Pointer values used at current, start, and end positions",
    items: [
      { label: "pointerId", description: "Identifies one active finger, mouse, or pen during the press, which helps keep simultaneous contacts separate." },
      { label: "pointerType", description: "Reports mouse, touch, or pen input, which lets you compare interaction styles." },
      { label: "isPrimary", description: "Marks the main pointer when several contacts exist, which helps ignore secondary fingers." },
      { label: "button", description: "Reports which button changed where zero usually means primary contact, which is useful for mouse and pen input." },
      { label: "buttons", description: "Reports a bitmask of every button still held, which can reveal multi-button input." },
      { label: "clientX", description: "Reports horizontal position in the visible viewport, which can drive screen-relative movement." },
      { label: "clientY", description: "Reports vertical position in the visible viewport, which can drive screen-relative movement." },
      { label: "pageX", description: "Reports horizontal position in the full document including scroll, which helps on scrolling layouts." },
      { label: "pageY", description: "Reports vertical position in the full document including scroll, which helps on scrolling layouts." },
      { label: "screenX", description: "Reports horizontal position on the physical screen, which can reveal browser-window placement." },
      { label: "screenY", description: "Reports vertical position on the physical screen, which can reveal browser-window placement." },
      { label: "offsetX", description: "Reports horizontal position inside the Hold target, which is ideal for measuring target-local drift." },
      { label: "offsetY", description: "Reports vertical position inside the Hold target, which is ideal for measuring target-local drift." },
      { label: "pressure", description: "Reports normalized pressure from zero to one when supported, which can turn a hold into a force challenge." },
      { label: "tangentialPressure", description: "Reports supported stylus side pressure from minus one to one, which can control a secondary effect." },
      { label: "width", description: "Reports estimated contact width in CSS pixels, which can help distinguish fingertip and precision input." },
      { label: "height", description: "Reports estimated contact height in CSS pixels, which can help estimate contact shape." },
      { label: "tiltX", description: "Reports pen left-right tilt from minus ninety to ninety degrees, which can steer horizontal effects." },
      { label: "tiltY", description: "Reports pen top-bottom tilt from minus ninety to ninety degrees, which can steer vertical effects." },
      { label: "twist", description: "Reports pen rotation from zero to 359 degrees when supported, which can rotate a visual control." },
    ],
  },
  {
    title: "Motion and orientation values at current, start, and end times",
    items: [
      { label: "acceleration.x", description: "Measures gravity-free left-right force in m/s², which can reveal sideways movement during a hold." },
      { label: "acceleration.y", description: "Measures gravity-free bottom-top force in m/s², which can reveal vertical movement during a hold." },
      { label: "acceleration.z", description: "Measures gravity-free force perpendicular to the screen in m/s², which can reveal pushing motion." },
      { label: "acceleration.magnitude", description: "Combines all gravity-free axes into one movement-strength value, which can score how still the device stayed." },
      { label: "accelerationIncludingGravity.x", description: "Measures raw left-right force including gravity in m/s², which can help infer sideways tilt." },
      { label: "accelerationIncludingGravity.y", description: "Measures raw bottom-top force including gravity in m/s², which can help infer upright angle." },
      { label: "accelerationIncludingGravity.z", description: "Measures raw perpendicular force including gravity in m/s², which can help infer face-up orientation." },
      { label: "accelerationIncludingGravity.magnitude", description: "Combines raw acceleration into one value near 9.8 m/s² at rest, which helps detect extra movement." },
      { label: "rotation.alpha", description: "Measures Z-axis turning speed in degrees per second, which can detect flat twisting while holding." },
      { label: "rotation.beta", description: "Measures X-axis turning speed in degrees per second, which can detect forward or backward rotation." },
      { label: "rotation.gamma", description: "Measures Y-axis turning speed in degrees per second, which can detect left or right rolling." },
      { label: "rotation.magnitude", description: "Combines all gyroscope axes into one rotation-strength value, which can score rotational steadiness." },
      { label: "orientation.alpha", description: "Reports heading around the Z axis in degrees, which can track compass-like pose changes." },
      { label: "orientation.beta", description: "Reports front-back tilt in degrees, which can measure vertical pose stability." },
      { label: "orientation.gamma", description: "Reports left-right tilt in degrees, which can measure horizontal pose stability." },
      { label: "interval", description: "Reports milliseconds between motion events, which helps judge sensor timing quality." },
    ],
  },
  {
    title: "Browser and device values",
    items: [
      { label: "userAgent", description: "Reports the browser identification string, which can help group behavior by browser and operating system." },
      { label: "platform", description: "Reports a coarse platform label, which can help separate mobile and desktop devices." },
      { label: "language", description: "Reports the preferred browser language, which can guide localization." },
      { label: "timeZone", description: "Reports the browser time zone, which can help interpret local timestamps." },
      { label: "online", description: "Reports whether the browser believes it has network access, which can explain delayed Firebase updates." },
      { label: "effectiveConnectionType", description: "Reports a rough network class when available, which can help diagnose slow synchronization." },
      { label: "deviceMemory", description: "Reports approximate RAM in gigabytes when supported, which can guide visual-performance choices." },
      { label: "hardwareConcurrency", description: "Reports browser-visible logical processor count, which can guide animation complexity." },
      { label: "maxTouchPoints", description: "Reports maximum simultaneous touches, which confirms touch and multi-touch capability." },
      { label: "pixelRatio", description: "Reports physical pixels per CSS pixel, which helps render sharp graphics." },
      { label: "colorDepth", description: "Reports display color depth in bits per pixel, which can help diagnose color banding." },
      { label: "screenOrientation", description: "Reports portrait or landscape orientation, which can guide target layout." },
      { label: "screenWidth", description: "Reports full screen width in CSS pixels, which helps compare display sizes." },
      { label: "screenHeight", description: "Reports full screen height in CSS pixels, which helps compare display sizes." },
      { label: "viewportWidth", description: "Reports visible page width at connection time, which helps tune responsive controls." },
      { label: "viewportHeight", description: "Reports visible page height at connection time, which accounts for browser chrome." },
    ],
  },
];

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatTime(value: number | undefined) {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" }).format(value);
}

function flattenData(value: unknown, prefix = ""): Array<[string, unknown]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return prefix ? [[prefix, value]] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child) ? flattenData(child, path) : [[path, child]];
  });
}

export default function HoldControlPage() {
  const [sessions, setSessions] = useState<Record<string, HoldSession>>({});

  useEffect(() => {
    void runTransaction(ref(realtimeDatabase, "holds"), (current) => current ?? { sessions: {} });
    return onValue(ref(realtimeDatabase, "holds/sessions"), (snapshot) => {
      setSessions((snapshot.val() as Record<string, HoldSession> | null) ?? {});
    });
  }, []);

  const entries = useMemo(
    () => Object.entries(sessions).sort(([, a], [, b]) => numberValue(b.lastActive) - numberValue(a.lastActive)),
    [sessions],
  );
  const connectedCount = entries.filter(([, session]) => session.active).length;

  function disconnectAllDevices() {
    if (!window.confirm("Disconnect every Hold device while keeping all IDs and data?")) return;
    const updates: Record<string, boolean | number> = { "commands/disconnectAllAt": Date.now() };
    for (const [id] of entries) updates[`sessions/${id}/active`] = false;
    void update(ref(realtimeDatabase, "holds"), updates);
  }

  function deleteAllSessions() {
    if (!window.confirm("Permanently delete every Hold session and all captured data?")) return;
    void update(ref(realtimeDatabase, "holds"), { "commands/deleteAllAt": Date.now(), sessions: null });
  }

  function resetSession(id: string) {
    if (!window.confirm(`Reset counts and durations for ${id}?`)) return;
    void update(ref(realtimeDatabase, `holds/sessions/${id}`), { holdCount: 0, totalHoldDurationMs: 0 });
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400">Prototype control</p>
            <h1 className="mt-2 text-4xl font-black">Hold Device Control</h1>
            <p className="mt-3 text-zinc-400">Watch current holds, completed hold results, pointer motion, phone motion, and browser details.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={disconnectAllDevices} disabled={entries.length === 0} className="rounded-xl border border-amber-400/50 px-4 py-3 text-sm font-black text-amber-200 disabled:opacity-40">Disconnect all</button>
            <button type="button" onClick={deleteAllSessions} disabled={entries.length === 0} className="rounded-xl border border-red-400/50 px-4 py-3 text-sm font-black text-red-200 disabled:opacity-40">Delete all sessions</button>
          </div>
        </header>

        <DataGuide sections={HOLD_GUIDE} />

        <section className="grid gap-4 sm:grid-cols-4">
          <Stat label="Connected" value={connectedCount} />
          <Stat label="Known IDs" value={entries.length} />
          <Stat label="Completed holds" value={entries.reduce((sum, [, session]) => sum + numberValue(session.holdCount), 0)} />
          <Stat label="Total hold time" value={`${(entries.reduce((sum, [, session]) => sum + numberValue(session.totalHoldDurationMs), 0) / 1000).toFixed(2)} s`} />
        </section>

        {entries.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-zinc-500">No Hold device has connected yet.</p> : (
          <section className="grid gap-5 xl:grid-cols-2">
            {entries.map(([id, session]) => (
              <article key={id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="break-all font-mono text-xs text-cyan-300">{id}</p>
                    <p className="mt-2 text-xs text-zinc-500">Created: {formatTime(session.createdAt)}</p>
                    <p className="mt-1 text-xs text-zinc-500">Connected: {formatTime(session.connectedAtClient)}</p>
                    <p className="mt-1 text-xs text-zinc-500">Last active: {formatTime(session.lastActive)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${session.active ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>{session.active ? "Connected" : "Disconnected"}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat label="Hold count" value={numberValue(session.holdCount)} compact />
                  <Stat label="Total duration" value={`${(numberValue(session.totalHoldDurationMs) / 1000).toFixed(2)} s`} compact />
                  <Stat label="Current duration" value={`${(numberValue(session.currentHold?.durationMs) / 1000).toFixed(2)} s`} compact />
                </div>
                <button type="button" onClick={() => resetSession(id)} className="mt-4 rounded-lg border border-cyan-400/50 px-3 py-2 text-sm font-bold text-cyan-200">Reset counts</button>

                <div className="mt-6 space-y-5">
                  <DataGrid title="Device details" values={flattenData(session.device)} />
                  <DataGrid title="Current hold" values={flattenData(session.currentHold)} empty="No hold is active." />
                  <DataGrid title="Latest completed hold" values={flattenData(session.lastHold)} empty="No completed hold has been saved." />
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return <div className={`rounded-xl border border-zinc-800 bg-zinc-900 ${compact ? "p-3" : "p-5"}`}><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className={`${compact ? "text-lg" : "text-3xl"} mt-2 break-all font-black text-cyan-200`}>{value}</p></div>;
}

function DataGrid({ title, values, empty }: { title: string; values: Array<[string, unknown]>; empty?: string }) {
  return <section><h2 className="text-sm font-bold text-cyan-300">{title}</h2>{values.length === 0 ? <p className="mt-2 text-xs text-zinc-500">{empty ?? "No data."}</p> : <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{values.map(([label, value]) => <div key={label} className="rounded-lg bg-zinc-950 p-3"><p className="break-all text-[10px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 break-all font-mono text-xs text-zinc-200">{typeof value === "number" ? value.toFixed(2) : String(value ?? "—")}</p></div>)}</div>}</section>;
}
