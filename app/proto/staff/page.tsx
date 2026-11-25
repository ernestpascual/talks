"use client";

import { get, onDisconnect, onValue, ref, runTransaction, serverTimestamp, update } from "firebase/database";
import { useEffect, useRef, useState } from "react";

import { realtimeDatabase } from "@/lib/firebase";
import {
  captureMotion,
  captureOrientation,
  EMPTY_MOTION,
  finiteNumber,
  getDeviceDetails,
  MotionSnapshot,
  PermissionMotionEvent,
  persistentDeviceId,
  Vector3,
} from "@/lib/proto-device";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface StaffConfig {
  idleResetMs: number;
  rotationThreshold: number;
  spinDegrees: number;
  uploadIntervalMs: number;
}

const DEFAULT_CONFIG: StaffConfig = {
  idleResetMs: 500,
  rotationThreshold: 180,
  spinDegrees: 360,
  uploadIntervalMs: 100,
};

const DEVICE_STORAGE_KEY = "staff-sensor-device-id";

export default function StaffPrototypePage() {
  const [config, setConfig] = useState<StaffConfig>(DEFAULT_CONFIG);
  const [connection, setConnection] = useState<ConnectionStatus>("disconnected");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [motion, setMotion] = useState<MotionSnapshot>(EMPTY_MOTION);
  const [orientation, setOrientation] = useState<Vector3>({});
  const [spinCount, setSpinCount] = useState(0);
  const [spinProgress, setSpinProgress] = useState(0);
  const [dominantAxis, setDominantAxis] = useState("none");
  const [angularSpeed, setAngularSpeed] = useState(0);
  const [status, setStatus] = useState("Connect and activate motion sensing to track Staff spins.");

  const configRef = useRef<StaffConfig>(DEFAULT_CONFIG);
  const connectionStartedAtRef = useRef(0);
  const deviceIdRef = useRef<string | null>(null);
  const lastEventAtRef = useRef(0);
  const lastFastRotationAtRef = useRef(0);
  const lastUploadAtRef = useRef(0);
  const orientationRef = useRef<Vector3>({});
  const spinProgressRef = useRef(0);

  useEffect(() => {
    void runTransaction(ref(realtimeDatabase, "staffs"), (current) => current ?? { config: DEFAULT_CONFIG, sessions: {} });
    return onValue(ref(realtimeDatabase, "staffs/config"), (snapshot) => {
      const remote = snapshot.val() as Partial<StaffConfig> | null;
      const nextConfig = {
        idleResetMs: finiteNumber(remote?.idleResetMs) || DEFAULT_CONFIG.idleResetMs,
        rotationThreshold: finiteNumber(remote?.rotationThreshold) || DEFAULT_CONFIG.rotationThreshold,
        spinDegrees: finiteNumber(remote?.spinDegrees) || DEFAULT_CONFIG.spinDegrees,
        uploadIntervalMs: finiteNumber(remote?.uploadIntervalMs) || DEFAULT_CONFIG.uploadIntervalMs,
      };
      configRef.current = nextConfig;
      setConfig(nextConfig);
    });
  }, []);

  useEffect(() => {
    if (!deviceId) return;
    const countUnsubscribe = onValue(ref(realtimeDatabase, `staffs/sessions/${deviceId}/spinCount`), (snapshot) => {
      setSpinCount(finiteNumber(snapshot.val()));
    });
    const progressUnsubscribe = onValue(ref(realtimeDatabase, `staffs/sessions/${deviceId}/spinProgressDegrees`), (snapshot) => {
      const progress = finiteNumber(snapshot.val());
      spinProgressRef.current = progress;
      setSpinProgress(progress);
    });
    return () => {
      countUnsubscribe();
      progressUnsubscribe();
    };
  }, [deviceId]);

  useEffect(() => {
    if (connection !== "connected" || !motionAllowed) return;

    function handleOrientation(event: DeviceOrientationEvent) {
      const next = captureOrientation(event);
      orientationRef.current = next;
      setOrientation(next);
    }

    function handleMotion(event: DeviceMotionEvent) {
      const id = deviceIdRef.current;
      if (!id) return;

      const snapshot = captureMotion(event);
      const now = Date.now();
      const rates = {
        alpha: Math.abs(finiteNumber(snapshot.rotation.alpha)),
        beta: Math.abs(finiteNumber(snapshot.rotation.beta)),
        gamma: Math.abs(finiteNumber(snapshot.rotation.gamma)),
      };
      const [axis, speed] = Object.entries(rates).sort(([, a], [, b]) => b - a)[0];
      const elapsedSeconds = Math.min(0.1, Math.max(0.005, (now - (lastEventAtRef.current || now - 16)) / 1000));
      lastEventAtRef.current = now;
      const config = configRef.current;
      let progress = spinProgressRef.current;

      if (speed >= config.rotationThreshold) {
        progress += speed * elapsedSeconds;
        lastFastRotationAtRef.current = now;
        if (progress >= config.spinDegrees) {
          const completedSpins = Math.floor(progress / config.spinDegrees);
          progress %= config.spinDegrees;
          void runTransaction(ref(realtimeDatabase, `staffs/sessions/${id}/spinCount`), (count) => finiteNumber(count) + completedSpins);
        }
      } else if (now - lastFastRotationAtRef.current >= config.idleResetMs) {
        progress = 0;
      }

      spinProgressRef.current = progress;
      setMotion(snapshot);
      setDominantAxis(axis);
      setAngularSpeed(speed);
      setSpinProgress(progress);

      if (now - lastUploadAtRef.current < config.uploadIntervalMs) return;
      lastUploadAtRef.current = now;
      void update(ref(realtimeDatabase, `staffs/sessions/${id}`), {
        acceleration: snapshot.acceleration,
        accelerationIncludingGravity: snapshot.accelerationIncludingGravity,
        active: true,
        angularSpeed: speed,
        dominantAxis: axis,
        interval: snapshot.interval,
        lastActive: serverTimestamp(),
        orientation: orientationRef.current,
        rotation: snapshot.rotation,
        spinProgressDegrees: progress,
      });
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
    const disconnectUnsubscribe = onValue(ref(realtimeDatabase, "staffs/commands/disconnectAllAt"), (snapshot) => {
      if (finiteNumber(snapshot.val()) > connectionStartedAtRef.current) {
        const id = deviceIdRef.current;
        setConnection("disconnected");
        setMotionAllowed(false);
        setStatus("All Staff devices were disconnected by the control dashboard.");
        if (id) {
          const sessionPath = ref(realtimeDatabase, `staffs/sessions/${id}`);
          void update(sessionPath, { active: false, lastActive: serverTimestamp() });
          void onDisconnect(sessionPath).cancel();
        }
      }
    });
    const deleteUnsubscribe = onValue(ref(realtimeDatabase, "staffs/commands/deleteAllAt"), (snapshot) => {
      if (finiteNumber(snapshot.val()) > connectionStartedAtRef.current) {
        const id = deviceIdRef.current;
        setConnection("disconnected");
        setMotionAllowed(false);
        setStatus("All Staff sessions were deleted by the control dashboard.");
        if (id) void onDisconnect(ref(realtimeDatabase, `staffs/sessions/${id}`)).cancel();
      }
    });
    return () => {
      disconnectUnsubscribe();
      deleteUnsubscribe();
    };
  }, [connection]);

  async function beginConnection(canReadMotion: boolean) {
    const id = persistentDeviceId(DEVICE_STORAGE_KEY, "staff");
    const sessionPath = ref(realtimeDatabase, `staffs/sessions/${id}`);
    try {
      const existing = (await get(sessionPath)).val() as { spinCount?: number } | null;
      const connectedAtClient = Date.now();
      await update(sessionPath, {
        active: true,
        connectedAtClient,
        device: getDeviceDetails(),
        lastActive: serverTimestamp(),
        ...(existing ? {} : { createdAt: serverTimestamp(), spinCount: 0 }),
      });
      await onDisconnect(sessionPath).update({ active: false, lastActive: serverTimestamp() });

      connectionStartedAtRef.current = connectedAtClient;
      deviceIdRef.current = id;
      setDeviceId(id);
      setSpinCount(finiteNumber(existing?.spinCount));
      setMotionAllowed(canReadMotion);
      setConnection("connected");
      setStatus(canReadMotion ? "Connected and tracking Staff rotation." : "Connected, but this browser did not grant motion-sensor access.");
    } catch {
      setConnection("disconnected");
      setStatus("Unable to create or resume the Staff Firebase session.");
    }
  }

  function connect() {
    if (connection !== "disconnected") return;
    setConnection("connecting");
    const motionEvent = window.DeviceMotionEvent as PermissionMotionEvent | undefined;
    if (motionEvent && typeof motionEvent.requestPermission === "function") {
      try {
        motionEvent.requestPermission().then((result) => void beginConnection(result === "granted")).catch(() => void beginConnection(false));
      } catch {
        void beginConnection(false);
      }
      return;
    }
    void beginConnection(Boolean(motionEvent));
  }

  function stopLocally(message: string) {
    setConnection("disconnected");
    setMotionAllowed(false);
    setStatus(message);
  }

  async function disconnect(message = "Staff sensor disconnected while keeping this browser's device ID.") {
    const id = deviceIdRef.current;
    if (!id) return;
    stopLocally(message);
    try {
      const sessionPath = ref(realtimeDatabase, `staffs/sessions/${id}`);
      await update(sessionPath, { active: false, lastActive: serverTimestamp() });
      await onDisconnect(sessionPath).cancel();
    } catch {
      setStatus("Disconnected locally, but Firebase could not save the inactive state.");
    }
  }

  const progressPercent = Math.min(100, (spinProgress / config.spinDegrees) * 100);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-violet-400">Prototype</p>
          <h1 className="mt-2 text-4xl font-black">Staff Spin Sensor</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">Rotate the phone like a staff and each accumulated full rotation counts as one spin.</p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={connect} disabled={connection !== "disconnected"} className="rounded-xl bg-violet-400 px-5 py-4 font-black text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">{connection === "connected" ? "Staff connected" : connection === "connecting" ? "Connecting…" : "Connect Staff"}</button>
            <button type="button" onClick={() => void disconnect()} disabled={connection !== "connected"} className="rounded-xl border border-zinc-700 px-5 py-4 font-black text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-600">Disconnect Staff</button>
          </div>
          <p className="mt-4 text-sm text-zinc-300">{status}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Stat label="Spin count" value={spinCount} />
          <Stat label="Dominant axis" value={dominantAxis} />
          <Stat label="Angular speed" value={`${angularSpeed.toFixed(1)} °/s`} />
        </section>

        <section className="rounded-2xl border border-violet-400/30 bg-violet-400/5 p-5">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-zinc-500">Current spin progress</p><p className="mt-1 text-3xl font-black text-violet-200">{spinProgress.toFixed(1)}° / {config.spinDegrees}°</p></div><p className="text-sm text-zinc-400">{progressPercent.toFixed(0)}%</p></div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-violet-400 transition-[width]" style={{ width: `${progressPercent}%` }} /></div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-xl font-black">Live trackable data</h2>
          <p className="mt-2 break-all font-mono text-xs text-violet-300">{deviceId ?? "No device ID yet"}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <VectorPanel title="Linear acceleration" vector={motion.acceleration} />
            <VectorPanel title="Acceleration including gravity" vector={motion.accelerationIncludingGravity} />
            <VectorPanel title="Gyroscope rotation rate" vector={motion.rotation} />
            <VectorPanel title="Device orientation" vector={orientation} />
          </div>
          <div className="mt-4"><Stat label="Motion interval" value={`${motion.interval.toFixed(2)} ms`} /></div>
        </section>
      </div>
    </main>
  );
}

function VectorPanel({ title, vector }: { title: string; vector: Vector3 }) {
  return <div className="rounded-xl bg-zinc-950 p-4"><h3 className="text-sm font-bold text-violet-300">{title}</h3><div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(vector).map(([key, value]) => <Stat key={key} label={key} value={finiteNumber(value).toFixed(2)} compact />)}</div></div>;
}

function Stat({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return <div className={`rounded-xl border border-zinc-800 bg-zinc-900 ${compact ? "p-3" : "p-5"}`}><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className={`${compact ? "text-base" : "text-3xl"} mt-2 break-all font-black text-violet-200`}>{value}</p></div>;
}
