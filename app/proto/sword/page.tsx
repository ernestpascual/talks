"use client";

import { get, onDisconnect, onValue, ref, runTransaction, serverTimestamp, update } from "firebase/database";
import { useEffect, useRef, useState } from "react";

import { realtimeDatabase } from "@/lib/firebase";

type SensorPermission = "prompt" | "granted" | "stopped" | "denied" | "unsupported";

interface SensorVector {
  x?: number;
  y?: number;
  z?: number;
  alpha?: number;
  beta?: number;
  gamma?: number;
  magnitude?: number;
}

interface SensorTelemetry {
  acceleration: SensorVector;
  accelerationIncludingGravity: SensorVector;
  interval: number;
  orientation: SensorVector;
  rotation: SensorVector;
}

interface SwordConfig {
  accelerationThreshold: number;
  cooldownMs: number;
  rotationThreshold: number;
  uploadIntervalMs: number;
}

const DEFAULT_CONFIG: SwordConfig = {
  accelerationThreshold: 16,
  cooldownMs: 550,
  rotationThreshold: 350,
  uploadIntervalMs: 100,
};

const DEVICE_STORAGE_KEY = "sword-sensor-device-id";

function toNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function magnitude(x: number, y: number, z: number) {
  return Math.sqrt(x ** 2 + y ** 2 + z ** 2);
}

function newSessionId() {
  const randomPart = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `sword-${randomPart}`;
}

export default function SwordPrototypePage() {
  const [permission, setPermission] = useState<SensorPermission>("prompt");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [slashCount, setSlashCount] = useState(0);
  const [status, setStatus] = useState("Activate your phone motion sensor to start a session.");
  const [telemetry, setTelemetry] = useState<SensorTelemetry>({
    acceleration: {},
    accelerationIncludingGravity: {},
    interval: 0,
    orientation: {},
    rotation: {},
  });

  const configRef = useRef<SwordConfig>(DEFAULT_CONFIG);
  const sessionIdRef = useRef<string | null>(null);
  const lastSlashRef = useRef(0);
  const lastUploadRef = useRef(0);
  const orientationRef = useRef<SensorVector>({});
  const connectionStartedAtRef = useRef(0);

  useEffect(() => {
    const swordsPath = ref(realtimeDatabase, "swords");
    void runTransaction(swordsPath, (current) => current ?? {
      config: DEFAULT_CONFIG,
      sessions: {},
    });
  }, []);

  useEffect(() => {
    const configPath = ref(realtimeDatabase, "swords/config");
    const unsubscribe = onValue(configPath, (snapshot) => {
      const remote = snapshot.val() as Partial<SwordConfig> | null;
      configRef.current = {
        accelerationThreshold: toNumber(remote?.accelerationThreshold) || DEFAULT_CONFIG.accelerationThreshold,
        cooldownMs: toNumber(remote?.cooldownMs) || DEFAULT_CONFIG.cooldownMs,
        rotationThreshold: toNumber(remote?.rotationThreshold) || DEFAULT_CONFIG.rotationThreshold,
        uploadIntervalMs: toNumber(remote?.uploadIntervalMs) || DEFAULT_CONFIG.uploadIntervalMs,
      };
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;

    function handleOrientation(event: DeviceOrientationEvent) {
      orientationRef.current = {
        alpha: toNumber(event.alpha),
        beta: toNumber(event.beta),
        gamma: toNumber(event.gamma),
      };
    }

    function handleMotion(event: DeviceMotionEvent) {
      const id = sessionIdRef.current;
      if (!id) return;

      // Match the Aerocano shake implementation: use linear acceleration when
      // available and fall back to gravity-inclusive acceleration on iOS.
      let slashAcceleration = event.acceleration;
      if (!slashAcceleration || slashAcceleration.x === null || slashAcceleration.y === null || slashAcceleration.z === null) {
        slashAcceleration = event.accelerationIncludingGravity;
      }
      const linearAcceleration = event.acceleration;
      const gravityAcceleration = event.accelerationIncludingGravity;
      const rotation = event.rotationRate;
      const accelerationX = toNumber(slashAcceleration?.x);
      const accelerationY = toNumber(slashAcceleration?.y);
      const accelerationZ = toNumber(slashAcceleration?.z);
      const rotationAlpha = toNumber(rotation?.alpha);
      const rotationBeta = toNumber(rotation?.beta);
      const rotationGamma = toNumber(rotation?.gamma);
      const accelerationMagnitude = magnitude(accelerationX, accelerationY, accelerationZ);
      const rotationMagnitude = magnitude(rotationAlpha, rotationBeta, rotationGamma);
      const motionTelemetry: SensorTelemetry = {
        acceleration: {
          x: toNumber(linearAcceleration?.x),
          y: toNumber(linearAcceleration?.y),
          z: toNumber(linearAcceleration?.z),
          magnitude: magnitude(
            toNumber(linearAcceleration?.x),
            toNumber(linearAcceleration?.y),
            toNumber(linearAcceleration?.z),
          ),
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
        orientation: orientationRef.current,
        rotation: { alpha: rotationAlpha, beta: rotationBeta, gamma: rotationGamma, magnitude: rotationMagnitude },
      };
      setTelemetry(motionTelemetry);
      const now = Date.now();
      const config = configRef.current;
      const sessionPath = ref(realtimeDatabase, `swords/sessions/${id}`);

      if (
        accelerationMagnitude >= config.accelerationThreshold &&
        rotationMagnitude >= config.rotationThreshold &&
        now - lastSlashRef.current >= config.cooldownMs
      ) {
        lastSlashRef.current = now;
        void runTransaction(ref(realtimeDatabase, `swords/sessions/${id}/slashCount`), (count) => {
          const nextCount = typeof count === "number" ? count + 1 : 1;
          setSlashCount(nextCount);
          return nextCount;
        });
      }

      if (now - lastUploadRef.current < config.uploadIntervalMs) return;
      lastUploadRef.current = now;

      void update(sessionPath, {
        active: true,
        acceleration: motionTelemetry.acceleration,
        accelerationIncludingGravity: motionTelemetry.accelerationIncludingGravity,
        interval: motionTelemetry.interval,
        lastActive: serverTimestamp(),
        orientation: motionTelemetry.orientation,
        rotation: motionTelemetry.rotation,
        slashAcceleration: { x: accelerationX, y: accelerationY, z: accelerationZ, magnitude: accelerationMagnitude },
      });
    }

    window.addEventListener("devicemotion", handleMotion);
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [permission]);

  useEffect(() => {
    if (permission !== "granted") return;

    return onValue(ref(realtimeDatabase, "swords/commands/disconnectAllAt"), (snapshot) => {
      const disconnectedAt = toNumber(snapshot.val());
      if (disconnectedAt > connectionStartedAtRef.current) {
        void stopSensor("All Sword devices were disconnected from the control action.");
      }
    });
  }, [permission]);

  async function createSession() {
    const storedId = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    const id = sessionIdRef.current ?? storedId ?? newSessionId();
    const sessionPath = ref(realtimeDatabase, `swords/sessions/${id}`);

    try {
      const existingSession = (await get(sessionPath)).val() as { slashCount?: number } | null;
      await update(sessionPath, {
        active: true,
        connectedAtClient: Date.now(),
        lastActive: serverTimestamp(),
        ...(existingSession ? {} : { createdAt: serverTimestamp(), slashCount: 0 }),
      });
      await onDisconnect(sessionPath).update({ active: false, lastActive: serverTimestamp() });

      sessionIdRef.current = id;
      connectionStartedAtRef.current = Date.now();
      window.localStorage.setItem(DEVICE_STORAGE_KEY, id);
      setSessionId(id);
      setSlashCount(toNumber(existingSession?.slashCount));
      setStatus("Live. Swing your phone to register a slash.");
    } catch {
      setPermission("denied");
      setStatus("Motion permission was granted, but the live Firebase session could not be created.");
    }
  }

  // This intentionally remains synchronous until requestPermission is called.
  // iOS Safari rejects motion permission requests that lose the button gesture context.
  function activateSensor() {
    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") {
      setPermission("unsupported");
      setStatus("This browser does not provide phone motion-sensor data.");
      return;
    }

    type PermissionMotionEvent = typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    const motionEvent = DeviceMotionEvent as PermissionMotionEvent;

    if (typeof motionEvent.requestPermission === "function") {
      try {
        motionEvent.requestPermission()
          .then((result) => {
            if (result !== "granted") {
              setPermission("denied");
              setStatus("Motion-sensor permission was not granted. Enable Motion & Orientation Access in your browser settings.");
              return;
            }

            connectionStartedAtRef.current = Date.now();
            setPermission("granted");
            void createSession();
          })
          .catch(() => {
            setPermission("denied");
            setStatus("The browser could not request motion-sensor permission.");
          });
      } catch {
        setPermission("denied");
        setStatus("The browser blocked the motion-sensor permission request.");
      }
      return;
    }

    connectionStartedAtRef.current = Date.now();
    setPermission("granted");
    void createSession();
  }

  async function stopSensor(message = "Sensor stopped. Your device ID is saved here and can be resumed.") {
    const id = sessionIdRef.current;
    if (!id) return;

    setPermission("stopped");
    setStatus(message);
    const sessionPath = ref(realtimeDatabase, `swords/sessions/${id}`);
    try {
      await update(sessionPath, { active: false, lastActive: serverTimestamp() });
      await onDisconnect(sessionPath).cancel();
    } catch {
      setStatus("Sensor stopped locally, but its inactive status could not be saved to Firebase.");
    }
  }

  async function disconnectAllDevices() {
    const confirmed = window.confirm("Disconnect every Sword device? Their IDs and saved telemetry will remain, but active pages will stop reading motion events.");
    if (!confirmed) return;

    try {
      const sessions = (await get(ref(realtimeDatabase, "swords/sessions"))).val() as Record<string, unknown> | null;
      const updates: Record<string, boolean | number> = { "commands/disconnectAllAt": Date.now() };
      for (const id of Object.keys(sessions ?? {})) {
        updates[`sessions/${id}/active`] = false;
      }
      await update(ref(realtimeDatabase, "swords"), updates);
      setStatus("Disconnect command sent to all Sword devices.");
    } catch {
      setStatus("Unable to send the disconnect-all command to Firebase.");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-xl space-y-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400">Prototype</p>
          <h1 className="mt-2 text-4xl font-black">Sword Sensor</h1>
          <p className="mt-3 text-zinc-400">Your anonymous session is created only after you activate motion sensing.</p>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl shadow-cyan-950/20">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={activateSensor}
              disabled={permission === "granted"}
              className="rounded-xl bg-cyan-400 px-5 py-4 text-base font-black text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {permission === "granted" ? "Sensor active" : sessionId ? "Resume motion sensor" : "Activate motion sensor"}
            </button>
            <button
              type="button"
              onClick={() => void stopSensor()}
              disabled={permission !== "granted"}
              className="rounded-xl border border-zinc-700 px-5 py-4 text-base font-black text-zinc-200 transition hover:border-cyan-300 hover:text-cyan-200 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
            >
              Stop sensor
            </button>
          </div>
          <button
            type="button"
            onClick={disconnectAllDevices}
            className="mt-3 w-full rounded-xl border border-red-400/50 px-5 py-3 text-sm font-black text-red-200 transition hover:bg-red-400 hover:text-zinc-950"
          >
            Disconnect all Sword devices
          </button>
          <p className="mt-4 text-sm text-zinc-300">{status}</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Slash count</p>
            <p className="mt-2 text-5xl font-black text-cyan-300">{slashCount}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Session ID</p>
            <p className="mt-2 break-all font-mono text-xs text-zinc-200">{sessionId ?? "Not activated"}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div>
            <h2 className="text-xl font-black">Live gyro and motion data</h2>
            <p className="mt-1 text-xs text-zinc-500">Values update as your phone emits sensor events. A zero can mean either no movement or that the browser does not expose that sensor.</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TelemetryGroup title="Linear acceleration" unit="m/s²" vector={telemetry.acceleration} axes={["x", "y", "z"]} />
            <TelemetryGroup title="Acceleration incl. gravity" unit="m/s²" vector={telemetry.accelerationIncludingGravity} axes={["x", "y", "z"]} />
            <TelemetryGroup title="Gyroscope rotation rate" unit="°/s" vector={telemetry.rotation} axes={["alpha", "beta", "gamma"]} />
            <TelemetryGroup title="Device orientation" unit="°" vector={telemetry.orientation} axes={["alpha", "beta", "gamma"]} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="Motion interval" value={telemetry.interval} unit="ms" />
            <Metric label="Rotation magnitude" value={telemetry.rotation.magnitude} unit="°/s" />
          </div>
        </section>
      </div>
    </main>
  );
}

function TelemetryGroup({
  title,
  unit,
  vector,
  axes,
}: {
  title: string;
  unit: string;
  vector: SensorVector;
  axes: Array<"x" | "y" | "z" | "alpha" | "beta" | "gamma">;
}) {
  return (
    <div className="rounded-xl bg-zinc-950 p-4">
      <p className="text-xs font-bold text-cyan-300">{title}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {axes.map((axis) => <Metric key={axis} label={axis} value={vector[axis]} unit={unit} />)}
      </div>
      {vector.magnitude !== undefined && <div className="mt-2"><Metric label="Magnitude" value={vector.magnitude} unit={unit} /></div>}
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: number | undefined; unit: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 px-2 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-xs text-zinc-100">{toNumber(value).toFixed(2)}</p>
      <p className="text-[10px] text-zinc-600">{unit}</p>
    </div>
  );
}
