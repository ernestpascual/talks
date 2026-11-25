"use client";

import { get, onValue, ref, update } from "firebase/database";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_CELEBRATION_BOARD,
  DUNGEON_BATTLE_PATH,
  DUNGEON_ROLES,
  DUNGEON_STAGE_1_PLAYERS,
  DUNGEON_STAGE_2_CLUES,
  DUNGEON_STAGE_2_PLAYERS,
  DUNGEON_STAGE_5_SUBMISSIONS,
  DUNGEON_STATE_COLLECTION,
  DRAGON_CLUE,
  isDungeonRole,
  normalizeCelebrationBoard,
  type CelebrationBoard,
  type DungeonRole,
} from "@/lib/dungeons";
import { firestore, realtimeDatabase } from "@/lib/firebase";

type ChapterTab = "chapter-1" | "chapter-2" | "chapter-3" | "chapter-4" | "chapter-5";
type RecordValue = Record<string, unknown>;
type StoredRecord = RecordValue & { id: string };
type BattlePlayer = RecordValue & {
  active?: boolean;
  damage?: number;
  name?: string;
  role?: DungeonRole;
};
type BattleRecord = {
  meta?: { nextRoleIndex?: number };
  players?: Record<string, BattlePlayer>;
  state?: { active?: boolean; hp?: number; maxHp?: number; victory?: boolean; runId?: string };
};
type SensorSession = RecordValue & { active?: boolean; slashCount?: number; spinCount?: number; tapCount?: number };

const CHAPTERS: Array<{ id: ChapterTab; label: string; icon: string; path: string }> = [
  { id: "chapter-1", label: "I · The Gate", icon: "🏰", path: "/experience/dungeons/1" },
  { id: "chapter-2", label: "II · The Ruins", icon: "📜", path: "/experience/dungeons/2" },
  { id: "chapter-3", label: "III · The Elders", icon: "🔮", path: "/experience/dungeons/3" },
  { id: "chapter-4", label: "IV · The Battle", icon: "🐉", path: "/experience/dungeons/4" },
  { id: "chapter-5", label: "V · The Bard", icon: "🎵", path: "/experience/dungeons/5" },
];

type ManagedDungeonPage = {
  chapter?: ChapterTab;
  dataLabel: string;
  path: string;
  surface: "Campaign" | "Host" | "Quest";
  title: string;
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textValue(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function timestampValue(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  if (typeof value === "number" && value > 0) return new Date(value).toLocaleString();
  return "—";
}

function jsonValue(value: unknown) {
  return JSON.stringify(value, (_key, nested) => {
    if (nested && typeof nested === "object" && "toDate" in nested && typeof nested.toDate === "function") {
      return nested.toDate().toISOString();
    }
    return nested;
  }, 2);
}

async function deleteFirestoreRecords(collectionName: string, ids: string[]) {
  for (let start = 0; start < ids.length; start += 500) {
    const batch = writeBatch(firestore);
    ids.slice(start, start + 500).forEach((id) => batch.delete(doc(firestore, collectionName, id)));
    await batch.commit();
  }
}

function sensorRoot(role: DungeonRole) {
  if (role === "warrior") return "swords";
  if (role === "mage") return "staffs";
  return "arrows";
}

function actionCount(role: DungeonRole, session: SensorSession | undefined) {
  if (role === "warrior") return numberValue(session?.slashCount);
  if (role === "mage") return numberValue(session?.spinCount);
  return numberValue(session?.tapCount);
}

export default function DungeonsAdmin() {
  const [chapter, setChapter] = useState<ChapterTab>("chapter-1");
  const [stageOnePlayers, setStageOnePlayers] = useState<StoredRecord[]>([]);
  const [stageTwoPlayers, setStageTwoPlayers] = useState<StoredRecord[]>([]);
  const [clues, setClues] = useState<StoredRecord[]>([]);
  const [stageFiveSubmissions, setStageFiveSubmissions] = useState<StoredRecord[]>([]);
  const [stageOneState, setStageOneState] = useState<RecordValue>({});
  const [stageTwoState, setStageTwoState] = useState<RecordValue>({});
  const [stageFiveState, setStageFiveState] = useState<CelebrationBoard>(DEFAULT_CELEBRATION_BOARD);
  const [battle, setBattle] = useState<BattleRecord>({});
  const [swordSessions, setSwordSessions] = useState<Record<string, SensorSession>>({});
  const [staffSessions, setStaffSessions] = useState<Record<string, SensorSession>>({});
  const [arrowSessions, setArrowSessions] = useState<Record<string, SensorSession>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    const fail = (message: string) => () => setError(message);
    const unsubscribers = [
      onSnapshot(collection(firestore, DUNGEON_STAGE_1_PLAYERS), (snapshot) => {
        setStageOnePlayers(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })));
        setError("");
      }, fail("Could not read Chapter I participants.")),
      onSnapshot(collection(firestore, DUNGEON_STAGE_2_PLAYERS), (snapshot) => {
        setStageTwoPlayers(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })));
        setError("");
      }, fail("Could not read Chapter II participants.")),
      onSnapshot(collection(firestore, DUNGEON_STAGE_2_CLUES), (snapshot) => {
        setClues(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })));
        setError("");
      }, fail("Could not read the recovered evidence.")),
      onSnapshot(collection(firestore, DUNGEON_STAGE_5_SUBMISSIONS), (snapshot) => {
        setStageFiveSubmissions(snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id })));
        setError("");
      }, fail("Could not read Chapter V song contributions.")),
      onSnapshot(doc(firestore, DUNGEON_STATE_COLLECTION, "stage-1"), (snapshot) => setStageOneState(snapshot.data() ?? {}), fail("Could not read Chapter I state.")),
      onSnapshot(doc(firestore, DUNGEON_STATE_COLLECTION, "stage-2"), (snapshot) => setStageTwoState(snapshot.data() ?? {}), fail("Could not read Chapter II state.")),
      onSnapshot(doc(firestore, DUNGEON_STATE_COLLECTION, "stage-5"), (snapshot) => setStageFiveState(normalizeCelebrationBoard(snapshot.data())), fail("Could not read Chapter V song board.")),
      onValue(ref(realtimeDatabase, DUNGEON_BATTLE_PATH), (snapshot) => setBattle((snapshot.val() as BattleRecord | null) ?? {}), fail("Could not read Chapter IV battle state.")),
      onValue(ref(realtimeDatabase, "swords/sessions"), (snapshot) => setSwordSessions((snapshot.val() as Record<string, SensorSession> | null) ?? {}), fail("Could not read sword sessions.")),
      onValue(ref(realtimeDatabase, "staffs/sessions"), (snapshot) => setStaffSessions((snapshot.val() as Record<string, SensorSession> | null) ?? {}), fail("Could not read staff sessions.")),
      onValue(ref(realtimeDatabase, "arrows/sessions"), (snapshot) => setArrowSessions((snapshot.val() as Record<string, SensorSession> | null) ?? {}), fail("Could not read arrow sessions.")),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const battlePlayers = useMemo(
    () => Object.entries(battle.players ?? {}).sort(([, first], [, second]) => numberValue(first.joinedAt) - numberValue(second.joinedAt)),
    [battle.players],
  );
  const generatedClues = clues.filter((clue) => clue.id !== DRAGON_CLUE.id && clue.protected !== true);
  const selectedChapter = CHAPTERS.find((item) => item.id === chapter) ?? CHAPTERS[0];
  const managedPages: ManagedDungeonPage[] = [
    { title: "Campaign Hub", surface: "Campaign", path: "/experience/dungeons", dataLabel: "Chapter navigation" },
    { title: "The Sealed Gate", surface: "Host", path: "/experience/dungeons/1", chapter: "chapter-1", dataLabel: `${stageOnePlayers.length} participant records` },
    { title: "Gate Entry", surface: "Quest", path: "/experience/dungeons/1-quest", chapter: "chapter-1", dataLabel: `${stageOnePlayers.length} participant records` },
    { title: "Ashes Remember", surface: "Host", path: "/experience/dungeons/2", chapter: "chapter-2", dataLabel: `${stageTwoPlayers.length} players · ${clues.length} clues` },
    { title: "Recover a Memory", surface: "Quest", path: "/experience/dungeons/2-quest", chapter: "chapter-2", dataLabel: `${stageTwoPlayers.length} players · ${generatedClues.length} generated clues` },
    { title: "The Four Elders", surface: "Host", path: "/experience/dungeons/3", chapter: "chapter-3", dataLabel: `${clues.length} RAG fragments` },
    { title: "Dragon Battle", surface: "Host", path: "/experience/dungeons/4", chapter: "chapter-4", dataLabel: `${battlePlayers.length} battle players` },
    { title: "Battle Controller", surface: "Quest", path: "/experience/dungeons/4-quest", chapter: "chapter-4", dataLabel: `${battlePlayers.length} linked sensor sessions` },
    { title: "The Victory Song", surface: "Host", path: "/experience/dungeons/5", chapter: "chapter-5", dataLabel: `Board revision ${stageFiveState.revision}` },
    { title: "Help the Bard", surface: "Quest", path: "/experience/dungeons/5-quest", chapter: "chapter-5", dataLabel: `${stageFiveSubmissions.length} song contributions` },
  ];

  async function perform(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError("");
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The admin action failed.");
    } finally {
      setBusy("");
    }
  }

  function confirmAction(message: string, action: () => Promise<void>) {
    if (!window.confirm(message)) return;
    void action();
  }

  function updatePlayerStatus(collectionName: string, id: string, status: string) {
    void perform(`status-${id}`, () => updateDoc(doc(firestore, collectionName, id), { status }));
  }

  function disconnectFirestorePlayer(collectionName: string, record: StoredRecord) {
    confirmAction(`Disconnect ${textValue(record.name, "this user")}? Their record will remain available here.`, () => perform(`disconnect-${record.id}`, () => updateDoc(doc(firestore, collectionName, record.id), {
      disconnected: true,
      disconnectedAt: serverTimestamp(),
      status: "waiting",
    })));
  }

  function resetStageOne() {
    confirmAction("Reset Chapter I activation and role assignment? Existing participant records will remain.", () => perform("reset-1", () => setDoc(doc(firestore, DUNGEON_STATE_COLLECTION, "stage-1"), {
      active: false,
      nextRoleIndex: 0,
      resetAt: serverTimestamp(),
    }, { merge: true })));
  }

  function resetStageTwo() {
    confirmAction("Reset Chapter II role assignment? Existing participants and evidence will remain.", () => perform("reset-2", () => setDoc(doc(firestore, DUNGEON_STATE_COLLECTION, "stage-2"), {
      nextRoleIndex: 0,
      resetAt: serverTimestamp(),
    }, { merge: true })));
  }

  function resetStageFive() {
    confirmAction("Reset the Chapter V song board to its opening lyrics? Existing contributions will remain until cleared separately.", () => perform("reset-5", () => setDoc(doc(firestore, DUNGEON_STATE_COLLECTION, "stage-5"), {
      ...DEFAULT_CELEBRATION_BOARD,
      resetAt: serverTimestamp(),
    })));
  }

  function clearCollection(collectionName: string, records: StoredRecord[], label: string) {
    if (records.length === 0) return;
    confirmAction(`Delete all ${records.length} ${label}? This cannot be undone.`, () => perform(`clear-${collectionName}`, () => deleteFirestoreRecords(collectionName, records.map((record) => record.id))));
  }

  function deleteRecord(collectionName: string, record: StoredRecord, label: string) {
    confirmAction(`Delete ${label}?`, () => perform(`delete-${record.id}`, () => deleteDoc(doc(firestore, collectionName, record.id))));
  }

  function resetBattle() {
    confirmAction("Reset Chapter IV to 1,000 HP and rehearsal mode? Connected players and sensor sessions will remain.", () => perform("reset-battle", async () => {
      const updates: Record<string, boolean | number | null> = {
        "state/active": false,
        "state/hp": 1000,
        "state/maxHp": 1000,
        "state/victory": false,
        "state/lastAttack": null,
      };
      for (const [id, player] of battlePlayers) {
        if (!isDungeonRole(player.role)) continue;
        updates[`players/${id}/damage`] = 0;
        updates[`players/${id}/processedCount`] = actionCount(player.role, battleSession(id, player.role));
      }
      await update(ref(realtimeDatabase, DUNGEON_BATTLE_PATH), updates);
    }));
  }

  function deleteBattlePlayer(id: string, player: BattlePlayer) {
    confirmAction(`Remove ${textValue(player.name, id)} from Chapter IV and delete their linked sensor session?`, () => perform(`delete-battle-${id}`, async () => {
      const updates: Record<string, unknown> = {
        [`${DUNGEON_BATTLE_PATH}/commands/disconnect/${id}`]: { at: Date.now(), mode: "delete" },
        [`${DUNGEON_BATTLE_PATH}/players/${id}`]: null,
      };
      if (isDungeonRole(player.role)) updates[`${sensorRoot(player.role)}/sessions/${id}`] = null;
      await update(ref(realtimeDatabase), updates);
    }));
  }

  function disconnectBattlePlayer(id: string, player: BattlePlayer) {
    confirmAction(`Disconnect ${textValue(player.name, id)} from Chapter IV? Their player and sensor records will be preserved.`, () => perform(`disconnect-battle-${id}`, async () => {
      const updates: Record<string, unknown> = {
        [`${DUNGEON_BATTLE_PATH}/commands/disconnect/${id}`]: { at: Date.now(), mode: "disconnect" },
        [`${DUNGEON_BATTLE_PATH}/players/${id}/active`]: false,
      };
      if (isDungeonRole(player.role)) updates[`${sensorRoot(player.role)}/sessions/${id}/active`] = false;
      await update(ref(realtimeDatabase), updates);
    }));
  }

  function changeBattleRole(id: string, player: BattlePlayer, nextRole: DungeonRole) {
    if (isDungeonRole(player.role) && player.role === nextRole) return;
    const previousRole = isDungeonRole(player.role) ? player.role : null;
    void perform(`role-battle-${id}`, async () => {
      const nextSessionSnapshot = await get(ref(realtimeDatabase, `${sensorRoot(nextRole)}/sessions/${id}`));
      const nextSession = (nextSessionSnapshot.val() as SensorSession | null) ?? undefined;
      const updates: Record<string, unknown> = {
        [`${DUNGEON_BATTLE_PATH}/players/${id}/role`]: nextRole,
        [`${DUNGEON_BATTLE_PATH}/players/${id}/active`]: false,
        [`${DUNGEON_BATTLE_PATH}/players/${id}/processedCount`]: actionCount(nextRole, nextSession),
        [`${DUNGEON_BATTLE_PATH}/players/${id}/roleChangedAt`]: Date.now(),
      };
      if (previousRole) updates[`${sensorRoot(previousRole)}/sessions/${id}/active`] = false;
      await update(ref(realtimeDatabase), updates);
    });
  }

  function clearBattlePlayers() {
    if (battlePlayers.length === 0) return;
    confirmAction(`Remove all ${battlePlayers.length} Chapter IV players and their linked dungeon sensor sessions?`, () => perform("clear-battle-players", async () => {
      const updates: Record<string, unknown> = {
        [`${DUNGEON_BATTLE_PATH}/players`]: null,
        [`${DUNGEON_BATTLE_PATH}/meta/nextRoleIndex`]: 0,
        [`${DUNGEON_BATTLE_PATH}/state/active`]: false,
        [`${DUNGEON_BATTLE_PATH}/state/hp`]: 1000,
        [`${DUNGEON_BATTLE_PATH}/state/maxHp`]: 1000,
        [`${DUNGEON_BATTLE_PATH}/state/victory`]: false,
        [`${DUNGEON_BATTLE_PATH}/state/lastAttack`]: null,
      };
      for (const [id, player] of battlePlayers) {
        updates[`${DUNGEON_BATTLE_PATH}/commands/disconnect/${id}`] = { at: Date.now(), mode: "delete" };
        if (isDungeonRole(player.role)) updates[`${sensorRoot(player.role)}/sessions/${id}`] = null;
      }
      await update(ref(realtimeDatabase), updates);
    }));
  }

  function battleSession(id: string, role: DungeonRole) {
    if (role === "warrior") return swordSessions[id];
    if (role === "mage") return staffSessions[id];
    return arrowSessions[id];
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-400">Techeons &amp; Promptons</span>
          <h2 className="mt-0.5 text-2xl font-black tracking-tight text-white">Dungeons Data Control</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-400">Inspect and manage the records received by each chapter. All lists update live from Firestore or Realtime Database.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/experience/dungeons" target="_blank" className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-300 transition hover:border-zinc-600 hover:text-white">Open campaign hub ↗</Link>
          <Link href={selectedChapter.path} target="_blank" className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-xs font-bold text-orange-300 transition hover:bg-orange-500/20">Open selected host ↗</Link>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs text-red-300">{error}</div> : null}

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/55 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="font-mono text-[10px] font-bold uppercase tracking-widest text-orange-400">All Dungeons pages</p><h3 className="mt-1 text-lg font-black text-white">Page directory &amp; data mapping</h3></div>
          <p className="text-[11px] text-zinc-500">Every public host and participant route is listed below.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {managedPages.map((page) => (
            <article key={page.path} className={`flex min-h-44 flex-col rounded-2xl border p-4 transition ${page.chapter === chapter ? "border-orange-500/35 bg-orange-950/15" : "border-zinc-800 bg-black/25"}`}>
              <div className="flex items-start justify-between gap-3"><span className={`rounded-full border px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wider ${page.surface === "Quest" ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : page.surface === "Host" ? "border-orange-500/30 bg-orange-500/10 text-orange-300" : "border-violet-500/30 bg-violet-500/10 text-violet-300"}`}>{page.surface}</span>{page.chapter ? <span className="font-mono text-[9px] text-zinc-600">{page.chapter.replace("chapter-", "CH ")}</span> : null}</div>
              <h4 className="mt-3 text-sm font-black text-white">{page.title}</h4>
              <p className="mt-1 break-all font-mono text-[9px] leading-4 text-zinc-600">{page.path}</p>
              <p className="mt-3 text-[10px] text-zinc-400">{page.dataLabel}</p>
              <div className="mt-auto flex gap-2 pt-4">
                <Link href={page.path} target="_blank" className="rounded-lg border border-zinc-700 bg-zinc-800/70 px-2.5 py-1.5 text-[10px] font-bold text-zinc-200 transition hover:bg-zinc-700">Open ↗</Link>
                {page.chapter ? <button type="button" onClick={() => setChapter(page.chapter!)} className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-[10px] font-bold text-orange-300 transition hover:bg-orange-500/20">Manage data</button> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto border-b border-zinc-800 pb-2">
        {CHAPTERS.map((item) => (
          <button key={item.id} type="button" onClick={() => setChapter(item.id)} className={`whitespace-nowrap rounded-xl border px-4 py-2.5 font-mono text-xs font-bold transition ${chapter === item.id ? "border-orange-500/45 bg-orange-500/10 text-orange-300" : "border-transparent text-zinc-500 hover:bg-zinc-900 hover:text-white"}`}>
            <span className="mr-2">{item.icon}</span>{item.label}
          </button>
        ))}
      </div>

      {chapter === "chapter-1" ? (
        <ChapterPanel
          eyebrow="Firestore · Chapter I"
          title="The Sealed Gate"
          description="Names, assigned roles, submitted opening intent, Gemini judgment, and gate state."
          stats={[
            ["Participants", stageOnePlayers.length],
            ["Passed", stageOnePlayers.filter((player) => player.status === "passed").length],
            ["Gate", stageOneState.active ? "Active" : "Waiting"],
            ["Next role index", numberValue(stageOneState.nextRoleIndex)],
          ]}
          actions={<><ActionButton onClick={resetStageOne} disabled={busy === "reset-1"}>Reset chapter</ActionButton><DangerButton onClick={() => clearCollection(DUNGEON_STAGE_1_PLAYERS, stageOnePlayers, "Chapter I participant records")} disabled={stageOnePlayers.length === 0 || busy === `clear-${DUNGEON_STAGE_1_PLAYERS}`}>Clear participants</DangerButton></>}
        >
          <PlayerTable records={stageOnePlayers} collectionName={DUNGEON_STAGE_1_PLAYERS} onStatus={updatePlayerStatus} onDisconnect={disconnectFirestorePlayer} onDelete={deleteRecord} />
        </ChapterPanel>
      ) : null}

      {chapter === "chapter-2" ? (
        <ChapterPanel
          eyebrow="Firestore · Chapter II"
          title="Ashes Remember"
          description="Role assignments, prompt intent, artifact action, generated clues, and evidence delivery status."
          stats={[
            ["Participants", stageTwoPlayers.length],
            ["Passed", stageTwoPlayers.filter((player) => player.status === "passed").length],
            ["Generated clues", generatedClues.length],
            ["Next role index", numberValue(stageTwoState.nextRoleIndex)],
          ]}
          actions={<><ActionButton onClick={resetStageTwo} disabled={busy === "reset-2"}>Reset role order</ActionButton><DangerButton onClick={() => clearCollection(DUNGEON_STAGE_2_PLAYERS, stageTwoPlayers, "Chapter II participant records")} disabled={stageTwoPlayers.length === 0}>Clear participants</DangerButton><DangerButton onClick={() => clearCollection(DUNGEON_STAGE_2_CLUES, generatedClues, "generated evidence fragments")} disabled={generatedClues.length === 0}>Clear generated clues</DangerButton></>}
        >
          <PlayerTable records={stageTwoPlayers} collectionName={DUNGEON_STAGE_2_PLAYERS} onStatus={updatePlayerStatus} onDisconnect={disconnectFirestorePlayer} onDelete={deleteRecord} showEvidence />
          <EvidenceList records={clues} onDelete={deleteRecord} />
        </ChapterPanel>
      ) : null}

      {chapter === "chapter-3" ? (
        <ChapterPanel
          eyebrow="Firestore RAG · Chapter III"
          title="The Four Elders"
          description="Chapter III does not persist voice transcripts. It reads this complete Chapter II evidence corpus to ground the elders."
          stats={[
            ["RAG fragments", clues.length],
            ["Party records", stageTwoPlayers.length],
            ["Protected truths", clues.filter((clue) => clue.protected === true).length],
            ["Voice transcripts", "Ephemeral"],
          ]}
          actions={<DangerButton onClick={() => clearCollection(DUNGEON_STAGE_2_CLUES, generatedClues, "generated RAG evidence fragments")} disabled={generatedClues.length === 0}>Clear generated RAG</DangerButton>}
        >
          <EvidenceList records={clues} onDelete={deleteRecord} />
          <section className="rounded-2xl border border-zinc-800 bg-black/25 p-5">
            <h4 className="text-sm font-bold text-white">Party records included in the RAG</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {stageTwoPlayers.map((player) => <RawRecord key={player.id} record={player} title={`${textValue(player.name)} · ${textValue(player.role)}`} />)}
            </div>
          </section>
        </ChapterPanel>
      ) : null}

      {chapter === "chapter-4" ? (
        <ChapterPanel
          eyebrow="Realtime Database · Chapter IV"
          title="The Dragon Battle"
          description="Live party connections, assigned combat roles, sensor counters, round damage, and boss state."
          stats={[
            ["Players", battlePlayers.length],
            ["Connected", battlePlayers.filter(([, player]) => player.active).length],
            ["Dragon HP", `${numberValue(battle.state?.hp ?? 1000)} / ${numberValue(battle.state?.maxHp ?? 1000) || 1000}`],
            ["Mode", battle.state?.victory ? "Victory" : battle.state?.active ? "Battle" : "Rehearsal"],
          ]}
          actions={<><ActionButton onClick={resetBattle} disabled={busy === "reset-battle"}>Reset battle</ActionButton><DangerButton onClick={clearBattlePlayers} disabled={battlePlayers.length === 0 || busy === "clear-battle-players"}>Clear players &amp; sessions</DangerButton></>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {battlePlayers.length === 0 ? <EmptyState text="No players have joined Chapter IV." /> : null}
            {battlePlayers.map(([id, player]) => {
              const role = isDungeonRole(player.role) ? player.role : "warrior";
              const session = battleSession(id, role);
              return (
                <article key={id} className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0"><p className="truncate text-lg font-black text-white">{textValue(player.name, "Unnamed player")}</p><p className="mt-1 break-all font-mono text-[10px] text-zinc-500">{id}</p></div>
                    <StatusPill active={Boolean(player.active)} activeLabel="Connected" inactiveLabel="Offline" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                      <label htmlFor={`battle-role-${id}`} className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">Assigned role</label>
                      <select id={`battle-role-${id}`} value={isDungeonRole(player.role) ? player.role : ""} onChange={(event) => changeBattleRole(id, player, event.target.value as DungeonRole)} disabled={busy === `role-battle-${id}`} className="mt-1 w-full rounded-lg border border-orange-500/25 bg-zinc-950 px-2 py-1.5 text-sm font-black capitalize text-orange-300 outline-none transition focus:border-orange-400 disabled:opacity-40">
                        {!isDungeonRole(player.role) ? <option value="" disabled>Assign role</option> : null}
                        {DUNGEON_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </div>
                    <Metric label={role === "warrior" ? "Slashes" : role === "mage" ? "Spins" : "Taps"} value={actionCount(role, session)} />
                    <Metric label="Round damage" value={numberValue(player.damage)} />
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-zinc-600">Changing role pauses the current sensor. The player stays joined and can activate their newly assigned weapon.</p>
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-3">
                    <span className="font-mono text-[10px] text-zinc-500">Sensor: {session?.active ? "active" : "inactive"}</span>
                    <div className="flex gap-2">
                      <ActionButton compact onClick={() => disconnectBattlePlayer(id, player)} disabled={!player.active || busy === `disconnect-battle-${id}`}>Disconnect</ActionButton>
                      <DangerButton compact onClick={() => deleteBattlePlayer(id, player)} disabled={busy === `delete-battle-${id}`}>Delete user</DangerButton>
                    </div>
                  </div>
                  <RawRecord record={{ ...player, id, sensorSession: session ?? null }} title="Raw battle record" />
                </article>
              );
            })}
          </div>
        </ChapterPanel>
      ) : null}

      {chapter === "chapter-5" ? (
        <ChapterPanel
          eyebrow="Firestore + Gemini + Lyria · Chapter V"
          title="The Bard's Victory Song"
          description="Anonymous role-based offerings, the cumulative celebration board, living lyrics, and the production prompt sent to Lyria."
          stats={[
            ["Contributions", stageFiveSubmissions.length],
            ["Incorporated", stageFiveSubmissions.filter((entry) => entry.status === "incorporated").length],
            ["Board revision", stageFiveState.revision],
            ["Happiness", stageFiveState.revision > 0 ? `${stageFiveState.happinessIndex}%` : "Awaiting data"],
          ]}
          actions={<><ActionButton onClick={resetStageFive} disabled={busy === "reset-5"}>Reset song board</ActionButton><DangerButton onClick={() => clearCollection(DUNGEON_STAGE_5_SUBMISSIONS, stageFiveSubmissions, "Chapter V song contributions")} disabled={stageFiveSubmissions.length === 0 || busy === `clear-${DUNGEON_STAGE_5_SUBMISSIONS}`}>Clear contributions</DangerButton></>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/45 p-5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-orange-300">Living lyrics</p>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-zinc-200">{stageFiveState.revision > 0 ? stageFiveState.lyrics : "Awaiting the first analyzed contribution."}</p>
            </section>
            <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-5">
              {stageFiveState.revision > 0 ? <><div><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-orange-300">Mood</p><p className="mt-2 text-sm text-zinc-300">{stageFiveState.moodLabel} · {stageFiveState.moodMeter}/100</p></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-orange-300">Cumulative look &amp; feel</p><p className="mt-2 text-sm leading-6 text-zinc-400">{stageFiveState.lookAndFeel}</p></div><div><p className="font-mono text-[10px] font-bold uppercase tracking-wider text-orange-300">Final Lyria prompt</p><p className="mt-2 text-sm leading-6 text-zinc-400">{stageFiveState.songPrompt}</p></div></> : <p className="text-sm text-zinc-500">Mood, happiness, lyrics, and production direction will appear only after Gemini analyzes a participant submission.</p>}
              <RawRecord record={stageFiveState as unknown as RecordValue} title="Raw song board" />
            </section>
          </div>
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-5">
            <h4 className="text-sm font-bold text-white">Song contributions ({stageFiveSubmissions.length})</h4>
            {stageFiveSubmissions.length === 0 ? <EmptyState text="No Chapter V contributions received yet." /> : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {stageFiveSubmissions.map((record) => (
                  <article key={record.id} className="rounded-xl border border-zinc-800 bg-black/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-bold capitalize text-white">{textValue(record.role, "Unknown role")}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">{textValue(record.status, "received")} · revision {numberValue(record.boardRevision)}</p></div>
                      <DangerButton compact onClick={() => deleteRecord(DUNGEON_STAGE_5_SUBMISSIONS, record, "this song contribution")}>Delete</DangerButton>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-zinc-300">{textValue(record.songWish)}</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-500">Limit: {textValue(record.lyricLimitations)}</p>
                    <p className="mt-2 text-xs leading-5 text-amber-200/65">Found: {textValue(record.groundFinding)}</p>
                    <RawRecord record={record} title="Raw contribution" compact />
                  </article>
                ))}
              </div>
            )}
          </section>
        </ChapterPanel>
      ) : null}
    </div>
  );
}

function ChapterPanel({ eyebrow, title, description, stats, actions, children }: { eyebrow: string; title: string; description: string; stats: Array<[string, string | number]>; actions: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-950/20 to-zinc-900/35 p-6 shadow-2xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="font-mono text-[10px] font-bold uppercase tracking-widest text-orange-400">{eyebrow}</p><h3 className="mt-1 text-2xl font-black text-white">{title}</h3><p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-400">{description}</p></div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div>
      </section>
      {children}
    </div>
  );
}

function PlayerTable({ records, collectionName, onStatus, onDisconnect, onDelete, showEvidence = false }: { records: StoredRecord[]; collectionName: string; onStatus: (collectionName: string, id: string, status: string) => void; onDisconnect: (collectionName: string, record: StoredRecord) => void; onDelete: (collectionName: string, record: StoredRecord, label: string) => void; showEvidence?: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/35">
      <div className="border-b border-zinc-800 px-5 py-4"><h4 className="text-sm font-bold text-white">Participant records ({records.length})</h4></div>
      {records.length === 0 ? <EmptyState text="No participant records received yet." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-black/25 font-mono text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="px-4 py-3">Player</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Received prompt</th>{showEvidence ? <th className="px-4 py-3">Evidence</th> : null}<th className="px-4 py-3">Joined</th><th className="px-4 py-3 text-right">Manage</th></tr></thead>
          <tbody className="divide-y divide-zinc-800/80">{records.map((record) => <tr key={record.id} className="align-top"><td className="px-4 py-4"><div className="flex items-center gap-2"><p className="font-bold text-white">{textValue(record.name)}</p>{record.disconnected === true ? <StatusPill active={false} activeLabel="Connected" inactiveLabel="Disconnected" /> : null}</div><p className="mt-1 max-w-36 break-all font-mono text-[9px] text-zinc-600">{record.id}</p></td><td className="px-4 py-4 capitalize text-orange-300">{textValue(record.role)}</td><td className="px-4 py-4"><select value={textValue(record.status, "waiting")} onChange={(event) => onStatus(collectionName, record.id, event.target.value)} className="rounded-lg border border-zinc-700 bg-black/60 px-2 py-1.5 font-mono text-[10px] text-white"><option value="waiting">waiting</option><option value="ready">ready</option><option value="checking">checking</option><option value="passed">passed</option><option value="failed">failed</option></select></td><td className="max-w-xs px-4 py-4 text-zinc-400"><p>{textValue(record.intent)}</p>{record.action ? <p className="mt-2 text-zinc-500">Action: {textValue(record.action)}</p> : null}{record.feedback ? <p className="mt-2 text-amber-300/70">{textValue(record.feedback)}</p> : null}</td>{showEvidence ? <td className="max-w-xs px-4 py-4 text-zinc-400">{textValue(record.clue, textValue(record.seed))}</td> : null}<td className="px-4 py-4 whitespace-nowrap text-zinc-500">{timestampValue(record.joinedAt)}</td><td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><RawRecord record={record} title="Raw" compact /><ActionButton compact onClick={() => onDisconnect(collectionName, record)} disabled={record.disconnected === true}>Disconnect</ActionButton><DangerButton compact onClick={() => onDelete(collectionName, record, `${textValue(record.name)}'s participant record`)}>Delete user</DangerButton></div></td></tr>)}</tbody>
        </table></div>
      )}
    </section>
  );
}

function EvidenceList({ records, onDelete }: { records: StoredRecord[]; onDelete: (collectionName: string, record: StoredRecord, label: string) => void }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-5"><div className="flex items-center justify-between"><h4 className="text-sm font-bold text-white">Recovered evidence ({records.length})</h4><span className="font-mono text-[10px] text-zinc-500">Chapter II → Chapter III RAG</span></div>
      {records.length === 0 ? <EmptyState text="No evidence fragments received yet." /> : <div className="mt-4 grid gap-3 md:grid-cols-2">{records.map((record) => { const protectedRecord = record.id === DRAGON_CLUE.id || record.protected === true; return <article key={record.id} className="rounded-xl border border-zinc-800 bg-black/30 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{textValue(record.playerName, "Unknown witness")}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-orange-300">{textValue(record.role)} · {textValue(record.artifact)}</p></div>{protectedRecord ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[9px] text-amber-300">SYSTEM</span> : null}</div><p className="mt-3 text-xs leading-5 text-zinc-400">{textValue(record.text)}</p><div className="mt-4 flex justify-end gap-2"><RawRecord record={record} title="Raw" compact />{!protectedRecord ? <DangerButton compact onClick={() => onDelete(DUNGEON_STAGE_2_CLUES, record, "this evidence fragment")}>Delete</DangerButton> : null}</div></article>; })}</div>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-zinc-800 bg-black/30 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{label}</p><p className="mt-1 break-words text-lg font-black capitalize text-white">{value}</p></div>;
}

function StatusPill({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return <span className={`rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold uppercase ${active ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-zinc-800/60 text-zinc-500"}`}>{active ? activeLabel : inactiveLabel}</span>;
}

function ActionButton({ children, onClick, disabled = false, compact = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; compact?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-xl border border-sky-500/35 bg-sky-500/10 font-bold text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-40 ${compact ? "px-2 py-1 text-[10px]" : "px-3.5 py-2 text-xs"}`}>{children}</button>;
}

function DangerButton({ children, onClick, disabled = false, compact = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; compact?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-lg border border-red-500/30 bg-red-500/10 font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-35 ${compact ? "px-2 py-1 text-[10px]" : "px-3.5 py-2 text-xs"}`}>{children}</button>;
}

function RawRecord({ record, title, compact = false }: { record: RecordValue; title: string; compact?: boolean }) {
  return <details className={compact ? "relative" : "mt-4"}><summary className={`cursor-pointer list-none rounded-lg border border-zinc-700 bg-zinc-800/70 font-mono text-zinc-300 ${compact ? "px-2 py-1 text-[10px]" : "px-3 py-2 text-xs"}`}>{title}</summary><pre className={`${compact ? "absolute right-0 z-30 mt-2 w-[min(78vw,520px)]" : "mt-2 w-full"} max-h-72 overflow-auto rounded-xl border border-zinc-700 bg-black p-3 text-left font-mono text-[10px] leading-5 text-emerald-300 shadow-2xl`}>{jsonValue(record)}</pre></details>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="col-span-full px-5 py-10 text-center font-mono text-xs text-zinc-600">{text}</div>;
}
