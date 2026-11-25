"use client";

import { get, onDisconnect, onValue, ref, remove, runTransaction, serverTimestamp, update } from "firebase/database";
import { useEffect, useRef, useState } from "react";

import { battleRoleForIndex, DUNGEON_BATTLE_PATH, isDungeonRole, ROLE_DETAILS, type DungeonRole } from "@/lib/dungeons";
import { realtimeDatabase } from "@/lib/firebase";
import { captureMotion, captureOrientation, finiteNumber, getDeviceDetails, type MotionSnapshot, type PermissionMotionEvent, type Vector3 } from "@/lib/proto-device";
import { QuestHeader, RoleAvatar } from "../components/DungeonUi";

const PLAYER_STORAGE_KEY = "dungeon-battle-4-player-id";

type JoinedPlayer = { id: string; name: string; role: DungeonRole };

function createPlayerId() {
  const randomPart = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `battle-${randomPart}`;
}

function disconnectCommand(value: unknown) {
  if (typeof value === "number") return { at: value, deleteUser: false };
  if (!value || typeof value !== "object") return { at: 0, deleteUser: false };
  const command = value as { at?: unknown; mode?: unknown };
  return { at: typeof command.at === "number" ? finiteNumber(command.at) : 0, deleteUser: command.mode === "delete" };
}

export default function BattleQuestPage() {
  const [name, setName] = useState("");
  const [player, setPlayer] = useState<JoinedPlayer | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [battleActive, setBattleActive] = useState(false);

  useEffect(() => onValue(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/state/active`), (snapshot) => setBattleActive(Boolean(snapshot.val()))), []);

  useEffect(() => {
    if (!player) return;
    return onValue(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/players/${player.id}`), (snapshot) => {
      if (snapshot.exists()) {
        const livePlayer = snapshot.val() as { name?: unknown; role?: unknown };
        const liveRole = isDungeonRole(livePlayer.role) ? livePlayer.role : player.role;
        const liveName = typeof livePlayer.name === "string" && livePlayer.name.trim() ? livePlayer.name : player.name;
        if (liveRole !== player.role || liveName !== player.name) setPlayer({ id: player.id, name: liveName, role: liveRole });
        return;
      }
      const root = player.role === "warrior" ? "swords" : player.role === "mage" ? "staffs" : "arrows";
      const sessionRef = ref(realtimeDatabase, `${root}/sessions/${player.id}`);
      void onDisconnect(sessionRef).cancel().then(() => remove(sessionRef));
      window.localStorage.removeItem(PLAYER_STORAGE_KEY);
      setPlayer(null);
      setError("The dungeon master removed this user. Enter your name to join again.");
    });
  }, [player]);

  async function joinBattle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || joining) return;

    setJoining(true);
    setError("");
    try {
      const storedId = window.localStorage.getItem(PLAYER_STORAGE_KEY);
      const id = storedId || createPlayerId();
      const playerRef = ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/players/${id}`);
      const existing = (await get(playerRef)).val() as { role?: unknown } | null;
      const existingRole = isDungeonRole(existing?.role) ? existing.role : null;
      let role: DungeonRole;

      if (existingRole) {
        role = existingRole;
      } else {
        const assignment = await runTransaction(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/meta/nextRoleIndex`), (value) => finiteNumber(value) + 1);
        role = battleRoleForIndex(finiteNumber(assignment.snapshot.val()) - 1);
      }

      const playerUpdate: Record<string, unknown> = {
        active: true,
        name: cleanName,
        role,
        ...(existingRole ? {} : { damage: 0, processedCount: 0 }),
      };
      if (!existingRole) playerUpdate.joinedAt = serverTimestamp();
      await update(playerRef, playerUpdate);
      await onDisconnect(playerRef).update({ active: false });
      window.localStorage.setItem(PLAYER_STORAGE_KEY, id);
      setPlayer({ id, name: cleanName, role });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "The battlefield could not be joined.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="battle-quest min-h-[100dvh] px-5 py-8">
      <div className="mx-auto max-w-xl">
        <QuestHeader chapter="Chapter IV" title="Ready Your Weapon" />
        {!player ? (
          <form onSubmit={joinBattle} className="dungeon-panel mt-8 rounded-3xl p-6">
            <p className="text-center text-sm leading-6 text-white/55">Speak your name once more. The armory will assign the next role in the order mage, warrior, archer.</p>
            <label className="mt-6 block">
              <span className="dungeon-kicker">Adventurer name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className="dungeon-input mt-2 px-4 py-4 text-lg" maxLength={36} autoComplete="name" autoFocus />
            </label>
            <button type="submit" disabled={!name.trim() || joining} className="dungeon-button mt-4 w-full rounded-xl px-5 py-4 text-xs">{joining ? "Binding role…" : "Join the battle"}</button>
            {error ? <p className="mt-3 text-center text-sm text-red-300">{error}</p> : null}
          </form>
        ) : (
          <section className="mt-7">
            <div className="dungeon-panel flex items-center gap-4 rounded-2xl p-4">
              <RoleAvatar role={player.role} />
              <div className="min-w-0 flex-1">
                <p className="dungeon-kicker">{ROLE_DETAILS[player.role].title}</p>
                <h2 className="truncate text-2xl font-bold">{player.name}</h2>
              </div>
              <span className={`rounded-full border px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wider ${battleActive ? "border-red-400/60 bg-red-950/60 text-red-200" : "border-white/15 bg-black/40 text-white/45"}`}>{battleActive ? "Battle live" : "Waiting"}</span>
            </div>
            {player.role === "warrior" ? <WarriorWeapon playerId={player.id} /> : null}
            {player.role === "mage" ? <MageWeapon playerId={player.id} /> : null}
            {player.role === "archer" ? <ArcherWeapon playerId={player.id} /> : null}
          </section>
        )}
      </div>
    </main>
  );
}

function WeaponFrame({
  active,
  count,
  countLabel,
  glyph,
  role,
  status,
  onActivate,
  onDeactivate,
  onWeaponAction,
}: {
  active: boolean;
  count: number;
  countLabel: string;
  glyph: string;
  role: DungeonRole;
  status: string;
  onActivate: () => void;
  onDeactivate: () => void;
  onWeaponAction?: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const weapon = (
    <span className={`battle-weapon battle-weapon-${role} ${active ? "is-active" : ""}`} aria-hidden="true">{glyph}</span>
  );
  return (
    <div className="dungeon-panel mt-4 rounded-3xl p-5 text-center">
      {onWeaponAction ? (
        <button type="button" onPointerDown={onWeaponAction} disabled={!active} className="battle-weapon-button" aria-label="Fire an arrow">{weapon}</button>
      ) : weapon}
      <div className="mt-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{countLabel}</p>
        <p className="mt-1 text-6xl font-bold text-[#f6edcf]">{count}</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={onActivate} disabled={active} className="dungeon-button rounded-xl px-4 py-4 text-[10px]">{active ? "Sensor active" : role === "archer" ? "Activate tap tracking" : "Activate sensor"}</button>
        <button type="button" onClick={onDeactivate} disabled={!active} className="rounded-xl border border-white/15 bg-black/35 px-4 py-4 font-mono text-[10px] font-bold uppercase tracking-wider text-white/65 disabled:opacity-35">Deactivate</button>
      </div>
      <p className="mt-4 min-h-10 text-sm leading-5 text-white/50">{status}</p>
    </div>
  );
}

type SwordConfig = { accelerationThreshold: number; cooldownMs: number; rotationThreshold: number; uploadIntervalMs: number };
const SWORD_DEFAULTS: SwordConfig = { accelerationThreshold: 16, cooldownMs: 550, rotationThreshold: 350, uploadIntervalMs: 100 };

function WarriorWeapon({ playerId }: { playerId: string }) {
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("Activate the sensor, then slash with your phone like a sword.");
  const configRef = useRef(SWORD_DEFAULTS);
  const startedAtRef = useRef(0);
  const lastSlashRef = useRef(0);
  const lastUploadRef = useRef(0);
  const orientationRef = useRef<Vector3>({});

  useEffect(() => {
    const configOff = onValue(ref(realtimeDatabase, "swords/config"), (snapshot) => {
      const value = snapshot.val() as Partial<SwordConfig> | null;
      configRef.current = {
        accelerationThreshold: finiteNumber(value?.accelerationThreshold) || SWORD_DEFAULTS.accelerationThreshold,
        cooldownMs: finiteNumber(value?.cooldownMs) || SWORD_DEFAULTS.cooldownMs,
        rotationThreshold: finiteNumber(value?.rotationThreshold) || SWORD_DEFAULTS.rotationThreshold,
        uploadIntervalMs: finiteNumber(value?.uploadIntervalMs) || SWORD_DEFAULTS.uploadIntervalMs,
      };
    });
    const countOff = onValue(ref(realtimeDatabase, `swords/sessions/${playerId}/slashCount`), (snapshot) => setCount(finiteNumber(snapshot.val())));
    return () => { configOff(); countOff(); };
  }, [playerId]);

  useEffect(() => {
    if (!active) return;
    function orient(event: DeviceOrientationEvent) { orientationRef.current = captureOrientation(event); }
    function move(event: DeviceMotionEvent) {
      const motion = captureMotion(event);
      const raw = event.acceleration && event.acceleration.x !== null ? event.acceleration : event.accelerationIncludingGravity;
      const x = finiteNumber(raw?.x); const y = finiteNumber(raw?.y); const z = finiteNumber(raw?.z);
      const accelerationMagnitude = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
      const rotationMagnitude = finiteNumber(motion.rotation.magnitude);
      const now = Date.now();
      const config = configRef.current;
      if (accelerationMagnitude >= config.accelerationThreshold && rotationMagnitude >= config.rotationThreshold && now - lastSlashRef.current >= config.cooldownMs) {
        lastSlashRef.current = now;
        void runTransaction(ref(realtimeDatabase, `swords/sessions/${playerId}/slashCount`), (value) => finiteNumber(value) + 1);
      }
      if (now - lastUploadRef.current < config.uploadIntervalMs) return;
      lastUploadRef.current = now;
      void update(ref(realtimeDatabase, `swords/sessions/${playerId}`), { active: true, acceleration: motion.acceleration, accelerationIncludingGravity: motion.accelerationIncludingGravity, interval: motion.interval, lastActive: serverTimestamp(), orientation: orientationRef.current, rotation: motion.rotation, slashAcceleration: { x, y, z, magnitude: accelerationMagnitude } });
    }
    window.addEventListener("deviceorientation", orient);
    window.addEventListener("devicemotion", move);
    return () => { window.removeEventListener("deviceorientation", orient); window.removeEventListener("devicemotion", move); };
  }, [active, playerId]);

  useEffect(() => {
    if (!active) return;
    const allOff = onValue(ref(realtimeDatabase, "swords/commands/disconnectAllAt"), (snapshot) => {
      if (finiteNumber(snapshot.val()) > startedAtRef.current) void deactivate("The Sword control ended this sensor session.");
    });
    const playerOff = onValue(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/commands/disconnect/${playerId}`), (snapshot) => {
      const command = disconnectCommand(snapshot.val());
      if (command.at > startedAtRef.current) void deactivate("The dungeon master disconnected your Sword session.", !command.deleteUser);
    });
    return () => { allOff(); playerOff(); };
    // The callback intentionally targets the current mounted player session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function activate() {
    const motionEvent = window.DeviceMotionEvent as PermissionMotionEvent | undefined;
    if (!motionEvent) { setStatus("This browser does not expose motion sensors."); return; }
    if (typeof motionEvent.requestPermission === "function") {
      motionEvent.requestPermission().then((result) => result === "granted" ? void connect() : setStatus("Motion permission was not granted.")).catch(() => setStatus("Motion permission could not be requested."));
      return;
    }
    void connect();
  }

  async function connect() {
    const sessionRef = ref(realtimeDatabase, `swords/sessions/${playerId}`);
    const existing = (await get(sessionRef)).val() as { slashCount?: number } | null;
    startedAtRef.current = Date.now();
    await Promise.all([
      update(sessionRef, { active: true, connectedAtClient: Date.now(), experience: "dungeons-4", lastActive: serverTimestamp(), ...(existing ? {} : { createdAt: serverTimestamp(), slashCount: 0 }) }),
      update(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/players/${playerId}`), { active: true }),
    ]);
    await onDisconnect(sessionRef).update({ active: false, lastActive: serverTimestamp() });
    setCount(finiteNumber(existing?.slashCount));
    setActive(true);
    setStatus("Sword ready. Every detected slash deals 1 damage while battle is live.");
  }

  async function deactivate(message = "Sword sensor paused. Your device ID and slash count are preserved.", persist = true) {
    setActive(false); setStatus(message);
    const sessionRef = ref(realtimeDatabase, `swords/sessions/${playerId}`);
    if (persist) await Promise.all([
      update(sessionRef, { active: false, lastActive: serverTimestamp() }),
      update(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/players/${playerId}`), { active: false }),
    ]);
    await onDisconnect(sessionRef).cancel();
  }

  return <WeaponFrame role="warrior" glyph="🗡️" active={active} count={count} countLabel="Slashes" status={status} onActivate={activate} onDeactivate={() => void deactivate()} />;
}

type StaffConfig = { idleResetMs: number; rotationThreshold: number; spinDegrees: number; uploadIntervalMs: number };
const STAFF_DEFAULTS: StaffConfig = { idleResetMs: 500, rotationThreshold: 180, spinDegrees: 360, uploadIntervalMs: 100 };

function MageWeapon({ playerId }: { playerId: string }) {
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("Activate the sensor, then turn through one full spin to cast.");
  const configRef = useRef(STAFF_DEFAULTS);
  const startedAtRef = useRef(0);
  const lastEventRef = useRef(0);
  const lastFastRef = useRef(0);
  const lastUploadRef = useRef(0);
  const progressRef = useRef(0);
  const orientationRef = useRef<Vector3>({});

  useEffect(() => {
    const configOff = onValue(ref(realtimeDatabase, "staffs/config"), (snapshot) => {
      const value = snapshot.val() as Partial<StaffConfig> | null;
      configRef.current = {
        idleResetMs: finiteNumber(value?.idleResetMs) || STAFF_DEFAULTS.idleResetMs,
        rotationThreshold: finiteNumber(value?.rotationThreshold) || STAFF_DEFAULTS.rotationThreshold,
        spinDegrees: finiteNumber(value?.spinDegrees) || STAFF_DEFAULTS.spinDegrees,
        uploadIntervalMs: finiteNumber(value?.uploadIntervalMs) || STAFF_DEFAULTS.uploadIntervalMs,
      };
    });
    const countOff = onValue(ref(realtimeDatabase, `staffs/sessions/${playerId}/spinCount`), (snapshot) => setCount(finiteNumber(snapshot.val())));
    return () => { configOff(); countOff(); };
  }, [playerId]);

  useEffect(() => {
    if (!active) return;
    function orient(event: DeviceOrientationEvent) { orientationRef.current = captureOrientation(event); }
    function move(event: DeviceMotionEvent) {
      const motion: MotionSnapshot = captureMotion(event);
      const now = Date.now();
      const rates = { alpha: Math.abs(finiteNumber(motion.rotation.alpha)), beta: Math.abs(finiteNumber(motion.rotation.beta)), gamma: Math.abs(finiteNumber(motion.rotation.gamma)) };
      const [axis, speed] = Object.entries(rates).sort(([, a], [, b]) => b - a)[0];
      const elapsed = Math.min(0.1, Math.max(0.005, (now - (lastEventRef.current || now - 16)) / 1000));
      lastEventRef.current = now;
      const config = configRef.current;
      let progress = progressRef.current;
      if (speed >= config.rotationThreshold) {
        progress += speed * elapsed; lastFastRef.current = now;
        if (progress >= config.spinDegrees) {
          const spins = Math.floor(progress / config.spinDegrees); progress %= config.spinDegrees;
          void runTransaction(ref(realtimeDatabase, `staffs/sessions/${playerId}/spinCount`), (value) => finiteNumber(value) + spins);
        }
      } else if (now - lastFastRef.current >= config.idleResetMs) progress = 0;
      progressRef.current = progress;
      if (now - lastUploadRef.current < config.uploadIntervalMs) return;
      lastUploadRef.current = now;
      void update(ref(realtimeDatabase, `staffs/sessions/${playerId}`), { acceleration: motion.acceleration, accelerationIncludingGravity: motion.accelerationIncludingGravity, active: true, angularSpeed: speed, dominantAxis: axis, interval: motion.interval, lastActive: serverTimestamp(), orientation: orientationRef.current, rotation: motion.rotation, spinProgressDegrees: progress });
    }
    window.addEventListener("deviceorientation", orient);
    window.addEventListener("devicemotion", move);
    return () => { window.removeEventListener("deviceorientation", orient); window.removeEventListener("devicemotion", move); };
  }, [active, playerId]);

  useEffect(() => {
    if (!active) return;
    const stopOff = onValue(ref(realtimeDatabase, "staffs/commands/disconnectAllAt"), (snapshot) => { if (finiteNumber(snapshot.val()) > startedAtRef.current) void deactivate("The Staff control ended this sensor session."); });
    const deleteOff = onValue(ref(realtimeDatabase, "staffs/commands/deleteAllAt"), (snapshot) => { if (finiteNumber(snapshot.val()) > startedAtRef.current) void deactivate("The Staff control cleared this sensor session."); });
    const playerOff = onValue(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/commands/disconnect/${playerId}`), (snapshot) => {
      const command = disconnectCommand(snapshot.val());
      if (command.at > startedAtRef.current) void deactivate("The dungeon master disconnected your Staff session.", !command.deleteUser);
    });
    return () => { stopOff(); deleteOff(); playerOff(); };
    // The callbacks intentionally target the current mounted player session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function activate() {
    const motionEvent = window.DeviceMotionEvent as PermissionMotionEvent | undefined;
    if (!motionEvent) { setStatus("This browser does not expose motion sensors."); return; }
    if (typeof motionEvent.requestPermission === "function") {
      motionEvent.requestPermission().then((result) => result === "granted" ? void connect() : setStatus("Motion permission was not granted.")).catch(() => setStatus("Motion permission could not be requested."));
      return;
    }
    void connect();
  }

  async function connect() {
    const sessionRef = ref(realtimeDatabase, `staffs/sessions/${playerId}`);
    const existing = (await get(sessionRef)).val() as { spinCount?: number; spinProgressDegrees?: number } | null;
    startedAtRef.current = Date.now();
    progressRef.current = finiteNumber(existing?.spinProgressDegrees);
    await Promise.all([
      update(sessionRef, { active: true, connectedAtClient: Date.now(), device: getDeviceDetails(), experience: "dungeons-4", lastActive: serverTimestamp(), ...(existing ? {} : { createdAt: serverTimestamp(), spinCount: 0, spinProgressDegrees: 0 }) }),
      update(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/players/${playerId}`), { active: true }),
    ]);
    await onDisconnect(sessionRef).update({ active: false, lastActive: serverTimestamp() });
    setCount(finiteNumber(existing?.spinCount)); setActive(true);
    setStatus("Staff ready. Every completed spin releases a 1-damage spell.");
  }

  async function deactivate(message = "Staff sensor paused. Your device ID and spin count are preserved.", persist = true) {
    setActive(false); setStatus(message);
    const sessionRef = ref(realtimeDatabase, `staffs/sessions/${playerId}`);
    if (persist) await Promise.all([
      update(sessionRef, { active: false, lastActive: serverTimestamp() }),
      update(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/players/${playerId}`), { active: false }),
    ]);
    await onDisconnect(sessionRef).cancel();
  }

  return <WeaponFrame role="mage" glyph="🪄" active={active} count={count} countLabel="Spins" status={status} onActivate={activate} onDeactivate={() => void deactivate()} />;
}

function ArcherWeapon({ playerId }: { playerId: string }) {
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState("Activate tap tracking, then tap the bow to fire.");
  const startedAtRef = useRef(0);

  useEffect(() => {
    const countOff = onValue(ref(realtimeDatabase, `arrows/sessions/${playerId}/tapCount`), (snapshot) => setCount(finiteNumber(snapshot.val())));
    return countOff;
  }, [playerId]);

  useEffect(() => {
    if (!active) return;
    const allOff = onValue(ref(realtimeDatabase, "arrows/commands/disconnectAllAt"), (snapshot) => {
      if (finiteNumber(snapshot.val()) > startedAtRef.current) void deactivate("The Arrow control ended tap tracking.");
    });
    const playerOff = onValue(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/commands/disconnect/${playerId}`), (snapshot) => {
      const command = disconnectCommand(snapshot.val());
      if (command.at > startedAtRef.current) void deactivate("The dungeon master disconnected your Arrow session.", !command.deleteUser);
    });
    return () => { allOff(); playerOff(); };
    // The callback intentionally targets the current mounted player session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function activate() {
    const sessionRef = ref(realtimeDatabase, `arrows/sessions/${playerId}`);
    const existing = (await get(sessionRef)).val() as { tapCount?: number } | null;
    startedAtRef.current = Date.now();
    await Promise.all([
      update(sessionRef, { active: true, connectedAtClient: Date.now(), device: getDeviceDetails(), experience: "dungeons-4", lastActive: serverTimestamp(), ...(existing ? {} : { createdAt: serverTimestamp(), tapCount: 0 }) }),
      update(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/players/${playerId}`), { active: true }),
    ]);
    await onDisconnect(sessionRef).update({ active: false, lastActive: serverTimestamp() });
    setCount(finiteNumber(existing?.tapCount)); setActive(true);
    setStatus("Bow ready. Each tap fires an arrow for 1 damage while battle is live.");
  }

  async function deactivate(message = "Tap tracking paused. Your device ID and tap count are preserved.", persist = true) {
    setActive(false); setStatus(message);
    const sessionRef = ref(realtimeDatabase, `arrows/sessions/${playerId}`);
    if (persist) await Promise.all([
      update(sessionRef, { active: false, lastActive: serverTimestamp() }),
      update(ref(realtimeDatabase, `${DUNGEON_BATTLE_PATH}/players/${playerId}`), { active: false }),
    ]);
    await onDisconnect(sessionRef).cancel();
  }

  function fire(event: React.PointerEvent<HTMLButtonElement>) {
    if (!active) return;
    void runTransaction(ref(realtimeDatabase, `arrows/sessions/${playerId}/tapCount`), (value) => finiteNumber(value) + 1);
    void update(ref(realtimeDatabase, `arrows/sessions/${playerId}`), {
      active: true,
      lastActive: serverTimestamp(),
      lastTap: {
        pointer: { clientX: event.clientX, clientY: event.clientY, offsetX: event.nativeEvent.offsetX, offsetY: event.nativeEvent.offsetY, pointerType: event.pointerType, pressure: event.pressure },
        recordedAt: serverTimestamp(),
      },
    });
  }

  return <WeaponFrame role="archer" glyph="🏹" active={active} count={count} countLabel="Taps" status={status} onActivate={() => void activate()} onDeactivate={() => void deactivate()} onWeaponAction={fire} />;
}
