"use client";

import { get, onDisconnect, onValue, ref, runTransaction, serverTimestamp, update } from "firebase/database";
import { useEffect, useRef, useState } from "react";

import { realtimeDatabase } from "@/lib/firebase";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface DeviceDetails {
  colorDepth: number;
  deviceMemory: number;
  effectiveConnectionType: string;
  hardwareConcurrency: number;
  language: string;
  maxTouchPoints: number;
  online: boolean;
  pixelRatio: number;
  platform: string;
  screenOrientation: string;
  screenHeight: number;
  screenWidth: number;
  timeZone: string;
  userAgent: string;
  viewportHeight: number;
  viewportWidth: number;
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

interface TapData {
  motion: { acceleration: Vector3; accelerationIncludingGravity: Vector3; interval: number; rotation: Vector3 };
  orientation: Vector3;
  pointer: {
    button: number;
    buttons: number;
    clientX: number;
    clientY: number;
    height: number;
    isPrimary: boolean;
    offsetX: number;
    offsetY: number;
    pageX: number;
    pageY: number;
    pointerId: number;
    pointerType: string;
    pressure: number;
    screenX: number;
    screenY: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    width: number;
  };
  recordedAt: number;
}

const DEVICE_STORAGE_KEY = "arrow-sensor-device-id";

function toNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function magnitude(x: number, y: number, z: number) {
  return Math.sqrt(x ** 2 + y ** 2 + z ** 2);
}

function newDeviceId() {
  const randomPart = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `arrow-${randomPart}`;
}

function getDeviceDetails(): DeviceDetails {
  const browserNavigator = navigator as Navigator & {
    connection?: { effectiveType?: string };
    deviceMemory?: number;
  };
  return {
    colorDepth: window.screen.colorDepth,
    deviceMemory: browserNavigator.deviceMemory ?? 0,
    effectiveConnectionType: browserNavigator.connection?.effectiveType ?? "unavailable",
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    language: navigator.language,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    online: navigator.onLine,
    pixelRatio: window.devicePixelRatio,
    platform: navigator.platform,
    screenOrientation: window.screen.orientation?.type ?? "unavailable",
    screenHeight: window.screen.height,
    screenWidth: window.screen.width,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent: navigator.userAgent,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  };
}

export default function ArrowPrototypePage() {
  const [connection, setConnection] = useState<ConnectionStatus>("disconnected");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [lastTap, setLastTap] = useState<TapData | null>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [status, setStatus] = useState("Connect to create or resume this browser’s anonymous Arrow device.");

  const deviceIdRef = useRef<string | null>(null);
  const connectionStartedAtRef = useRef(0);
  const orientationRef = useRef<Vector3>({});
  const motionRef = useRef<{ acceleration: Vector3; accelerationIncludingGravity: Vector3; interval: number; rotation: Vector3 }>({
    acceleration: {},
    accelerationIncludingGravity: {},
    interval: 0,
    rotation: {},
  });

  useEffect(() => {
    void runTransaction(ref(realtimeDatabase, "arrows"), (current) => current ?? { sessions: {} });
  }, []);

  useEffect(() => {
    if (connection !== "connected" || !motionAllowed) return;

    function handleOrientation(event: DeviceOrientationEvent) {
      orientationRef.current = {
        alpha: toNumber(event.alpha),
        beta: toNumber(event.beta),
        gamma: toNumber(event.gamma),
      };
    }

    function handleMotion(event: DeviceMotionEvent) {
      const linear = event.acceleration;
      const gravityAcceleration = event.accelerationIncludingGravity;
      const rotation = event.rotationRate;
      const accelerationX = toNumber(linear?.x);
      const accelerationY = toNumber(linear?.y);
      const accelerationZ = toNumber(linear?.z);
      const rotationAlpha = toNumber(rotation?.alpha);
      const rotationBeta = toNumber(rotation?.beta);
      const rotationGamma = toNumber(rotation?.gamma);
      motionRef.current = {
        acceleration: {
          x: accelerationX,
          y: accelerationY,
          z: accelerationZ,
          magnitude: magnitude(accelerationX, accelerationY, accelerationZ),
        },
        accelerationIncludingGravity: {
          x: toNumber(gravityAcceleration?.x),
          y: toNumber(gravityAcceleration?.y),
          z: toNumber(gravityAcceleration?.z),
          magnitude: magnitude(
            toNumber(gravityAcceleration?.x),
            toNumber(gravityAcceleration?.y),
            toNumber(gravityAcceleration?.z),
          ),
        },
        interval: toNumber(event.interval),
        rotation: {
          alpha: rotationAlpha,
          beta: rotationBeta,
          gamma: rotationGamma,
          magnitude: magnitude(rotationAlpha, rotationBeta, rotationGamma),
        },
      };
    }

    window.addEventListener("devicemotion", handleMotion);
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [connection, motionAllowed]);

  useEffect(() => {
    if (connection !== "connected") return;

    return onValue(ref(realtimeDatabase, "arrows/commands/disconnectAllAt"), (snapshot) => {
      const disconnectedAt = toNumber(snapshot.val());
      if (disconnectedAt > connectionStartedAtRef.current) {
        void disconnect("All Arrow devices were disconnected from the control dashboard.");
      }
    });
  }, [connection]);

  async function beginConnection(canReadMotion: boolean) {
    const storedId = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    const id = deviceIdRef.current ?? storedId ?? newDeviceId();
    const sessionPath = ref(realtimeDatabase, `arrows/sessions/${id}`);

    try {
      const existingSession = (await get(sessionPath)).val() as { tapCount?: number } | null;
      await update(sessionPath, {
        active: true,
        connectedAtClient: Date.now(),
        device: getDeviceDetails(),
        lastActive: serverTimestamp(),
        ...(existingSession ? {} : { createdAt: serverTimestamp(), tapCount: 0 }),
      });
      await onDisconnect(sessionPath).update({ active: false, lastActive: serverTimestamp() });

      window.localStorage.setItem(DEVICE_STORAGE_KEY, id);
      deviceIdRef.current = id;
      setDeviceId(id);
      setTapCount(toNumber(existingSession?.tapCount));
      setMotionAllowed(canReadMotion);
      connectionStartedAtRef.current = Date.now();
      setConnection("connected");
      setStatus(canReadMotion ? "Connected. Tap the target to send pointer and sensor snapshots." : "Connected. Tap data is available, but this browser did not grant motion-sensor access.");
    } catch {
      setConnection("disconnected");
      setStatus("Unable to create or resume the Arrow Firebase session.");
    }
  }

  // requestPermission is called synchronously from this click to keep iOS Safari gesture context.
  function connect() {
    if (connection !== "disconnected") return;
    setConnection("connecting");

    type PermissionMotionEvent = typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    const motionEvent = window.DeviceMotionEvent as PermissionMotionEvent | undefined;

    if (motionEvent && typeof motionEvent.requestPermission === "function") {
      try {
        motionEvent.requestPermission()
          .then((result) => void beginConnection(result === "granted"))
          .catch(() => void beginConnection(false));
      } catch {
        void beginConnection(false);
      }
      return;
    }

    void beginConnection(Boolean(motionEvent));
  }

  async function disconnect(message = "Disconnected. This browser will reuse the same Arrow device ID when you connect again.") {
    const id = deviceIdRef.current;
    if (!id) return;

    setConnection("disconnected");
    setMotionAllowed(false);
    setStatus(message);
    const sessionPath = ref(realtimeDatabase, `arrows/sessions/${id}`);
    try {
      await update(sessionPath, { active: false, lastActive: serverTimestamp() });
      await onDisconnect(sessionPath).cancel();
    } catch {
      setStatus("Disconnected locally, but the inactive status could not be saved to Firebase.");
    }
  }

  function captureTap(event: React.PointerEvent<HTMLButtonElement>) {
    const id = deviceIdRef.current;
    if (!id || connection !== "connected") return;

    const nativeEvent = event.nativeEvent;
    const tap: TapData = {
      motion: motionRef.current,
      orientation: orientationRef.current,
      pointer: {
        button: event.button,
        buttons: event.buttons,
        clientX: event.clientX,
        clientY: event.clientY,
        height: event.height,
        isPrimary: event.isPrimary,
        offsetX: nativeEvent.offsetX,
        offsetY: nativeEvent.offsetY,
        pageX: event.pageX,
        pageY: event.pageY,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        pressure: event.pressure,
        screenX: event.screenX,
        screenY: event.screenY,
        tangentialPressure: event.tangentialPressure,
        tiltX: event.tiltX,
        tiltY: event.tiltY,
        twist: event.twist,
        width: event.width,
      },
      recordedAt: Date.now(),
    };

    setLastTap(tap);
    void runTransaction(ref(realtimeDatabase, `arrows/sessions/${id}/tapCount`), (count) => {
      const nextCount = typeof count === "number" ? count + 1 : 1;
      setTapCount(nextCount);
      return nextCount;
    });
    void update(ref(realtimeDatabase, `arrows/sessions/${id}`), {
      active: true,
      lastActive: serverTimestamp(),
      lastTap: { ...tap, recordedAt: serverTimestamp() },
    });
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-orange-400">Prototype</p>
          <h1 className="mt-2 text-4xl font-black">Arrow Tap Sensor</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">Connect once to identify this browser, then tap the target to send pointer, motion, and orientation data to Firebase.</p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={connect} disabled={connection !== "disconnected"} className="rounded-xl bg-orange-400 px-5 py-4 text-base font-black text-zinc-950 transition hover:bg-orange-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">
              {connection === "connected" ? "Arrow connected" : connection === "connecting" ? "Connecting…" : deviceId ? "Reconnect Arrow" : "Connect Arrow"}
            </button>
            <button type="button" onClick={() => void disconnect()} disabled={connection !== "connected"} className="rounded-xl border border-zinc-700 px-5 py-4 text-base font-black text-zinc-200 transition hover:border-orange-300 hover:text-orange-200 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600">
              Disconnect Arrow
            </button>
          </div>
          <p className="mt-4 text-sm text-zinc-300">{status}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-[1fr_280px]">
          <button type="button" onPointerDown={captureTap} disabled={connection !== "connected"} className="touch-manipulation rounded-3xl border border-orange-400/50 bg-gradient-to-br from-orange-500/30 to-zinc-900 p-10 text-left shadow-2xl shadow-orange-950/25 transition hover:border-orange-300 disabled:cursor-not-allowed disabled:opacity-50">
            <span className="text-7xl leading-none">➜</span>
            <span className="mt-6 block text-2xl font-black">Tap the Arrow target</span>
            <span className="mt-2 block text-sm text-zinc-300">Each press stores its exact pointer-event snapshot and the latest available device motion.</span>
          </button>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Tap count</p>
            <p className="mt-2 text-6xl font-black text-orange-300">{tapCount}</p>
            <p className="mt-6 text-xs uppercase tracking-wider text-zinc-500">Device ID</p>
            <p className="mt-2 break-all font-mono text-xs text-zinc-200">{deviceId ?? "Not connected"}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-xl font-black">Latest tap data</h2>
          <p className="mt-1 text-xs text-zinc-500">The panel shows values exposed by the current browser. Unsupported sensor fields remain at zero.</p>
          {lastTap ? <TapDataPanel tap={lastTap} /> : <p className="mt-5 rounded-xl bg-zinc-950 p-5 text-sm text-zinc-500">Connect, then tap the Arrow target to capture a data snapshot.</p>}
        </section>
      </div>
    </main>
  );
}

function TapDataPanel({ tap }: { tap: TapData }) {
  const pointerFields = Object.entries(tap.pointer);
  return (
    <div className="mt-5 space-y-5">
      <DataGrid title="Pointer event" values={pointerFields} />
      <DataGrid title="Linear acceleration" values={Object.entries(tap.motion.acceleration)} />
      <DataGrid title="Acceleration including gravity" values={Object.entries(tap.motion.accelerationIncludingGravity)} />
      <DataGrid title="Gyroscope rotation rate" values={Object.entries(tap.motion.rotation)} />
      <DataGrid title="Device orientation" values={Object.entries(tap.orientation)} />
      <DataGrid title="Motion event timing" values={[["interval", tap.motion.interval]]} />
    </div>
  );
}

function DataGrid({ title, values }: { title: string; values: Array<[string, string | number | boolean | undefined]> }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-orange-300">{title}</h3>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {values.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number | boolean | undefined }) {
  const formatted = typeof value === "number" ? value.toFixed(2) : String(value ?? 0);
  return <div className="rounded-lg bg-zinc-950 p-3"><p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 break-all font-mono text-xs text-zinc-200">{formatted}</p></div>;
}
