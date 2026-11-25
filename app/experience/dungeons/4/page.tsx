"use client";

import { get, onValue, ref, runTransaction, serverTimestamp, update } from "firebase/database";
import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DUNGEON_BATTLE_PATH, ROLE_DETAILS, isDungeonRole, type DungeonRole } from "@/lib/dungeons";
import { realtimeDatabase } from "@/lib/firebase";
import { BackToCampaign, DungeonShell, QuestQr } from "../components/DungeonUi";

const MAX_HP = 1000;
const ATTACK_ANIMATION_MS = 950;

type BattlePlayer = {
  active?: boolean;
  damage?: number;
  joinedAt?: number;
  name: string;
  processedCount?: number;
  role: DungeonRole;
};

type LastAttack = {
  amount: number;
  name: string;
  nonce: string;
  playerId: string;
  role: DungeonRole | "bomb";
};

type VisualAttack = LastAttack & { preview?: boolean };

type BattleRecord = {
  meta?: { nextRoleIndex?: number };
  players?: Record<string, BattlePlayer>;
  state?: {
    active?: boolean;
    hp?: number;
    maxHp?: number;
    victory?: boolean;
    runId?: string;
    lastAttack?: LastAttack;
  };
};

function countPath(playerId: string, role: DungeonRole) {
  if (role === "warrior") return `swords/sessions/${playerId}/slashCount`;
  if (role === "mage") return `staffs/sessions/${playerId}/spinCount`;
  return `arrows/sessions/${playerId}/tapCount`;
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function spriteFor(role: DungeonRole) {
  return `/experience/dungeons/battle/${role}.png`;
}

function sensorRoot(role: DungeonRole) {
  if (role === "warrior") return "swords";
  if (role === "mage") return "staffs";
  return "arrows";
}

export default function DragonBattlePage() {
  const [battle, setBattle] = useState<BattleRecord>({});
  const [deviceCounts, setDeviceCounts] = useState<Record<string, number>>({});
  const [visualAttack, setVisualAttack] = useState<VisualAttack | null>(null);
  const [pendingAttackCount, setPendingAttackCount] = useState(0);
  const [lastCompletedAttackNonce, setLastCompletedAttackNonce] = useState("");
  const battleRecordRef = useRef<BattleRecord>({});
  const observedCountsRef = useRef<Record<string, number>>({});
  const attackQueueRef = useRef<VisualAttack[]>([]);
  const currentAttackRef = useRef<VisualAttack | null>(null);
  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenAttackNoncesRef = useRef(new Set<string>());
  const drainAttackQueueRef = useRef<() => void>(() => undefined);

  const drainAttackQueue = useCallback(() => {
    if (currentAttackRef.current || attackTimerRef.current) return;
    const nextAttack = attackQueueRef.current.shift();
    if (!nextAttack) return;

    currentAttackRef.current = nextAttack;
    setVisualAttack(nextAttack);
    setPendingAttackCount(attackQueueRef.current.length + 1);
    attackTimerRef.current = setTimeout(() => {
      currentAttackRef.current = null;
      attackTimerRef.current = null;
      setVisualAttack(null);
      setLastCompletedAttackNonce(nextAttack.nonce);
      setPendingAttackCount(attackQueueRef.current.length);
      window.requestAnimationFrame(() => drainAttackQueueRef.current());
    }, ATTACK_ANIMATION_MS);
  }, []);

  useEffect(() => {
    drainAttackQueueRef.current = drainAttackQueue;
  }, [drainAttackQueue]);

  const enqueueAttack = useCallback((attack: VisualAttack) => {
    if (attack.role !== "bomb" && !isDungeonRole(attack.role)) return;
    if (seenAttackNoncesRef.current.has(attack.nonce)) return;
    seenAttackNoncesRef.current.add(attack.nonce);
    attackQueueRef.current.push(attack);
    setPendingAttackCount(attackQueueRef.current.length + (currentAttackRef.current ? 1 : 0));
    drainAttackQueueRef.current();
  }, []);

  const clearAttackAnimations = useCallback(() => {
    if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    attackTimerRef.current = null;
    currentAttackRef.current = null;
    attackQueueRef.current = [];
    setVisualAttack(null);
    setPendingAttackCount(0);
  }, []);

  useEffect(() => () => {
    if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
  }, []);

  useEffect(() => {
    const battleRef = ref(realtimeDatabase, DUNGEON_BATTLE_PATH);
    void runTransaction(battleRef, (current: BattleRecord | null) => current ?? {
      meta: { nextRoleIndex: 0 },
      players: {},
      state: { active: false, hp: MAX_HP, maxHp: MAX_HP, victory: false },
    });
    return onValue(battleRef, (snapshot) => {
      const next = (snapshot.val() as BattleRecord | null) ?? {};
      battleRecordRef.current = next;
      setBattle(next);
    });
  }, []);

  const players = useMemo(
    () => Object.entries(battle.players ?? {}).flatMap(([id, player]) => {
      if (!player || typeof player !== "object") return [];
      const safePlayer: BattlePlayer = {
        ...player,
        name: typeof player.name === "string" && player.name.trim() ? player.name : "Unnamed adventurer",
        role: isDungeonRole(player.role) ? player.role : "warrior",
      };
      return [[id, safePlayer] as const];
    }).sort(([, a], [, b]) => numeric(a.joinedAt) - numeric(b.joinedAt)),
    [battle.players],
  );
  const playerSignature = players.map(([id, player]) => `${id}:${player.role}`).join("|");

  const consumeAttack = useCallback(async (playerId: string, player: BattlePlayer, currentCount: number) => {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await runTransaction(ref(realtimeDatabase, DUNGEON_BATTLE_PATH), (current: BattleRecord | null) => {
      if (!current?.state?.active || current.state.victory) return;
      const livePlayer = current.players?.[playerId];
      if (!livePlayer || livePlayer.role !== player.role) return;

      const processed = numeric(livePlayer.processedCount);
      if (currentCount < processed) {
        livePlayer.processedCount = currentCount;
        return current;
      }
      if (currentCount === processed) return;

      const damage = currentCount - processed;
      const hp = Math.max(0, numeric(current.state.hp ?? MAX_HP) - damage);
      livePlayer.processedCount = currentCount;
      livePlayer.damage = numeric(livePlayer.damage) + damage;
      current.state.hp = hp;
      current.state.victory = hp === 0;
      current.state.lastAttack = { amount: damage, name: livePlayer.name, nonce, playerId, role: livePlayer.role };
      return current;
    });
    const committed = (result.snapshot.val() as BattleRecord | null)?.state?.lastAttack;
    if (result.committed && committed?.nonce === nonce) enqueueAttack(committed);
  }, [enqueueAttack]);

  useEffect(() => {
    const unsubscribes = players.map(([playerId, player]) => onValue(
      ref(realtimeDatabase, countPath(playerId, player.role)),
      (snapshot) => {
        const count = numeric(snapshot.val());
        const previousCount = observedCountsRef.current[playerId];
        observedCountsRef.current[playerId] = count;
        setDeviceCounts((current) => current[playerId] === count ? current : { ...current, [playerId]: count });
        if (previousCount !== undefined && count > previousCount && !battleRecordRef.current.state?.active) {
          const attack: VisualAttack = {
            amount: count - previousCount,
            name: player.name,
            nonce: `preview-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            playerId,
            preview: true,
            role: player.role,
          };
          enqueueAttack(attack);
        }
        void consumeAttack(playerId, player, count);
      },
    ));
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
    // The signature intentionally captures membership and assigned roles only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerSignature, consumeAttack, enqueueAttack]);

  const lastAttack = battle.state?.lastAttack;

  useEffect(() => {
    if (lastAttack) enqueueAttack(lastAttack);
  }, [enqueueAttack, lastAttack]);

  async function activateBattle() {
    const baselines = Object.fromEntries(await Promise.all(players.map(async ([playerId, player]) => {
      const snapshot = await get(ref(realtimeDatabase, countPath(playerId, player.role)));
      return [playerId, numeric(snapshot.val())] as const;
    })));

    await runTransaction(ref(realtimeDatabase, DUNGEON_BATTLE_PATH), (current: BattleRecord | null) => {
      const next = current ?? { meta: { nextRoleIndex: 0 }, players: {}, state: {} };
      next.state = {
        active: true,
        hp: MAX_HP,
        maxHp: MAX_HP,
        victory: false,
        runId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      };
      for (const [playerId, player] of Object.entries(next.players ?? {})) {
        player.damage = 0;
        player.processedCount = baselines[playerId] ?? 0;
      }
      return next;
    });
  }

  async function resetBattle() {
    const baselines = Object.fromEntries(await Promise.all(players.map(async ([playerId, player]) => {
      const snapshot = await get(ref(realtimeDatabase, countPath(playerId, player.role)));
      return [playerId, numeric(snapshot.val())] as const;
    })));

    clearAttackAnimations();
    await runTransaction(ref(realtimeDatabase, DUNGEON_BATTLE_PATH), (current: BattleRecord | null) => {
      const next = current ?? { meta: { nextRoleIndex: 0 }, players: {}, state: {} };
      next.state = { active: false, hp: MAX_HP, maxHp: MAX_HP, victory: false };
      for (const [playerId, player] of Object.entries(next.players ?? {})) {
        player.damage = 0;
        player.processedCount = baselines[playerId] ?? 0;
      }
      return next;
    });
  }

  async function dropBomb() {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await runTransaction(ref(realtimeDatabase, DUNGEON_BATTLE_PATH), (current: BattleRecord | null) => {
      if (!current?.state?.active || current.state.victory) return;
      const hp = Math.max(0, numeric(current.state.hp ?? MAX_HP) - 100);
      current.state.hp = hp;
      current.state.victory = hp === 0;
      current.state.lastAttack = { amount: 100, name: "Dungeon Master", nonce, playerId: "bomb", role: "bomb" };
      return current;
    });
    const committed = (result.snapshot.val() as BattleRecord | null)?.state?.lastAttack;
    if (result.committed && committed?.nonce === nonce) enqueueAttack(committed);
  }

  function removePlayer(playerId: string, player: BattlePlayer) {
    if (!window.confirm(`Remove ${player.name} from Chapter IV? Their linked sensor session will also be deleted.`)) return;
    const updates: Record<string, unknown> = {
      [`${DUNGEON_BATTLE_PATH}/commands/disconnect/${playerId}`]: { at: serverTimestamp(), mode: "delete" },
      [`${DUNGEON_BATTLE_PATH}/players/${playerId}`]: null,
      [`${sensorRoot(player.role)}/sessions/${playerId}`]: null,
    };
    void update(ref(realtimeDatabase), updates);
  }

  const hp = numeric(battle.state?.hp ?? MAX_HP);
  const hpPercent = Math.max(0, Math.min(100, (hp / MAX_HP) * 100));
  const active = Boolean(battle.state?.active);
  const victory = Boolean(battle.state?.victory);
  const victoryAnimationComplete = !lastAttack || (pendingAttackCount === 0 && lastCompletedAttackNonce === lastAttack.nonce);

  return (
    <DungeonShell background="/experience/dungeons/battle/battlefield.png">
      <BackToCampaign />
      <div className="battle-screen">
        <header className="battle-hud dungeon-panel">
          <div>
            <p className="dungeon-kicker">Chapter IV · The Northern Mountain</p>
            <h1 className="dungeon-title mt-1 text-2xl sm:text-4xl">Slay the Dragon</h1>
          </div>
          <div className="battle-hp-wrap">
            <div className="flex items-end justify-between gap-4">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-red-200">Dragon HP</span>
              <strong className="font-mono text-xl text-white">{hp} / {MAX_HP}</strong>
            </div>
            <div className="battle-hp"><span style={{ width: `${hpPercent}%` }} /></div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => void activateBattle()} disabled={active || victory} className="dungeon-button rounded-lg px-4 py-3 text-[10px]">{active ? "Battle active" : "Activate battle"}</button>
            <button type="button" onClick={() => void resetBattle()} className="battle-reset rounded-lg px-4 py-3 font-mono text-[10px] font-black uppercase tracking-wider">↺ Reset battle</button>
            <button type="button" onClick={() => void dropBomb()} disabled={!active || victory} className="battle-bomb rounded-lg px-4 py-3 font-mono text-[10px] font-black uppercase tracking-wider">💣 Bomb · 100</button>
          </div>
        </header>

        <section className="battle-field" aria-label="Dragon battlefield">
          <div key={`dragon-${visualAttack?.nonce ?? "waiting"}`} className={`battle-dragon ${active && !victory ? "is-awake" : ""} ${visualAttack ? "is-hit" : ""}`}>
            <Image src="/experience/dungeons/battle/dragon.png" alt="The mountain dragon" width={1536} height={1024} priority />
          </div>

          {players.map(([playerId, player]) => {
            const rolePeers = players.filter(([, candidate]) => candidate.role === player.role);
            const roleSlot = rolePeers.findIndex(([id]) => id === playerId);
            const style = { "--battle-offset": `${roleSlot * 46}px`, "--battle-x": `${roleSlot * 62}px` } as CSSProperties;
            const isAttacking = visualAttack?.playerId === playerId;
            const roundCount = active
              ? numeric(player.damage)
              : Math.max(0, numeric(deviceCounts[playerId]) - numeric(player.processedCount));
            return (
              <div key={`${playerId}-${isAttacking ? visualAttack.nonce : "idle"}`} className={`battle-player battle-player-${player.role} ${player.active ? "is-connected" : ""} ${isAttacking ? "is-attacking" : ""}`} style={style}>
                <Image src={spriteFor(player.role)} alt="" width={1214} height={1374} />
                <div className="battle-nameplate">
                  <span style={{ color: ROLE_DETAILS[player.role].color }}>{ROLE_DETAILS[player.role].glyph}</span>
                  <span>{player.name}</span>
                  <button type="button" onClick={() => removePlayer(playerId, player)} className="battle-remove-player" aria-label={`Remove ${player.name}`}>×</button>
                  <b>{active ? "Live" : "Test"} · {roundCount} {player.role === "warrior" ? "slashes" : player.role === "mage" ? "spins" : "taps"}</b>
                </div>
                {visualAttack?.playerId === playerId ? <span key={visualAttack.nonce} className={`battle-attack battle-attack-${player.role}`} aria-hidden="true" /> : null}
              </div>
            );
          })}

          {visualAttack ? (
            <div key={visualAttack.nonce} className={`battle-damage battle-damage-${visualAttack.role} ${visualAttack.preview ? "is-preview" : ""}`}>
              {visualAttack.preview ? "TEST" : `-${visualAttack.amount}`} <small>{visualAttack.role === "bomb" ? "BOMB" : ROLE_DETAILS[visualAttack.role].title}</small>
            </div>
          ) : null}

          {!active ? (
            <div className="battle-waiting dungeon-panel">
              <p className="dungeon-kicker">Party assembling · {players.length} connected</p>
              <p className="mt-2 text-sm text-white/60">Test every weapon now—the party and attack effects will move, but the dragon will take no damage until Activate Battle is pressed.</p>
            </div>
          ) : null}
        </section>

        <aside className="battle-join">
          <QuestQr path="/experience/dungeons/4-quest" label="Join the dragon battle" />
        </aside>

        {victory && victoryAnimationComplete ? (
          <div className="battle-victory fixed inset-0 z-[120] grid place-items-center bg-black/80 p-6 backdrop-blur-md">
            <section className="dungeon-panel dungeon-pass max-w-3xl rounded-3xl border-emerald-400/50 p-9 text-center">
              <p className="dungeon-kicker text-emerald-300">The mountain falls silent</p>
              <h2 className="dungeon-title mt-3 text-6xl text-[#f6edcf] sm:text-8xl">Victory!</h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-white/65">The dragon is slain. The crystal—and the city’s future—belongs to the party.</p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/experience/dungeons/5" className="dungeon-button inline-block rounded-xl px-7 py-4 text-xs">Celebrate →</Link>
                <button type="button" onClick={() => void resetBattle()} className="battle-reset rounded-xl px-7 py-4 font-mono text-xs font-black uppercase tracking-wider">↺ Reset battle</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </DungeonShell>
  );
}
