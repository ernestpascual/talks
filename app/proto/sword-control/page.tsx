"use client";

import { onValue, ref, remove, runTransaction, update } from "firebase/database";
import { useEffect, useState } from "react";

import { realtimeDatabase } from "@/lib/firebase";

interface SwordConfig {
  accelerationThreshold: number;
  cooldownMs: number;
  rotationThreshold: number;
  uploadIntervalMs: number;
}

interface Vector3 {
  alpha?: number;
  beta?: number;
  gamma?: number;
  magnitude?: number;
  x?: number;
  y?: number;
  z?: number;
}

interface SwordSession {
  acceleration?: Vector3;
  accelerationIncludingGravity?: Vector3;
  active?: boolean;
  connectedAtClient?: number;
  createdAt?: number;
  experience?: "sword" | "sword-2";
  interval?: number;
  lastActive?: number;
  orientation?: Vector3;
  rotation?: Vector3;
  slashAcceleration?: Vector3;
  slashCount?: number;
}

const DEFAULT_CONFIG: SwordConfig = {
  accelerationThreshold: 16,
  cooldownMs: 550,
  rotationThreshold: 350,
  uploadIntervalMs: 100,
};

const CONTROL_FIELDS: Array<{ key: keyof SwordConfig; label: string; min: number; step: number; unit: string }> = [
  { key: "accelerationThreshold", label: "Acceleration threshold", min: 1, step: 0.5, unit: "m/s²" },
  { key: "rotationThreshold", label: "Rotation threshold", min: 1, step: 10, unit: "°/s" },
  { key: "cooldownMs", label: "Slash cooldown", min: 50, step: 50, unit: "ms" },
  { key: "uploadIntervalMs", label: "Telemetry upload interval", min: 50, step: 10, unit: "ms" },
];

interface GuideSection {
  title: string;
  items: Array<{ label: string; description: string }>;
}

const DATA_GUIDE: GuideSection[] = [
  {
    title: "Threshold controls",
    items: [
      { label: "Acceleration threshold", description: "Sets the minimum combined slash-acceleration strength in m/s², so lower values catch gentler swings while higher values reject small movements." },
      { label: "Rotation threshold", description: "Sets the minimum combined gyroscope speed in degrees per second, so lower values allow slower turns while higher values require sharper swings." },
      { label: "Slash cooldown", description: "Sets the minimum milliseconds between counted slashes, which prevents one physical swing from producing several counts." },
      { label: "Telemetry upload interval", description: "Sets the minimum milliseconds between Firebase sensor updates, so lower values look smoother while higher values reduce database writes." },
      { label: "Slash rule", description: "Counts a slash only when acceleration magnitude and rotation magnitude both reach their thresholds after the cooldown, which makes detection require force and rotation together." },
    ],
  },
  {
    title: "Session data",
    items: [
      { label: "Session ID", description: "Identifies one browser with an anonymous locally stored ID, which lets you follow the same Sword device after stopping or reconnecting." },
      { label: "Experience", description: "Shows whether a session came from the original Sword sensor screen or the motion-driven 3D Sword 2 screen." },
      { label: "Active", description: "Shows whether the Sword page is currently reading motion events, which helps you separate live devices from saved sessions." },
      { label: "Created at", description: "Records the Firebase server time when the session was first created, which helps you see when a device initially joined." },
      { label: "Connected at client", description: "Records the device-clock time of its latest sensor activation, which helps compare reconnect order while allowing for inaccurate device clocks." },
      { label: "Last active", description: "Records the latest Firebase server time for telemetry or a connection change, which helps you spot stale devices." },
      { label: "Slash count", description: "Counts detected slashing motions for one session, which you can use as a score or activity measure." },
      { label: "Disconnect-all timestamp", description: "Stores when the shared disconnect command was issued, which lets every active Sword page stop its motion listeners once per command." },
    ],
  },
  {
    title: "Linear acceleration",
    items: [
      { label: "Accel X", description: "Measures gravity-free force along the device's left-to-right axis in m/s², which can help recognize horizontal swings." },
      { label: "Accel Y", description: "Measures gravity-free force along the device's bottom-to-top axis in m/s², which can help recognize upward and downward swings." },
      { label: "Accel Z", description: "Measures gravity-free force perpendicular to the screen in m/s², which can help recognize forward thrusts." },
      { label: "Accel magnitude", description: "Combines the three gravity-free acceleration axes into one positive movement-strength value, which helps compare swings without choosing a direction." },
    ],
  },
  {
    title: "Acceleration including gravity",
    items: [
      { label: "Gravity accel X", description: "Measures raw left-to-right force including gravity in m/s², which can help infer sideways phone tilt." },
      { label: "Gravity accel Y", description: "Measures raw bottom-to-top force including gravity in m/s², which can help infer upright or inverted holding angles." },
      { label: "Gravity accel Z", description: "Measures raw force perpendicular to the screen including gravity in m/s², which can help distinguish face-up and face-down positions." },
      { label: "Gravity accel magnitude", description: "Combines all raw acceleration axes into one positive value, which should be near 9.8 m/s² on a resting supported device." },
    ],
  },
  {
    title: "Slash acceleration",
    items: [
      { label: "Slash accel X", description: "Shows the X-axis value actually used by slash detection, which falls back to gravity-inclusive acceleration when linear acceleration is unavailable." },
      { label: "Slash accel Y", description: "Shows the Y-axis value actually used by slash detection, which helps you verify the browser's fallback behavior." },
      { label: "Slash accel Z", description: "Shows the Z-axis value actually used by slash detection, which helps you tune thrust sensitivity across browsers." },
      { label: "Slash accel magnitude", description: "Combines the three detection acceleration axes into the value compared with the acceleration threshold, which is the best number to watch while tuning." },
    ],
  },
  {
    title: "Gyroscope and orientation",
    items: [
      { label: "Rotation alpha", description: "Measures turning speed around the device's Z axis in degrees per second, which can detect a flat steering-like slash." },
      { label: "Rotation beta", description: "Measures turning speed around the device's X axis in degrees per second, which can detect a forward or backward chopping slash." },
      { label: "Rotation gamma", description: "Measures turning speed around the device's Y axis in degrees per second, which can detect a left or right rolling slash." },
      { label: "Rotation magnitude", description: "Combines all three gyroscope speeds into the value compared with the rotation threshold, which is the best rotation number to watch while tuning." },
      { label: "Orientation alpha", description: "Reports heading around the device's Z axis in degrees, which can support compass-like sword direction effects." },
      { label: "Orientation beta", description: "Reports front-to-back tilt in degrees, which can support vertical sword pose or elevation controls." },
      { label: "Orientation gamma", description: "Reports left-to-right tilt in degrees, which can support horizontal sword pose or steering controls." },
      { label: "Motion interval", description: "Reports milliseconds between browser motion samples, which helps you judge sensor smoothness and timing quality without changing slash detection." },
    ],
  },
];

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatValue(value: number | undefined) {
  return asNumber(value).toFixed(2);
}

function formatTime(value: number | undefined) {
  if (!value) return "Waiting for data";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(value);
}

export default function SwordControlPage() {
  const [config, setConfig] = useState<SwordConfig>(DEFAULT_CONFIG);
  const [sessions, setSessions] = useState<Record<string, SwordSession>>({});

  useEffect(() => {
    const swordsPath = ref(realtimeDatabase, "swords");
    void runTransaction(swordsPath, (current) => current ?? {
      config: DEFAULT_CONFIG,
      sessions: {},
    });

    const configPath = ref(realtimeDatabase, "swords/config");
    return onValue(configPath, (snapshot) => {
      const remote = snapshot.val() as Partial<SwordConfig> | null;
      setConfig({
        accelerationThreshold: asNumber(remote?.accelerationThreshold, DEFAULT_CONFIG.accelerationThreshold),
        cooldownMs: asNumber(remote?.cooldownMs, DEFAULT_CONFIG.cooldownMs),
        rotationThreshold: asNumber(remote?.rotationThreshold, DEFAULT_CONFIG.rotationThreshold),
        uploadIntervalMs: asNumber(remote?.uploadIntervalMs, DEFAULT_CONFIG.uploadIntervalMs),
      });
    });
  }, []);

  useEffect(() => {
    return onValue(ref(realtimeDatabase, "swords/sessions"), (snapshot) => {
      setSessions((snapshot.val() as Record<string, SwordSession> | null) ?? {});
    });
  }, []);

  function changeConfig(key: keyof SwordConfig, rawValue: string) {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;

    setConfig((current) => ({ ...current, [key]: value }));
    void update(ref(realtimeDatabase, "swords/config"), { [key]: value });
  }

  function clearSlashCount(id: string) {
    void update(ref(realtimeDatabase, `swords/sessions/${id}`), { slashCount: 0 });
  }

  function deleteSession(id: string) {
    const confirmed = window.confirm(`Delete the session ${id}? An actively streaming phone can recreate it with its next sensor update.`);
    if (!confirmed) return;

    void remove(ref(realtimeDatabase, `swords/sessions/${id}`));
  }

  const sessionEntries = Object.entries(sessions).sort(([, a], [, b]) => asNumber(b.lastActive) - asNumber(a.lastActive));

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-10">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-fuchsia-400">Prototype control</p>
          <h1 className="mt-2 text-4xl font-black">Sword Sensor Control</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">Changes are written to Firebase immediately and applied by every active Sword session on its next sensor event.</p>
        </header>

        <details className="group rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-2xl font-black text-fuchsia-200">
            Complete data legend and ideas
            <span className="text-sm font-medium text-fuchsia-300 group-open:hidden">Show guide</span>
            <span className="hidden text-sm font-medium text-fuchsia-300 group-open:inline">Hide guide</span>
          </summary>
          <p className="mt-3 max-w-3xl text-sm text-zinc-400">Each entry below explains exactly one value and gives you one practical way to use it.</p>
          <div className="mt-5 space-y-5">
            {DATA_GUIDE.map((section) => (
              <section key={section.title} className="rounded-xl bg-zinc-950/80 p-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-fuchsia-300">{section.title}</h3>
                <dl className="mt-3 grid gap-3 md:grid-cols-2">
                  {section.items.map((item) => (
                    <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
                      <dt className="font-mono text-xs font-bold text-zinc-100">{item.label}</dt>
                      <dd className="mt-1 text-xs leading-relaxed text-zinc-400">{item.description}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </details>

        <section className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 md:grid-cols-2">
          {CONTROL_FIELDS.map((field) => (
            <label key={field.key} className="space-y-2">
              <span className="block text-sm font-bold text-zinc-200">{field.label}</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={field.min}
                  step={field.step}
                  value={config[field.key]}
                  onChange={(event) => changeConfig(field.key, event.target.value)}
                  className="w-full accent-fuchsia-400"
                />
                <input
                  type="number"
                  min={field.min}
                  step={field.step}
                  value={config[field.key]}
                  onChange={(event) => changeConfig(field.key, event.target.value)}
                  className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-fuchsia-200 outline-none focus:border-fuchsia-400"
                />
                <span className="w-12 text-xs text-zinc-500">{field.unit}</span>
              </div>
            </label>
          ))}
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Live sessions</h2>
              <p className="text-sm text-zinc-500">{sessionEntries.length} session{sessionEntries.length === 1 ? "" : "s"} recorded</p>
            </div>
          </div>

          {sessionEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-zinc-500">No phone has activated a Sword sensor session yet.</div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {sessionEntries.map(([id, session]) => (
                <article key={id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-all font-mono text-xs text-cyan-300">{id}</p>
                        <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-200">
                          {session.experience === "sword-2" ? "Sword 2" : "Sword"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">Last signal: {formatTime(session.lastActive)}</p>
                      <p className="mt-1 text-xs text-zinc-500">Created: {formatTime(session.createdAt)}</p>
                      <p className="mt-1 text-xs text-zinc-500">Sensor activated: {formatTime(session.connectedAtClient)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${session.active ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>
                      {session.active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <SensorValue label="Accel X" value={session.acceleration?.x} />
                    <SensorValue label="Accel Y" value={session.acceleration?.y} />
                    <SensorValue label="Accel Z" value={session.acceleration?.z} />
                    <SensorValue label="Accel magnitude" value={session.acceleration?.magnitude} />
                    <SensorValue label="Gravity accel X" value={session.accelerationIncludingGravity?.x} />
                    <SensorValue label="Gravity accel Y" value={session.accelerationIncludingGravity?.y} />
                    <SensorValue label="Gravity accel Z" value={session.accelerationIncludingGravity?.z} />
                    <SensorValue label="Gravity accel magnitude" value={session.accelerationIncludingGravity?.magnitude} />
                    <SensorValue label="Slash accel X" value={session.slashAcceleration?.x} />
                    <SensorValue label="Slash accel Y" value={session.slashAcceleration?.y} />
                    <SensorValue label="Slash accel Z" value={session.slashAcceleration?.z} />
                    <SensorValue label="Slash accel magnitude" value={session.slashAcceleration?.magnitude} />
                    <SensorValue label="Rotation α" value={session.rotation?.alpha} />
                    <SensorValue label="Rotation β" value={session.rotation?.beta} />
                    <SensorValue label="Rotation γ" value={session.rotation?.gamma} />
                    <SensorValue label="Rotation magnitude" value={session.rotation?.magnitude} />
                    <SensorValue label="Orientation α" value={session.orientation?.alpha} />
                    <SensorValue label="Orientation β" value={session.orientation?.beta} />
                    <SensorValue label="Orientation γ" value={session.orientation?.gamma} />
                    <SensorValue label="Motion interval" value={session.interval} />
                  </div>

                  <div className="mt-5 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
                    <p className="text-xs uppercase tracking-wider text-fuchsia-300">Slash count</p>
                    <p className="mt-1 text-4xl font-black text-fuchsia-200">{asNumber(session.slashCount)}</p>
                    <button
                      type="button"
                      onClick={() => clearSlashCount(id)}
                      className="mt-3 rounded-lg border border-fuchsia-400/50 px-3 py-2 text-sm font-bold text-fuchsia-200 transition hover:bg-fuchsia-400 hover:text-zinc-950"
                    >
                      Clear slash count
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSession(id)}
                      className="mt-3 ml-2 rounded-lg border border-red-400/50 px-3 py-2 text-sm font-bold text-red-200 transition hover:bg-red-400 hover:text-zinc-950"
                    >
                      Delete session
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SensorValue({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg bg-zinc-950 p-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-zinc-200">{formatValue(value)}</p>
    </div>
  );
}
