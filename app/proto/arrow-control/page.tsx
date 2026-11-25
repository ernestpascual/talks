"use client";

import { onValue, ref, remove, runTransaction, update } from "firebase/database";
import { useEffect, useMemo, useState } from "react";

import { realtimeDatabase } from "@/lib/firebase";

interface DeviceDetails {
  colorDepth?: number;
  deviceMemory?: number;
  effectiveConnectionType?: string;
  hardwareConcurrency?: number;
  language?: string;
  maxTouchPoints?: number;
  online?: boolean;
  pixelRatio?: number;
  platform?: string;
  screenOrientation?: string;
  screenHeight?: number;
  screenWidth?: number;
  timeZone?: string;
  userAgent?: string;
  viewportHeight?: number;
  viewportWidth?: number;
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

interface PointerData {
  button?: number;
  buttons?: number;
  clientX?: number;
  clientY?: number;
  height?: number;
  isPrimary?: boolean;
  offsetX?: number;
  offsetY?: number;
  pageX?: number;
  pageY?: number;
  pointerId?: number;
  pointerType?: string;
  pressure?: number;
  screenX?: number;
  screenY?: number;
  tangentialPressure?: number;
  tiltX?: number;
  tiltY?: number;
  twist?: number;
  width?: number;
}

interface ArrowSession {
  active?: boolean;
  connectedAtClient?: number;
  createdAt?: number;
  device?: DeviceDetails;
  lastActive?: number;
  lastTap?: {
    motion?: { acceleration?: Vector3; accelerationIncludingGravity?: Vector3; interval?: number; rotation?: Vector3 };
    orientation?: Vector3;
    pointer?: PointerData;
    recordedAt?: number;
  };
  tapCount?: number;
}

interface GuideSection {
  title: string;
  items: Array<{ label: string; description: string }>;
}

const DATA_GUIDE: GuideSection[] = [
  {
    title: "Dashboard and session data",
    items: [
      { label: "Connected devices", description: "Counts Arrow pages currently marked active, which helps you check how many participants are ready." },
      { label: "Known device IDs", description: "Counts every saved Arrow session, which helps you estimate how many browsers have joined over time." },
      { label: "Total recorded taps", description: "Adds the tap counts from all sessions, which gives you a quick audience-wide activity total." },
      { label: "Device ID", description: "Identifies one browser with an anonymous locally stored ID, which lets you follow the same device after reconnecting." },
      { label: "Active", description: "Shows whether the Arrow page is connected right now, which helps you separate live devices from old sessions." },
      { label: "Created at", description: "Records when Firebase first created the session, which helps you see when a device initially joined." },
      { label: "Connected at client", description: "Records the device-clock time of its latest connection, which helps you compare reconnect order while allowing for inaccurate device clocks." },
      { label: "Last activity", description: "Records the latest Firebase server time for a connection change or tap, which helps you spot stale sessions." },
      { label: "Tap count", description: "Counts accepted presses on the Arrow target for one device, which you can use as a score or interaction total." },
      { label: "Latest tap", description: "Records the Firebase server time of the newest target press, which helps you line up the displayed sensor snapshot with an event." },
      { label: "Disconnect-all timestamp", description: "Stores when the global disconnect command was issued, which lets every active Arrow page stop itself once per command." },
    ],
  },
  {
    title: "Browser and device details",
    items: [
      { label: "userAgent", description: "Reports the browser identification string, which can help group results by browser or operating system." },
      { label: "platform", description: "Reports the browser's coarse platform label, which can help separate mobile and desktop behavior but may be intentionally generic." },
      { label: "language", description: "Reports the browser's preferred language, which can help localize labels or compare regional groups." },
      { label: "timeZone", description: "Reports the browser's time-zone name, which can help interpret device-local times or group remote participants." },
      { label: "online", description: "Reports whether the browser believes it has network access, which can help explain delayed Firebase updates." },
      { label: "effectiveConnectionType", description: "Reports a rough network class such as 4g or 3g when available, which can help explain slow synchronization." },
      { label: "deviceMemory", description: "Reports an approximate RAM amount in gigabytes when supported, which can guide how heavy an experience should be." },
      { label: "hardwareConcurrency", description: "Reports the browser-visible logical processor count, which can help choose lighter or heavier visual effects." },
      { label: "maxTouchPoints", description: "Reports the maximum simultaneous touch contacts, which helps confirm touch support and multi-touch capability." },
      { label: "pixelRatio", description: "Reports physical pixels per CSS pixel, which helps size sharp canvas graphics without making them blurry." },
      { label: "colorDepth", description: "Reports the screen color depth in bits per pixel, which can help diagnose color banding on older displays." },
      { label: "screenOrientation", description: "Reports portrait or landscape screen orientation, which can help adapt the target layout to how the device is held." },
      { label: "screenWidth", description: "Reports the full screen width in CSS pixels, which helps compare physical display layouts." },
      { label: "screenHeight", description: "Reports the full screen height in CSS pixels, which helps compare physical display layouts." },
      { label: "viewportWidth", description: "Reports the visible page width in CSS pixels at connection time, which helps tune responsive target sizing." },
      { label: "viewportHeight", description: "Reports the visible page height in CSS pixels at connection time, which helps account for browser bars and keyboards." },
    ],
  },
  {
    title: "Pointer and tap data",
    items: [
      { label: "pointerId", description: "Identifies one active pointer during the current interaction, which helps distinguish fingers or pens but is not a permanent device ID." },
      { label: "pointerType", description: "Reports mouse, touch, or pen input, which lets you compare how people press the target." },
      { label: "isPrimary", description: "Marks the main pointer when several pointers exist, which helps you ignore secondary fingers if needed." },
      { label: "button", description: "Reports which button changed for the event where zero usually means the primary contact, which is useful mainly for mouse and pen input." },
      { label: "buttons", description: "Reports a bitmask of all buttons currently held, which lets you detect combinations on mouse or pen hardware." },
      { label: "clientX", description: "Reports the horizontal tap position inside the visible browser viewport, which is useful for screen-relative aiming." },
      { label: "clientY", description: "Reports the vertical tap position inside the visible browser viewport, which is useful for screen-relative aiming." },
      { label: "pageX", description: "Reports the horizontal tap position on the full document including scroll, which is useful on long pages." },
      { label: "pageY", description: "Reports the vertical tap position on the full document including scroll, which is useful on long pages." },
      { label: "screenX", description: "Reports the horizontal position relative to the physical screen, which can help compare browser-window placement." },
      { label: "screenY", description: "Reports the vertical position relative to the physical screen, which can help compare browser-window placement." },
      { label: "offsetX", description: "Reports the horizontal position inside the Arrow target itself, which is ideal for scoring left-to-right accuracy." },
      { label: "offsetY", description: "Reports the vertical position inside the Arrow target itself, which is ideal for scoring top-to-bottom accuracy." },
      { label: "pressure", description: "Reports normalized contact pressure from zero to one when hardware supports it, which can power light-versus-hard press mechanics." },
      { label: "tangentialPressure", description: "Reports side pressure from minus one to one on supported styluses, which can control an alternate action or effect." },
      { label: "width", description: "Reports the estimated contact width in CSS pixels, which can help distinguish fingertip and precision-pointer input." },
      { label: "height", description: "Reports the estimated contact height in CSS pixels, which can help estimate the touch contact shape." },
      { label: "tiltX", description: "Reports pen tilt toward the left or right from minus ninety to ninety degrees, which can steer horizontal effects." },
      { label: "tiltY", description: "Reports pen tilt toward the top or bottom from minus ninety to ninety degrees, which can steer vertical effects." },
      { label: "twist", description: "Reports pen rotation from zero to 359 degrees when supported, which can rotate an arrow or brush effect." },
      { label: "recordedAt", description: "Records the Firebase server time of the tap snapshot, which provides a common clock across devices." },
    ],
  },
  {
    title: "Motion and orientation data",
    items: [
      { label: "Acceleration X", description: "Measures gravity-free force along the device's left-to-right axis in m/s², which can detect sideways movement during a tap." },
      { label: "Acceleration Y", description: "Measures gravity-free force along the device's bottom-to-top axis in m/s², which can detect upward or downward movement during a tap." },
      { label: "Acceleration Z", description: "Measures gravity-free force perpendicular to the screen in m/s², which can detect a push toward or away from the user." },
      { label: "Acceleration magnitude", description: "Combines the three gravity-free acceleration axes into one positive strength value, which is useful for a simple movement-intensity rule." },
      { label: "Gravity acceleration X", description: "Measures raw left-to-right force including gravity in m/s², which can help infer how the phone was tilted." },
      { label: "Gravity acceleration Y", description: "Measures raw bottom-to-top force including gravity in m/s², which can help infer upright or inverted holding angles." },
      { label: "Gravity acceleration Z", description: "Measures raw force perpendicular to the screen including gravity in m/s², which can help distinguish face-up and face-down positions." },
      { label: "Gravity acceleration magnitude", description: "Combines all raw acceleration axes into one strength value, which should be near 9.8 m/s² on a resting supported device." },
      { label: "Rotation alpha", description: "Measures turning speed around the device's Z axis in degrees per second, which can detect a flat steering-like twist." },
      { label: "Rotation beta", description: "Measures turning speed around the device's X axis in degrees per second, which can detect a forward or backward flip." },
      { label: "Rotation gamma", description: "Measures turning speed around the device's Y axis in degrees per second, which can detect a left or right roll." },
      { label: "Rotation magnitude", description: "Combines all three gyroscope speeds into one positive value, which is useful for detecting any fast rotation without choosing an axis." },
      { label: "Orientation alpha", description: "Reports the device heading around the Z axis in degrees, which can point an arrow around a compass-like circle when supported." },
      { label: "Orientation beta", description: "Reports front-to-back tilt in degrees, which can control vertical aiming or elevation." },
      { label: "Orientation gamma", description: "Reports left-to-right tilt in degrees, which can control horizontal aiming or steering." },
      { label: "Motion interval", description: "Reports milliseconds between motion samples, which helps you judge sensor smoothness and timing quality." },
    ],
  },
];

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatTime(value: number | undefined) {
  if (!value) return "Waiting for activity";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(value);
}

export default function ArrowControlPage() {
  const [sessions, setSessions] = useState<Record<string, ArrowSession>>({});

  useEffect(() => {
    void runTransaction(ref(realtimeDatabase, "arrows"), (current) => current ?? { sessions: {} });
    return onValue(ref(realtimeDatabase, "arrows/sessions"), (snapshot) => {
      setSessions((snapshot.val() as Record<string, ArrowSession> | null) ?? {});
    });
  }, []);

  const sessionEntries = useMemo(
    () => Object.entries(sessions).sort(([, a], [, b]) => asNumber(b.lastActive) - asNumber(a.lastActive)),
    [sessions],
  );
  const connectedCount = sessionEntries.filter(([, session]) => session.active).length;

  function resetTapCount(id: string) {
    const confirmed = window.confirm(`Reset the tap count for ${id}? The device ID and its latest sensor snapshot will be kept.`);
    if (!confirmed) return;
    void update(ref(realtimeDatabase, `arrows/sessions/${id}`), { tapCount: 0 });
  }

  function deleteDevice(id: string) {
    const confirmed = window.confirm(`Delete ${id} and all of its saved Arrow data? If this device is still connected, it can recreate its session with its next tap.`);
    if (!confirmed) return;
    void remove(ref(realtimeDatabase, `arrows/sessions/${id}`));
  }

  function disconnectAllDevices() {
    const confirmed = window.confirm("Disconnect every Arrow device? Their IDs and saved tap data will remain, but active pages will stop listening for sensor and tap events.");
    if (!confirmed) return;

    const updates: Record<string, boolean | number> = { "commands/disconnectAllAt": Date.now() };
    for (const [id] of sessionEntries) {
      updates[`sessions/${id}/active`] = false;
    }
    void update(ref(realtimeDatabase, "arrows"), updates);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-orange-400">Prototype control</p>
            <h1 className="mt-2 text-4xl font-black">Arrow Device Control</h1>
            <p className="mt-3 max-w-3xl text-zinc-400">Each browser keeps its anonymous ID in local storage. Connecting, disconnecting, and reconnecting the same browser retains that ID and its tap history.</p>
          </div>
          <button type="button" onClick={disconnectAllDevices} disabled={sessionEntries.length === 0} className="rounded-xl border border-red-400/50 px-4 py-3 text-sm font-black text-red-200 transition hover:bg-red-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600">Disconnect all devices</button>
        </header>

        <details className="group rounded-2xl border border-orange-400/20 bg-orange-400/5 p-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-2xl font-black text-orange-200">
            Complete data legend and ideas
            <span className="text-sm font-medium text-orange-300 group-open:hidden">Show guide</span>
            <span className="hidden text-sm font-medium text-orange-300 group-open:inline">Hide guide</span>
          </summary>
          <p className="mt-3 max-w-3xl text-sm text-zinc-400">Each entry below explains exactly one value and gives you one practical way to use it.</p>
          <div className="mt-5 space-y-5">
            {DATA_GUIDE.map((section) => (
              <section key={section.title} className="rounded-xl bg-zinc-950/80 p-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-orange-300">{section.title}</h3>
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

        <section className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Connected devices" value={connectedCount} color="text-emerald-300" />
          <SummaryCard label="Known device IDs" value={sessionEntries.length} color="text-orange-300" />
          <SummaryCard label="Total recorded taps" value={sessionEntries.reduce((total, [, session]) => total + asNumber(session.tapCount), 0)} color="text-cyan-300" />
        </section>

        {sessionEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 p-10 text-center text-zinc-500">No Arrow device has connected yet.</div>
        ) : (
          <section className="grid gap-5 xl:grid-cols-2">
            {sessionEntries.map(([id, session]) => <ArrowSessionCard key={id} id={id} session={session} onDelete={deleteDevice} onResetTapCount={resetTapCount} />)}
          </section>
        )}
      </div>
    </main>
  );
}

function ArrowSessionCard({
  id,
  session,
  onDelete,
  onResetTapCount,
}: {
  id: string;
  session: ArrowSession;
  onDelete: (id: string) => void;
  onResetTapCount: (id: string) => void;
}) {
  const deviceValues = Object.entries(session.device ?? {});
  const pointerValues = Object.entries(session.lastTap?.pointer ?? {});
  const accelerationValues = Object.entries(session.lastTap?.motion?.acceleration ?? {});
  const gravityAccelerationValues = Object.entries(session.lastTap?.motion?.accelerationIncludingGravity ?? {});
  const rotationValues = Object.entries(session.lastTap?.motion?.rotation ?? {});
  const orientationValues = Object.entries(session.lastTap?.orientation ?? {});
  const sessionValues: Array<[string, unknown]> = [
    ["deviceId", id],
    ["active", Boolean(session.active)],
    ["createdAt", session.createdAt ? formatTime(session.createdAt) : "Unavailable"],
    ["connectedAtClient", session.connectedAtClient ? formatTime(session.connectedAtClient) : "Unavailable"],
    ["lastActive", session.lastActive ? formatTime(session.lastActive) : "Unavailable"],
    ["tapCount", asNumber(session.tapCount)],
    ["recordedAt", session.lastTap?.recordedAt ? formatTime(session.lastTap.recordedAt) : "Unavailable"],
  ];

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="break-all font-mono text-xs text-orange-300">{id}</p>
          <p className="mt-2 text-xs text-zinc-500">Last activity: {formatTime(session.lastActive)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${session.active ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"}`}>{session.active ? "Connected" : "Disconnected"}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard label="Tap count" value={asNumber(session.tapCount)} color="text-orange-200" compact />
        <SummaryCard label="Latest tap" value={formatTime(session.lastTap?.recordedAt)} color="text-cyan-200" compact />
        <SummaryCard label="Touch points" value={asNumber(session.device?.maxTouchPoints)} color="text-zinc-200" compact />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onResetTapCount(id)} className="rounded-lg border border-orange-400/50 px-3 py-2 text-sm font-bold text-orange-200 transition hover:bg-orange-400 hover:text-zinc-950">Reset tap count</button>
        <button type="button" onClick={() => onDelete(id)} className="rounded-lg border border-red-400/50 px-3 py-2 text-sm font-bold text-red-200 transition hover:bg-red-400 hover:text-zinc-950">Delete device data</button>
      </div>

      <div className="mt-6 space-y-5">
        <DataGrid title="Session metadata" values={sessionValues} />
        <DataGrid title="Browser and device details" values={deviceValues} />
        <DataGrid title="Latest pointer event" values={pointerValues} emptyLabel="Tap the Arrow target to capture pointer data." />
        <DataGrid title="Latest linear acceleration" values={accelerationValues} emptyLabel="No motion sample was exposed when the target was tapped." />
        <DataGrid title="Latest acceleration including gravity" values={gravityAccelerationValues} emptyLabel="No gravity-inclusive acceleration sample was exposed when the target was tapped." />
        <DataGrid title="Latest gyroscope rotation rate" values={rotationValues} emptyLabel="No gyroscope sample was exposed when the target was tapped." />
        <DataGrid title="Latest device orientation" values={orientationValues} emptyLabel="No orientation sample was exposed when the target was tapped." />
        <DataGrid title="Latest motion event timing" values={[["interval", session.lastTap?.motion?.interval]]} />
      </div>
    </article>
  );
}

function SummaryCard({ label, value, color, compact = false }: { label: string; value: string | number; color: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900 ${compact ? "p-3" : "p-5"}`}>
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-2 break-all font-black ${compact ? "text-lg" : "text-4xl"} ${color}`}>{value}</p>
    </div>
  );
}

function DataGrid({ title, values, emptyLabel }: { title: string; values: Array<[string, unknown]>; emptyLabel?: string }) {
  return (
    <section>
      <h2 className="text-sm font-bold text-orange-300">{title}</h2>
      {values.length === 0 ? <p className="mt-2 text-xs text-zinc-500">{emptyLabel ?? "No data available."}</p> : (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {values.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  const formatted = typeof value === "number" ? value.toFixed(2) : String(value ?? "—");
  return <div className="rounded-lg bg-zinc-950 p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 break-all font-mono text-xs text-zinc-200">{formatted}</p></div>;
}
