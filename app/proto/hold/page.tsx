"use client";

import { get, onDisconnect, onValue, ref, runTransaction, serverTimestamp, update } from "firebase/database";
import { useEffect, useRef, useState } from "react";

import { realtimeDatabase } from "@/lib/firebase";
import {
  captureMotion,
  captureOrientation,
  capturePointer,
  EMPTY_MOTION,
  finiteNumber,
  getDeviceDetails,
  MotionSnapshot,
  PermissionMotionEvent,
  persistentDeviceId,
  PointerSnapshot,
  Vector3,
} from "@/lib/proto-device";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface HoldSnapshot {
  durationMs: number;
  endMotion: MotionSnapshot;
  endOrientation: Vector3;
  endPointer: PointerSnapshot;
  endedAtClient: number;
  maxPressure: number;
  movementDistance: number;
  sampleCount: number;
  startMotion: MotionSnapshot;
  startOrientation: Vector3;
  startPointer: PointerSnapshot;
  startedAtClient: number;
}

interface WorkingHold {
  lastPointer: PointerSnapshot;
  maxPressure: number;
  movementDistance: number;
  pointerId: number;
  sampleCount: number;
  startMotion: MotionSnapshot;
  startOrientation: Vector3;
  startPointer: PointerSnapshot;
  startedAtClient: number;
}

const DEVICE_STORAGE_KEY = "hold-sensor-device-id";

export default function HoldPrototypePage() {
  const [connection, setConnection] = useState<ConnectionStatus>("disconnected");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [holdCount, setHoldCount] = useState(0);
  const [totalHoldDurationMs, setTotalHoldDurationMs] = useState(0);
  const [holding, setHolding] = useState(false);
  const [liveDurationMs, setLiveDurationMs] = useState(0);
  const [lastHold, setLastHold] = useState<HoldSnapshot | null>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [status, setStatus] = useState("Connect to create or resume this browser's Hold device.");

  const connectionStartedAtRef = useRef(0);
  const deviceIdRef = useRef<string | null>(null);
  const holdingRef = useRef<WorkingHold | null>(null);
  const motionRef = useRef<MotionSnapshot>(EMPTY_MOTION);
  const orientationRef = useRef<Vector3>({});

  useEffect(() => {
    void runTransaction(ref(realtimeDatabase, "holds"), (current) => current ?? { sessions: {} });
  }, []);

  useEffect(() => {
    if (connection !== "connected" || !motionAllowed) return;

    function handleMotion(event: DeviceMotionEvent) {
      motionRef.current = captureMotion(event);
    }

    function handleOrientation(event: DeviceOrientationEvent) {
      orientationRef.current = captureOrientation(event);
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

    const disconnectUnsubscribe = onValue(ref(realtimeDatabase, "holds/commands/disconnectAllAt"), (snapshot) => {
      if (finiteNumber(snapshot.val()) > connectionStartedAtRef.current) {
        const id = deviceIdRef.current;
        holdingRef.current = null;
        setHolding(false);
        setLiveDurationMs(0);
        setMotionAllowed(false);
        setConnection("disconnected");
        setStatus("All Hold devices were disconnected by a shared command.");
        if (id) {
          const sessionPath = ref(realtimeDatabase, `holds/sessions/${id}`);
          void update(sessionPath, { active: false, currentHold: null, lastActive: serverTimestamp() });
          void onDisconnect(sessionPath).cancel();
        }
      }
    });
    const deleteUnsubscribe = onValue(ref(realtimeDatabase, "holds/commands/deleteAllAt"), (snapshot) => {
      if (finiteNumber(snapshot.val()) > connectionStartedAtRef.current) {
        const id = deviceIdRef.current;
        holdingRef.current = null;
        setHolding(false);
        setLiveDurationMs(0);
        setMotionAllowed(false);
        setConnection("disconnected");
        setStatus("All Hold sessions were deleted by a shared command.");
        if (id) void onDisconnect(ref(realtimeDatabase, `holds/sessions/${id}`)).cancel();
      }
    });

    return () => {
      disconnectUnsubscribe();
      deleteUnsubscribe();
    };
  }, [connection]);

  useEffect(() => {
    if (!holding) return;

    const timer = window.setInterval(() => {
      const current = holdingRef.current;
      const id = deviceIdRef.current;
      if (!current || !id) return;

      const durationMs = Date.now() - current.startedAtClient;
      setLiveDurationMs(durationMs);
      void update(ref(realtimeDatabase, `holds/sessions/${id}`), {
        active: true,
        currentHold: {
          durationMs,
          lastPointer: current.lastPointer,
          maxPressure: current.maxPressure,
          motion: motionRef.current,
          movementDistance: current.movementDistance,
          orientation: orientationRef.current,
          sampleCount: current.sampleCount,
          startedAtClient: current.startedAtClient,
        },
        lastActive: serverTimestamp(),
      });
    }, 100);

    return () => window.clearInterval(timer);
  }, [holding]);

  async function beginConnection(canReadMotion: boolean) {
    const id = persistentDeviceId(DEVICE_STORAGE_KEY, "hold");
    const sessionPath = ref(realtimeDatabase, `holds/sessions/${id}`);

    try {
      const existing = (await get(sessionPath)).val() as { holdCount?: number; totalHoldDurationMs?: number } | null;
      const connectedAtClient = Date.now();
      await update(sessionPath, {
        active: true,
        connectedAtClient,
        device: getDeviceDetails(),
        lastActive: serverTimestamp(),
        ...(existing ? {} : { createdAt: serverTimestamp(), holdCount: 0, totalHoldDurationMs: 0 }),
      });
      await onDisconnect(sessionPath).update({ active: false, currentHold: null, lastActive: serverTimestamp() });

      connectionStartedAtRef.current = connectedAtClient;
      deviceIdRef.current = id;
      setDeviceId(id);
      setHoldCount(finiteNumber(existing?.holdCount));
      setTotalHoldDurationMs(finiteNumber(existing?.totalHoldDurationMs));
      setMotionAllowed(canReadMotion);
      setConnection("connected");
      setStatus(canReadMotion ? "Connected with pointer and motion capture." : "Connected with pointer capture, but motion permission is unavailable.");
    } catch {
      setConnection("disconnected");
      setStatus("Unable to create or resume the Hold Firebase session.");
    }
  }

  function connect() {
    if (connection !== "disconnected") return;
    setConnection("connecting");
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

  function stopLocally(message: string) {
    holdingRef.current = null;
    setHolding(false);
    setLiveDurationMs(0);
    setMotionAllowed(false);
    setConnection("disconnected");
    setStatus(message);
  }

  async function disconnect(message = "Disconnected while keeping this browser's Hold device ID.") {
    const id = deviceIdRef.current;
    if (!id) return;
    stopLocally(message);

    try {
      const sessionPath = ref(realtimeDatabase, `holds/sessions/${id}`);
      await update(sessionPath, { active: false, currentHold: null, lastActive: serverTimestamp() });
      await onDisconnect(sessionPath).cancel();
    } catch {
      setStatus("Disconnected locally, but Firebase could not save the inactive state.");
    }
  }

  function startHold(event: React.PointerEvent<HTMLButtonElement>) {
    const id = deviceIdRef.current;
    if (!id || connection !== "connected" || holdingRef.current) return;

    const pointer = capturePointer(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    holdingRef.current = {
      lastPointer: pointer,
      maxPressure: pointer.pressure,
      movementDistance: 0,
      pointerId: event.pointerId,
      sampleCount: 1,
      startMotion: motionRef.current,
      startOrientation: orientationRef.current,
      startPointer: pointer,
      startedAtClient: Date.now(),
    };
    setLiveDurationMs(0);
    setHolding(true);
  }

  function moveHold(event: React.PointerEvent<HTMLButtonElement>) {
    const current = holdingRef.current;
    if (!current || event.pointerId !== current.pointerId) return;

    const pointer = capturePointer(event);
    const deltaX = pointer.clientX - current.lastPointer.clientX;
    const deltaY = pointer.clientY - current.lastPointer.clientY;
    current.movementDistance += Math.sqrt(deltaX ** 2 + deltaY ** 2);
    current.lastPointer = pointer;
    current.maxPressure = Math.max(current.maxPressure, pointer.pressure);
    current.sampleCount += 1;
  }

  function finishHold(event: React.PointerEvent<HTMLButtonElement>) {
    const current = holdingRef.current;
    const id = deviceIdRef.current;
    if (!current || !id || event.pointerId !== current.pointerId) return;

    const endedAtClient = Date.now();
    const durationMs = Math.max(0, endedAtClient - current.startedAtClient);
    const snapshot: HoldSnapshot = {
      durationMs,
      endMotion: motionRef.current,
      endOrientation: orientationRef.current,
      endPointer: capturePointer(event),
      endedAtClient,
      maxPressure: current.maxPressure,
      movementDistance: current.movementDistance,
      sampleCount: current.sampleCount,
      startMotion: current.startMotion,
      startOrientation: current.startOrientation,
      startPointer: current.startPointer,
      startedAtClient: current.startedAtClient,
    };

    holdingRef.current = null;
    setHolding(false);
    setLiveDurationMs(durationMs);
    setLastHold(snapshot);
    void runTransaction(ref(realtimeDatabase, `holds/sessions/${id}/holdCount`), (count) => {
      const nextCount = finiteNumber(count) + 1;
      setHoldCount(nextCount);
      return nextCount;
    });
    void runTransaction(ref(realtimeDatabase, `holds/sessions/${id}/totalHoldDurationMs`), (total) => {
      const nextTotal = finiteNumber(total) + durationMs;
      setTotalHoldDurationMs(nextTotal);
      return nextTotal;
    });
    void update(ref(realtimeDatabase, `holds/sessions/${id}`), {
      active: true,
      currentHold: null,
      lastActive: serverTimestamp(),
      lastHold: { ...snapshot, recordedAt: serverTimestamp() },
    });
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400">Prototype</p>
          <h1 className="mt-2 text-4xl font-black">Hold Sensor</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">Press and hold the target to measure duration, pointer movement, pressure, and phone motion.</p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={connect} disabled={connection !== "disconnected"} className="rounded-xl bg-cyan-400 px-5 py-4 font-black text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">{connection === "connected" ? "Hold connected" : connection === "connecting" ? "Connecting…" : "Connect Hold"}</button>
            <button type="button" onClick={() => void disconnect()} disabled={connection !== "connected"} className="rounded-xl border border-zinc-700 px-5 py-4 font-black text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-600">Disconnect Hold</button>
          </div>
          <p className="mt-4 text-sm text-zinc-300">{status}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-[1fr_280px]">
          <button
            type="button"
            onPointerDown={startHold}
            onPointerMove={moveHold}
            onPointerUp={finishHold}
            onPointerCancel={finishHold}
            disabled={connection !== "connected"}
            className={`touch-none select-none rounded-3xl border p-10 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${holding ? "border-cyan-200 bg-cyan-400/25 shadow-2xl shadow-cyan-500/20" : "border-cyan-400/50 bg-gradient-to-br from-cyan-500/20 to-zinc-900"}`}
          >
            <span className="text-6xl">✋</span>
            <span className="mt-5 block text-2xl font-black">{holding ? "Keep holding…" : "Press and hold here"}</span>
            <span className="mt-2 block text-sm text-zinc-300">Move or press harder while holding to capture richer pointer data.</span>
          </button>
          <div className="space-y-3">
            <Stat label="Current hold" value={`${(liveDurationMs / 1000).toFixed(2)} s`} />
            <Stat label="Completed holds" value={holdCount} />
            <Stat label="Total hold time" value={`${(totalHoldDurationMs / 1000).toFixed(2)} s`} />
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-xl font-black">Latest completed hold</h2>
          <p className="mt-2 break-all font-mono text-xs text-cyan-300">{deviceId ?? "No device ID yet"}</p>
          {lastHold ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Duration" value={`${lastHold.durationMs} ms`} />
              <Stat label="Pointer samples" value={lastHold.sampleCount} />
              <Stat label="Movement distance" value={`${lastHold.movementDistance.toFixed(2)} px`} />
              <Stat label="Maximum pressure" value={lastHold.maxPressure.toFixed(3)} />
              <Stat label="Start X / Y" value={`${lastHold.startPointer.offsetX.toFixed(1)} / ${lastHold.startPointer.offsetY.toFixed(1)}`} />
              <Stat label="End X / Y" value={`${lastHold.endPointer.offsetX.toFixed(1)} / ${lastHold.endPointer.offsetY.toFixed(1)}`} />
              <Stat label="Start rotation" value={finiteNumber(lastHold.startMotion.rotation.magnitude).toFixed(2)} />
              <Stat label="End rotation" value={finiteNumber(lastHold.endMotion.rotation.magnitude).toFixed(2)} />
            </div>
          ) : <p className="mt-5 text-sm text-zinc-500">Complete a hold to see its data here.</p>}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-2 break-all font-mono text-lg font-bold text-cyan-200">{value}</p></div>;
}
