"use client";

import { get, onDisconnect, onValue, ref, runTransaction, serverTimestamp, update } from "firebase/database";
import { useEffect, useRef, useState } from "react";

import { realtimeDatabase } from "@/lib/firebase";
import {
  captureMotion,
  captureOrientation,
  finiteNumber,
  type PermissionMotionEvent,
  persistentDeviceId,
  type Vector3,
} from "@/lib/proto-device";

type ConnectionState = "disconnected" | "connecting" | "connected" | "unsupported";

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

const DEVICE_STORAGE_KEY = "sword-2-sensor-device-id";

function swordTransform(orientation: Vector3) {
  const alpha = finiteNumber(orientation.alpha);
  const beta = Math.max(-90, Math.min(90, finiteNumber(orientation.beta)));
  const gamma = Math.max(-90, Math.min(90, finiteNumber(orientation.gamma)));
  return `rotateZ(${-alpha}deg) rotateX(${beta - 25}deg) rotateY(${gamma}deg)`;
}

export default function SwordTwoPage() {
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [orientation, setOrientation] = useState<Vector3>({ alpha: 0, beta: 25, gamma: 0 });
  const [status, setStatus] = useState("Connect to animate the sword and stream its motion.");

  const configRef = useRef(DEFAULT_CONFIG);
  const sessionIdRef = useRef<string | null>(null);
  const connectionStartedAtRef = useRef(0);
  const lastSlashRef = useRef(0);
  const lastUploadRef = useRef(0);
  const orientationRef = useRef<Vector3>({});

  useEffect(() => {
    void runTransaction(ref(realtimeDatabase, "swords"), (current) => current ?? {
      config: DEFAULT_CONFIG,
      sessions: {},
    });

    return onValue(ref(realtimeDatabase, "swords/config"), (snapshot) => {
      const remote = snapshot.val() as Partial<SwordConfig> | null;
      configRef.current = {
        accelerationThreshold: finiteNumber(remote?.accelerationThreshold) || DEFAULT_CONFIG.accelerationThreshold,
        cooldownMs: finiteNumber(remote?.cooldownMs) || DEFAULT_CONFIG.cooldownMs,
        rotationThreshold: finiteNumber(remote?.rotationThreshold) || DEFAULT_CONFIG.rotationThreshold,
        uploadIntervalMs: finiteNumber(remote?.uploadIntervalMs) || DEFAULT_CONFIG.uploadIntervalMs,
      };
    });
  }, []);

  useEffect(() => {
    if (connection !== "connected") return;

    function handleOrientation(event: DeviceOrientationEvent) {
      const nextOrientation = captureOrientation(event);
      orientationRef.current = nextOrientation;
      setOrientation(nextOrientation);
    }

    function handleMotion(event: DeviceMotionEvent) {
      const id = sessionIdRef.current;
      if (!id) return;

      const motion = captureMotion(event);
      const detectionAcceleration = motion.acceleration.magnitude
        ? motion.acceleration
        : motion.accelerationIncludingGravity;
      const now = Date.now();
      const config = configRef.current;

      if (
        finiteNumber(detectionAcceleration.magnitude) >= config.accelerationThreshold &&
        finiteNumber(motion.rotation.magnitude) >= config.rotationThreshold &&
        now - lastSlashRef.current >= config.cooldownMs
      ) {
        lastSlashRef.current = now;
        void runTransaction(ref(realtimeDatabase, `swords/sessions/${id}/slashCount`), (count) =>
          typeof count === "number" ? count + 1 : 1,
        );
      }

      if (now - lastUploadRef.current < config.uploadIntervalMs) return;
      lastUploadRef.current = now;

      void update(ref(realtimeDatabase, `swords/sessions/${id}`), {
        acceleration: motion.acceleration,
        accelerationIncludingGravity: motion.accelerationIncludingGravity,
        active: true,
        experience: "sword-2",
        interval: motion.interval,
        lastActive: serverTimestamp(),
        orientation: orientationRef.current,
        rotation: motion.rotation,
        slashAcceleration: detectionAcceleration,
      });
    }

    window.addEventListener("deviceorientation", handleOrientation);
    window.addEventListener("devicemotion", handleMotion);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
    };
  }, [connection]);

  useEffect(() => {
    if (connection !== "connected") return;

    return onValue(ref(realtimeDatabase, "swords/commands/disconnectAllAt"), (snapshot) => {
      const disconnectedAt = finiteNumber(snapshot.val());
      if (disconnectedAt > connectionStartedAtRef.current) {
        void disconnect("Disconnected by Sword Control.");
      }
    });
  }, [connection]);

  async function startSession() {
    const id = persistentDeviceId(DEVICE_STORAGE_KEY, "sword-2");
    const sessionPath = ref(realtimeDatabase, `swords/sessions/${id}`);
    const existing = (await get(sessionPath)).val() as { slashCount?: number } | null;

    await update(sessionPath, {
      active: true,
      connectedAtClient: Date.now(),
      experience: "sword-2",
      lastActive: serverTimestamp(),
      ...(existing ? {} : { createdAt: serverTimestamp(), slashCount: 0 }),
    });
    await onDisconnect(sessionPath).update({ active: false, lastActive: serverTimestamp() });

    sessionIdRef.current = id;
    connectionStartedAtRef.current = Date.now();
    setConnection("connected");
    setStatus("Connected. Move your phone to wield the sword.");
  }

  async function connect() {
    if (typeof DeviceMotionEvent === "undefined" || typeof DeviceOrientationEvent === "undefined") {
      setConnection("unsupported");
      setStatus("This browser does not expose phone motion and orientation sensors.");
      return;
    }

    setConnection("connecting");
    setStatus("Requesting motion access…");

    try {
      const motionEvent = DeviceMotionEvent as PermissionMotionEvent;
      const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<PermissionState>;
      };
      const permissionRequests: Array<Promise<PermissionState>> = [];

      if (typeof motionEvent.requestPermission === "function") {
        permissionRequests.push(motionEvent.requestPermission());
      }
      if (typeof orientationEvent.requestPermission === "function") {
        permissionRequests.push(orientationEvent.requestPermission());
      }

      const permissions = await Promise.all(permissionRequests);
      if (permissions.some((permission) => permission !== "granted")) {
        setConnection("disconnected");
        setStatus("Motion access was not granted; enable Motion & Orientation Access and try again.");
        return;
      }

      await startSession();
    } catch {
      setConnection("disconnected");
      setStatus("The browser or Firebase could not complete the connection.");
    }
  }

  async function disconnect(message = "Disconnected. This device ID is saved for the next connection.") {
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setConnection("disconnected");
    setStatus(message);

    if (!id) return;
    try {
      const sessionPath = ref(realtimeDatabase, `swords/sessions/${id}`);
      await update(sessionPath, { active: false, lastActive: serverTimestamp() });
      await onDisconnect(sessionPath).cancel();
    } catch {
      setStatus("Disconnected locally, but Firebase could not save the inactive status.");
    }
  }

  const isConnected = connection === "connected";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#172554_0%,#09090b_55%,#000_100%)] px-6 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(34,211,238,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center">
        <div className="mb-5 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300">Sword 2</p>
          <h1 className="mt-2 text-4xl font-black">Motion Blade</h1>
        </div>

        <div className="relative flex h-[60vh] min-h-[420px] w-full items-center justify-center [perspective:900px]">
          <div
            className={`relative h-[390px] w-24 origin-[50%_82%] transition-transform ${isConnected ? "duration-75" : "duration-700"}`}
            style={{ transform: isConnected ? swordTransform(orientation) : "rotateZ(-18deg) rotateX(-16deg) rotateY(22deg)", transformStyle: "preserve-3d" }}
          >
            <div className="absolute left-1/2 top-0 h-[268px] w-14 -translate-x-1/2 bg-gradient-to-r from-cyan-950 via-white to-cyan-300 shadow-[0_0_24px_rgba(34,211,238,.65)] [clip-path:polygon(50%_0,100%_14%,78%_100%,22%_100%,0_14%)]">
              <div className="absolute inset-y-5 left-1/2 w-px -translate-x-1/2 bg-cyan-700/50" />
              <div className="absolute inset-y-9 left-3 w-1 bg-white/70 blur-[1px]" />
            </div>
            <div className="absolute left-1/2 top-[260px] h-5 w-24 -translate-x-1/2 rounded-full border border-cyan-200 bg-gradient-to-b from-cyan-100 via-slate-500 to-slate-950 shadow-[0_0_16px_rgba(34,211,238,.45)]" />
            <div className="absolute left-1/2 top-[274px] h-28 w-7 -translate-x-1/2 rounded-b-xl border border-slate-500 bg-[repeating-linear-gradient(135deg,#18181b_0px,#18181b_8px,#52525b_9px,#52525b_12px)] shadow-xl" />
            <div className="absolute left-1/2 top-[377px] h-7 w-10 -translate-x-1/2 rounded-full border border-cyan-200 bg-slate-700 shadow-[0_0_12px_rgba(34,211,238,.4)]" />
          </div>
          {isConnected && <div className="absolute bottom-6 h-8 w-52 rounded-[50%] bg-cyan-400/20 blur-xl" />}
        </div>

        <button
          type="button"
          disabled={connection === "connecting" || connection === "unsupported"}
          onClick={() => isConnected ? void disconnect() : void connect()}
          className={`w-full rounded-2xl px-6 py-4 text-lg font-black transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 ${isConnected ? "border border-red-400/60 bg-red-400/10 text-red-200 hover:bg-red-400 hover:text-zinc-950" : "bg-cyan-300 text-zinc-950 shadow-[0_0_30px_rgba(34,211,238,.25)] hover:bg-cyan-200"}`}
        >
          {connection === "connecting" ? "Connecting…" : isConnected ? "Disconnect" : "Connect"}
        </button>
        <p className="mt-3 min-h-10 text-center text-sm text-zinc-400" aria-live="polite">{status}</p>
      </div>
    </main>
  );
}
