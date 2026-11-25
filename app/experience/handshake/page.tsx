"use client";

import { useEffect, useRef, useState } from "react";

import DmapFrame from "@/app/experience/dmap/DmapFrame";
import DmapSuccess from "@/app/experience/dmap/DmapSuccess";
import { useDmapConfig } from "@/app/experience/dmap/useDmapConfig";
import { finiteNumber, vectorMagnitude, type PermissionMotionEvent } from "@/lib/proto-device";

export default function HandshakePage() {
  const config = useDmapConfig().handshake;
  const [bottomHeld, setBottomHeld] = useState(false);
  const [count, setCount] = useState(0);
  const [intensity, setIntensity] = useState(0);
  const [sensorActive, setSensorActive] = useState(false);
  const [status, setStatus] = useState("MOTION SENSORS STANDBY");
  const [topHeld, setTopHeld] = useState(false);
  const bottomHeldRef = useRef(false);
  const topHeldRef = useRef(false);
  const activatingRef = useRef(false);
  const countRef = useRef(0);
  const lastPrimaryRef = useRef(0);
  const baselineGravityRef = useRef(9.8);
  const lastShakeAtRef = useRef(0);

  const bothHeld = topHeld && bottomHeld;
  const complete = count >= config.targetShakes;

  useEffect(() => {
    if (!sensorActive || complete) return;

    function onMotion(event: DeviceMotionEvent) {
      const linear = event.acceleration;
      const gravity = event.accelerationIncludingGravity;
      const rotation = event.rotationRate;
      const linearMagnitude = vectorMagnitude(finiteNumber(linear?.x), finiteNumber(linear?.y), finiteNumber(linear?.z));
      const gravityMagnitude = vectorMagnitude(finiteNumber(gravity?.x), finiteNumber(gravity?.y), finiteNumber(gravity?.z));
      baselineGravityRef.current = baselineGravityRef.current * 0.88 + gravityMagnitude * 0.12;
      const gravityDeviation = Math.abs(gravityMagnitude - baselineGravityRef.current);
      const rotationMagnitude = vectorMagnitude(finiteNumber(rotation?.alpha), finiteNumber(rotation?.beta), finiteNumber(rotation?.gamma));
      const rotationEquivalent = rotationMagnitude / Math.max(1, config.rotationDivisor);
      const primary = Math.max(linearMagnitude, gravityDeviation);
      const jerk = Math.abs(primary - lastPrimaryRef.current) * config.jerkMultiplier;
      lastPrimaryRef.current = primary;
      const nextIntensity = Math.max(linearMagnitude, gravityDeviation, rotationEquivalent, jerk);
      setIntensity(nextIntensity);

      if (nextIntensity < config.shakeThreshold || Date.now() - lastShakeAtRef.current <= config.debounceMs) return;
      if (!topHeldRef.current || !bottomHeldRef.current) {
        setStatus("GRIP BOTH ENDS TO COUNT SHAKES");
        return;
      }

      lastShakeAtRef.current = Date.now();
      const next = Math.min(config.targetShakes, countRef.current + 1);
      countRef.current = next;
      setCount(next);
      navigator.vibrate?.(60);
      if (next >= config.targetShakes) {
        setStatus("✓ CONNECTION SUCCESSFUL! ALLIANCE SYNCHRONIZED!");
        navigator.vibrate?.([80, 60, 120]);
      } else {
        setStatus(`SHAKE ${next} OF ${config.targetShakes} CONFIRMED! KEEP SHAKING TOGETHER...`);
      }
    }

    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [complete, config, sensorActive]);

  async function activateSensor() {
    if (sensorActive || activatingRef.current) return;
    if (typeof DeviceMotionEvent === "undefined") {
      setStatus("THIS DEVICE DOES NOT EXPOSE MOTION SENSOR DATA");
      return;
    }
    activatingRef.current = true;
    try {
      const motionEvent = DeviceMotionEvent as PermissionMotionEvent;
      if (typeof motionEvent.requestPermission === "function") {
        const permission = await motionEvent.requestPermission();
        if (permission !== "granted") {
          setStatus("MOTION SENSOR PERMISSION DENIED");
          return;
        }
      }
      countRef.current = 0;
      setCount(0);
      setSensorActive(true);
      setStatus(topHeldRef.current && bottomHeldRef.current ? "BOTH PARTNERS LOCKED — SHAKE TOGETHER" : "KINETIC SENSOR ONLINE — GRIP BOTH ENDS");
    } catch {
      setStatus("MOTION SENSOR COULD NOT BE ACTIVATED");
    } finally {
      activatingRef.current = false;
    }
  }

  function setGrip(which: "top" | "bottom", held: boolean) {
    if (which === "top") {
      topHeldRef.current = held;
      setTopHeld(held);
    } else {
      bottomHeldRef.current = held;
      setBottomHeld(held);
    }
    if (held && !sensorActive) void activateSensor();
    if (held && sensorActive) {
      const willHaveBothGrips = which === "top" ? bottomHeldRef.current : topHeldRef.current;
      setStatus(willHaveBothGrips ? "BOTH PARTNERS LOCKED — SHAKE TOGETHER" : "WAITING FOR THE OTHER PARTNER TO GRIP THEIR END");
    }
  }

  function resetActivity() {
    countRef.current = 0;
    lastPrimaryRef.current = 0;
    lastShakeAtRef.current = 0;
    setCount(0);
    setIntensity(0);
    setTopHeld(false);
    setBottomHeld(false);
    topHeldRef.current = false;
    bottomHeldRef.current = false;
    setStatus(sensorActive ? "KINETIC SENSOR ONLINE — GRIP BOTH ENDS" : "MOTION SENSORS STANDBY");
  }

  return (
    <DmapFrame accent="#FEE715" icon="🤝" title="Kinetic Handshake" subtitle="Gyroscope and motion synchronization">
      {complete && <DmapSuccess message={`${config.targetShakes} synchronized motion strokes completed the kinetic handshake protocol.`} onRunAgain={resetActivity} />}
      <GripPad color="#FF007B" held={topHeld} label="Partner 1" onHeld={(held) => setGrip("top", held)} rotated />

      <section className="my-3 rounded-2xl border-2 border-[#FEE715]/40 bg-black/70 p-3 text-center">
        <div className="flex items-center justify-between font-mono text-[10px] text-white/60"><span>MOTION INTENSITY</span><span className="font-bold text-[#FEE715]">{intensity.toFixed(1)} m/s²</span></div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-emerald-400 via-[#FEE715] to-[#FF0055] transition-all duration-100" style={{ width: `${Math.min(100, intensity / Math.max(0.1, config.shakeThreshold * 2) * 100)}%` }} /></div>
        <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(config.targetShakes, 10)}, minmax(0, 1fr))` }}>
          {Array.from({ length: Math.min(config.targetShakes, 10) }, (_, index) => index + 1).map((number) => <div key={number} className={`rounded-xl border-2 py-2 font-mono text-sm font-bold ${count >= number ? "border-emerald-400 text-emerald-400" : "animate-pulse border-[#FEE715] text-[#FEE715]"}`}>{count >= number ? "✓" : number}<span className="block text-[7px]">SHAKE</span></div>)}
        </div>
        <p className={`mt-3 font-mono text-[10px] font-bold ${complete ? "text-emerald-400" : bothHeld ? "text-[#FEE715]" : "text-white/60"}`}>{status}</p>
        <p className="mt-1 font-mono text-[9px] font-bold uppercase text-[#FF007B]">Both opposite-end grips must remain pressed for every counted shake.</p>
        {!sensorActive && <button type="button" onClick={() => void activateSensor()} className="mt-3 w-full animate-pulse rounded-xl bg-[#FEE715] px-4 py-3 font-mono text-xs font-black uppercase text-black shadow-[0_0_25px_rgba(254,231,21,.5)]">⚡ Activate motion sensors</button>}
      </section>

      <GripPad color="#00F0FF" held={bottomHeld} label="Partner 2" onHeld={(held) => setGrip("bottom", held)} />
    </DmapFrame>
  );
}

function GripPad({ color, held, label, onHeld, rotated = false }: { color: string; held: boolean; label: string; onHeld: (held: boolean) => void; rotated?: boolean }) {
  return (
    <button
      type="button"
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); onHeld(true); }}
      onPointerUp={() => onHeld(false)}
      onPointerCancel={() => onHeld(false)}
      className={`relative min-h-28 w-full touch-none select-none overflow-hidden rounded-2xl border-2 px-8 py-6 text-center transition ${held ? "scale-[1.01]" : "border-dashed"} ${rotated ? "rotate-180" : "mt-auto"}`}
      style={{ borderColor: color, backgroundColor: `${color}${held ? "42" : "16"}`, boxShadow: held ? `0 0 24px ${color}55` : undefined, color }}
    >
      <span className="absolute inset-x-0 top-1 font-mono text-[8px] tracking-[0.2em]">GRIP PHONE HERE</span>
      <span className="font-mono text-sm font-black uppercase">{held ? `✓ ${label} gripped` : label}</span>
      <span className="mt-1 block font-mono text-[9px] text-white/65">{held ? "HOLD FIRMLY WHILE SHAKING" : "LONG TAP / GRIP WITH PHONE FACING UP"}</span>
    </button>
  );
}
