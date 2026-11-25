"use client";

import { onValue, ref, remove, runTransaction, update } from "firebase/database";
import { useEffect, useMemo, useState } from "react";

import { DataGuide, GuideSection } from "@/app/proto/components/DataGuide";
import { realtimeDatabase } from "@/lib/firebase";

interface StaffConfig {
  idleResetMs: number;
  rotationThreshold: number;
  spinDegrees: number;
  uploadIntervalMs: number;
}

interface StaffSession {
  acceleration?: Record<string, unknown>;
  accelerationIncludingGravity?: Record<string, unknown>;
  active?: boolean;
  angularSpeed?: number;
  connectedAtClient?: number;
  createdAt?: number;
  device?: Record<string, unknown>;
  dominantAxis?: string;
  interval?: number;
  lastActive?: number;
  orientation?: Record<string, unknown>;
  rotation?: Record<string, unknown>;
  spinCount?: number;
  spinProgressDegrees?: number;
}

const DEFAULT_CONFIG: StaffConfig = { idleResetMs: 500, rotationThreshold: 180, spinDegrees: 360, uploadIntervalMs: 100 };
const CONTROL_FIELDS: Array<{ key: keyof StaffConfig; label: string; min: number; step: number; unit: string }> = [
  { key: "rotationThreshold", label: "Rotation threshold", min: 1, step: 10, unit: "°/s" },
  { key: "spinDegrees", label: "Degrees per spin", min: 90, step: 10, unit: "°" },
  { key: "idleResetMs", label: "Idle reset delay", min: 50, step: 50, unit: "ms" },
  { key: "uploadIntervalMs", label: "Upload interval", min: 50, step: 10, unit: "ms" },
];

const STAFF_GUIDE: GuideSection[] = [
  {
    title: "Spin controls and derived values",
    items: [
      { label: "rotationThreshold", description: "Sets the minimum dominant-axis speed in degrees per second that contributes to a spin, which filters out slow handling." },
      { label: "spinDegrees", description: "Sets the accumulated rotation required for one count, which lets you define a full spin or a smaller trick." },
      { label: "idleResetMs", description: "Sets how long slow movement may continue before partial progress resets, which prevents unrelated motions from completing an old spin." },
      { label: "uploadIntervalMs", description: "Sets the minimum milliseconds between Firebase updates, which balances dashboard smoothness against database writes." },
      { label: "spinCount", description: "Counts completed spin-angle targets for one Staff device, which can act as a score." },
      { label: "spinProgressDegrees", description: "Shows accumulated qualifying rotation toward the next spin, which can drive a live progress ring." },
      { label: "dominantAxis", description: "Names alpha, beta, or gamma as the fastest current rotation axis, which helps reveal the player's spin style." },
      { label: "angularSpeed", description: "Shows the absolute speed of the dominant axis in degrees per second, which is the value compared with the threshold." },
      { label: "Spin rule", description: "Adds dominant-axis speed over time while above the threshold and counts each configured angle, which approximates complete staff rotations." },
    ],
  },
  {
    title: "Session data",
    items: [
      { label: "Device ID", description: "Identifies one browser persistently, which lets you recognize the same Staff device after reconnecting." },
      { label: "active", description: "Shows whether the Staff page is currently reading motion events, which separates live devices from saved sessions." },
      { label: "createdAt", description: "Records the Firebase server time when the session first appeared, which helps order first-time joins." },
      { label: "connectedAtClient", description: "Records the device-clock time of its latest sensor activation, which helps track reconnect order." },
      { label: "lastActive", description: "Records the latest Firebase server time for telemetry or connection changes, which helps identify stale devices." },
      { label: "Disconnect-all timestamp", description: "Stores when all Staff devices were told to disconnect, which lets each live page stop itself once per command." },
      { label: "Delete-all timestamp", description: "Stores when all Staff sessions were deleted, which stops live pages without recreating removed records." },
    ],
  },
  {
    title: "Accelerometer, gyroscope, and orientation data",
    items: [
      { label: "acceleration.x", description: "Measures gravity-free left-right force in m/s², which can reveal sideways movement during a spin." },
      { label: "acceleration.y", description: "Measures gravity-free bottom-top force in m/s², which can reveal vertical movement during a spin." },
      { label: "acceleration.z", description: "Measures gravity-free force perpendicular to the screen in m/s², which can reveal thrusting motion." },
      { label: "acceleration.magnitude", description: "Combines all gravity-free axes into one movement-strength value, which can distinguish smooth spins from forceful swings." },
      { label: "accelerationIncludingGravity.x", description: "Measures raw left-right force including gravity in m/s², which can help infer sideways tilt." },
      { label: "accelerationIncludingGravity.y", description: "Measures raw bottom-top force including gravity in m/s², which can help infer upright angle." },
      { label: "accelerationIncludingGravity.z", description: "Measures raw perpendicular force including gravity in m/s², which can help infer face-up orientation." },
      { label: "accelerationIncludingGravity.magnitude", description: "Combines raw acceleration into one value near 9.8 m/s² at rest, which helps reveal extra movement." },
      { label: "rotation.alpha", description: "Measures Z-axis turning speed in degrees per second, which captures flat steering-like spins." },
      { label: "rotation.beta", description: "Measures X-axis turning speed in degrees per second, which captures forward and backward spins." },
      { label: "rotation.gamma", description: "Measures Y-axis turning speed in degrees per second, which captures left and right rolling spins." },
      { label: "rotation.magnitude", description: "Combines all gyroscope axes into one rotation-strength value, which helps compare overall spin intensity." },
      { label: "orientation.alpha", description: "Reports heading around the Z axis in degrees, which can drive compass-like staff direction." },
      { label: "orientation.beta", description: "Reports front-back tilt in degrees, which can drive vertical staff pose effects." },
      { label: "orientation.gamma", description: "Reports left-right tilt in degrees, which can drive horizontal staff pose effects." },
      { label: "interval", description: "Reports milliseconds between motion samples, which helps judge sensor timing quality." },
    ],
  },
  {
    title: "Browser and device data",
    items: [
      { label: "userAgent", description: "Reports the browser identification string, which can help group results by browser and operating system." },
      { label: "platform", description: "Reports a coarse platform label, which can help separate mobile and desktop devices." },
      { label: "language", description: "Reports the preferred browser language, which can guide localization." },
      { label: "timeZone", description: "Reports the browser time zone, which can help interpret local timestamps." },
      { label: "online", description: "Reports whether the browser believes it has network access, which can explain delayed Firebase telemetry." },
      { label: "effectiveConnectionType", description: "Reports a rough network class when available, which can help diagnose slow synchronization." },
      { label: "deviceMemory", description: "Reports approximate RAM in gigabytes when supported, which can guide visual-performance choices." },
      { label: "hardwareConcurrency", description: "Reports browser-visible logical processor count, which can guide animation complexity." },
      { label: "maxTouchPoints", description: "Reports maximum simultaneous touches, which confirms touch capability." },
      { label: "pixelRatio", description: "Reports physical pixels per CSS pixel, which helps render sharp graphics." },
      { label: "colorDepth", description: "Reports display color depth in bits per pixel, which can help diagnose color banding." },
      { label: "screenOrientation", description: "Reports portrait or landscape orientation, which can guide the Staff layout." },
      { label: "screenWidth", description: "Reports full screen width in CSS pixels, which helps compare display sizes." },
      { label: "screenHeight", description: "Reports full screen height in CSS pixels, which helps compare display sizes." },
      { label: "viewportWidth", description: "Reports visible page width at connection time, which helps tune responsive visuals." },
      { label: "viewportHeight", description: "Reports visible page height at connection time, which accounts for browser chrome." },
    ],
  },
];

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatTime(value: number | undefined) {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" }).format(value);
}

function values(value: Record<string, unknown> | undefined) {
  return Object.entries(value ?? {});
}

export default function StaffControlPage() {
  const [config, setConfig] = useState<StaffConfig>(DEFAULT_CONFIG);
  const [sessions, setSessions] = useState<Record<string, StaffSession>>({});

  useEffect(() => {
    void runTransaction(ref(realtimeDatabase, "staffs"), (current) => current ?? { config: DEFAULT_CONFIG, sessions: {} });
    const unsubscribeConfig = onValue(ref(realtimeDatabase, "staffs/config"), (snapshot) => {
      const remote = snapshot.val() as Partial<StaffConfig> | null;
      setConfig({
        idleResetMs: numberValue(remote?.idleResetMs, DEFAULT_CONFIG.idleResetMs),
        rotationThreshold: numberValue(remote?.rotationThreshold, DEFAULT_CONFIG.rotationThreshold),
        spinDegrees: numberValue(remote?.spinDegrees, DEFAULT_CONFIG.spinDegrees),
        uploadIntervalMs: numberValue(remote?.uploadIntervalMs, DEFAULT_CONFIG.uploadIntervalMs),
      });
    });
    const unsubscribeSessions = onValue(ref(realtimeDatabase, "staffs/sessions"), (snapshot) => {
      setSessions((snapshot.val() as Record<string, StaffSession> | null) ?? {});
    });
    return () => {
      unsubscribeConfig();
      unsubscribeSessions();
    };
  }, []);

  const entries = useMemo(
    () => Object.entries(sessions).sort(([, a], [, b]) => numberValue(b.lastActive) - numberValue(a.lastActive)),
    [sessions],
  );

  function changeConfig(key: keyof StaffConfig, raw: string) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    setConfig((current) => ({ ...current, [key]: value }));
    void update(ref(realtimeDatabase, "staffs/config"), { [key]: value });
  }

  function disconnectAllDevices() {
    if (!window.confirm("Disconnect every Staff device while keeping IDs and data?")) return;
    const updates: Record<string, boolean | number> = { "commands/disconnectAllAt": Date.now() };
    for (const [id] of entries) updates[`sessions/${id}/active`] = false;
    void update(ref(realtimeDatabase, "staffs"), updates);
  }

  function deleteAllSessions() {
    if (!window.confirm("Permanently delete every Staff session and all gyro data?")) return;
    void update(ref(realtimeDatabase, "staffs"), { "commands/deleteAllAt": Date.now(), sessions: null });
  }

  function resetSpin(id: string) {
    void update(ref(realtimeDatabase, `staffs/sessions/${id}`), { spinCount: 0, spinProgressDegrees: 0 });
  }

  function deleteSession(id: string) {
    if (!window.confirm(`Delete Staff session ${id}?`)) return;
    void remove(ref(realtimeDatabase, `staffs/sessions/${id}`));
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-mono text-xs uppercase tracking-[0.3em] text-violet-400">Prototype control</p><h1 className="mt-2 text-4xl font-black">Staff Spin Control</h1><p className="mt-3 text-zinc-400">Tune spin recognition and inspect every trackable motion, orientation, session, and device value.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={disconnectAllDevices} disabled={entries.length === 0} className="rounded-xl border border-amber-400/50 px-4 py-3 text-sm font-black text-amber-200 disabled:opacity-40">Disconnect all</button><button type="button" onClick={deleteAllSessions} disabled={entries.length === 0} className="rounded-xl border border-red-400/50 px-4 py-3 text-sm font-black text-red-200 disabled:opacity-40">Delete all sessions</button></div>
        </header>

        <DataGuide sections={STAFF_GUIDE} accent="violet" />

        <section className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 md:grid-cols-2">
          {CONTROL_FIELDS.map((field) => <label key={field.key} className="space-y-2"><span className="block text-sm font-bold">{field.label}</span><div className="flex items-center gap-3"><input type="range" min={field.min} step={field.step} value={config[field.key]} onChange={(event) => changeConfig(field.key, event.target.value)} className="w-full accent-violet-400" /><input type="number" min={field.min} step={field.step} value={config[field.key]} onChange={(event) => changeConfig(field.key, event.target.value)} className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-violet-200" /><span className="w-12 text-xs text-zinc-500">{field.unit}</span></div></label>)}
        </section>

        <section className="grid gap-4 sm:grid-cols-3"><Stat label="Connected devices" value={entries.filter(([, session]) => session.active).length} /><Stat label="Known IDs" value={entries.length} /><Stat label="Total spins" value={entries.reduce((sum, [, session]) => sum + numberValue(session.spinCount), 0)} /></section>

        {entries.length === 0 ? <p className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-zinc-500">No Staff device has connected yet.</p> : <section className="grid gap-5 xl:grid-cols-2">{entries.map(([id, session]) => (
          <article key={id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-4"><div><p className="break-all font-mono text-xs text-violet-300">{id}</p><p className="mt-2 text-xs text-zinc-500">Created: {formatTime(session.createdAt)}</p><p className="mt-1 text-xs text-zinc-500">Connected: {formatTime(session.connectedAtClient)}</p><p className="mt-1 text-xs text-zinc-500">Last active: {formatTime(session.lastActive)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${session.active ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>{session.active ? "Connected" : "Disconnected"}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Spins" value={numberValue(session.spinCount)} compact /><Stat label="Progress" value={`${numberValue(session.spinProgressDegrees).toFixed(1)}°`} compact /><Stat label="Speed" value={`${numberValue(session.angularSpeed).toFixed(1)}°/s`} compact /><Stat label="Axis" value={session.dominantAxis ?? "none"} compact /></div>
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => resetSpin(id)} className="rounded-lg border border-violet-400/50 px-3 py-2 text-sm font-bold text-violet-200">Reset spin count</button><button type="button" onClick={() => deleteSession(id)} className="rounded-lg border border-red-400/50 px-3 py-2 text-sm font-bold text-red-200">Delete session</button></div>
            <div className="mt-6 space-y-5"><DataGrid title="Device details" entries={values(session.device)} /><DataGrid title="Linear acceleration" entries={values(session.acceleration)} /><DataGrid title="Acceleration including gravity" entries={values(session.accelerationIncludingGravity)} /><DataGrid title="Gyroscope rotation" entries={values(session.rotation)} /><DataGrid title="Device orientation" entries={values(session.orientation)} /><DataGrid title="Motion timing" entries={[["interval", session.interval]]} /></div>
          </article>
        ))}</section>}
      </div>
    </main>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return <div className={`rounded-xl border border-zinc-800 bg-zinc-900 ${compact ? "p-3" : "p-5"}`}><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className={`${compact ? "text-lg" : "text-3xl"} mt-2 break-all font-black text-violet-200`}>{value}</p></div>;
}

function DataGrid({ title, entries }: { title: string; entries: Array<[string, unknown]> }) {
  return <section><h2 className="text-sm font-bold text-violet-300">{title}</h2><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{entries.map(([label, value]) => <div key={label} className="rounded-lg bg-zinc-950 p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 break-all font-mono text-xs text-zinc-200">{typeof value === "number" ? value.toFixed(2) : String(value ?? "—")}</p></div>)}</div></section>;
}
