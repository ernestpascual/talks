"use client";

import { collection, doc, getDocsFromServer, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DUNGEON_STAGE_2_CLUES, DUNGEON_STAGE_2_PLAYERS, DRAGON_CLUE, ELDERS, isDungeonRole, type DungeonClue, type DungeonRole } from "@/lib/dungeons";
import { firestore } from "@/lib/firebase";
import { BackToCampaign, DungeonShell, QuestHeader } from "../components/DungeonUi";
import { useElderLive } from "../components/useElderLive";

type RagPlayerRecord = {
  name: string;
  role: DungeonRole;
  seed: string;
  intent: string;
  action: string;
  clue: string;
};

function buildRagCorpus(clues: DungeonClue[], players: RagPlayerRecord[]) {
  const evidenceEntries = clues.map((clue, index) => [
    `EVIDENCE ${index + 1}`,
    `Witness: ${clue.playerName}`,
    `Role: ${clue.role}`,
    `Artifact: ${clue.artifact}`,
    `Recovered account: ${clue.text}`,
  ].join("\n"));

  const playerEntries = players.map((player, index) => [
    `PARTY RECORD ${index + 1}`,
    `Adventurer: ${player.name}`,
    `Assigned role: ${player.role}`,
    `Original evidence seed: ${player.seed || "Not recorded"}`,
    `Declared intent: ${player.intent || "Not recorded"}`,
    `Declared action: ${player.action || "Not recorded"}`,
    `Recovered clue: ${player.clue || "Not yet recovered"}`,
  ].join("\n"));

  return [
    "TECHEONS & PROMPTONS — COMPLETE FIRESTORE RAG CORPUS",
    `Evidence fragments: ${clues.length}`,
    `Party records: ${players.length}`,
    "",
    "=== RECOVERED EVIDENCE ===",
    ...evidenceEntries,
    "",
    "=== PARTY SEARCH RECORDS ===",
    ...playerEntries,
  ].join("\n\n");
}

export default function EldersPage() {
  const [clues, setClues] = useState<DungeonClue[]>([]);
  const [selectedId, setSelectedId] = useState<(typeof ELDERS)[number]["id"]>("batt");
  const [battleCalled, setBattleCalled] = useState(false);
  const [ragPreparing, setRagPreparing] = useState(false);
  const [ragError, setRagError] = useState("");
  const live = useElderLive();
  const selectedElder = ELDERS.find((elder) => elder.id === selectedId) || ELDERS[0];

  useEffect(() => {
    void setDoc(doc(firestore, DUNGEON_STAGE_2_CLUES, DRAGON_CLUE.id), { ...DRAGON_CLUE, createdAt: serverTimestamp(), protected: true }, { merge: true });
    const cluesQuery = query(collection(firestore, DUNGEON_STAGE_2_CLUES), orderBy("createdAt", "asc"));
    return onSnapshot(cluesQuery, (snapshot) => setClues(snapshot.docs.flatMap((clueDoc) => {
      const data = clueDoc.data();
      if (typeof data.text !== "string" || typeof data.playerName !== "string") return [];
      return [{ id: clueDoc.id, text: data.text, playerName: data.playerName, role: isDungeonRole(data.role) ? data.role : "elder", artifact: typeof data.artifact === "string" ? data.artifact : "evidence" } satisfies DungeonClue];
    })));
  }, []);

  const evidencePreview = useMemo(() => clues.map((clue, index) => `${index + 1}. [${clue.artifact}; ${clue.playerName}] ${clue.text}`).join("\n"), [clues]);
  const talking = live.status === "connecting" || live.status === "listening" || live.status === "speaking";

  function selectElder(id: (typeof ELDERS)[number]["id"]) {
    if (talking) live.stop();
    setSelectedId(id);
  }

  async function loadCompleteRagCorpus() {
    const cluesQuery = query(collection(firestore, DUNGEON_STAGE_2_CLUES), orderBy("createdAt", "asc"));
    const playersQuery = query(collection(firestore, DUNGEON_STAGE_2_PLAYERS), orderBy("joinedAt", "asc"));
    const [clueSnapshot, playerSnapshot] = await Promise.all([
      getDocsFromServer(cluesQuery),
      getDocsFromServer(playersQuery),
    ]);

    const completeClues = clueSnapshot.docs.flatMap((clueDoc) => {
      const data = clueDoc.data();
      if (typeof data.text !== "string" || typeof data.playerName !== "string") return [];
      return [{
        id: clueDoc.id,
        text: data.text,
        playerName: data.playerName,
        role: isDungeonRole(data.role) ? data.role : "elder",
        artifact: typeof data.artifact === "string" ? data.artifact : "evidence",
      } satisfies DungeonClue];
    });

    const completePlayers = playerSnapshot.docs.flatMap((playerDoc) => {
      const data = playerDoc.data();
      if (typeof data.name !== "string" || !isDungeonRole(data.role)) return [];
      return [{
        name: data.name,
        role: data.role,
        seed: typeof data.seed === "string" ? data.seed : "",
        intent: typeof data.intent === "string" ? data.intent : "",
        action: typeof data.action === "string" ? data.action : "",
        clue: typeof data.clue === "string" ? data.clue : "",
      } satisfies RagPlayerRecord];
    });

    setClues(completeClues);
    return buildRagCorpus(completeClues, completePlayers);
  }

  async function toggleTalk() {
    if (talking) {
      live.stop();
      return;
    }

    setRagPreparing(true);
    setRagError("");
    try {
      const completeCorpus = await loadCompleteRagCorpus();
      await live.start(selectedElder, completeCorpus);
    } catch (error) {
      setRagError(error instanceof Error ? error.message : "The complete Firestore record could not be loaded.");
    } finally {
      setRagPreparing(false);
    }
  }

  function finishTalking() {
    live.stop();
    setBattleCalled(true);
  }

  return (
    <DungeonShell background="/experience/dungeons/elder-hall.png">
      <BackToCampaign />
      <div className="mx-auto flex min-h-[100dvh] max-w-[1500px] flex-col px-5 py-8">
        <QuestHeader chapter="Chapter III" title="The Four Elders" />
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-6 text-white/60">Ask what happened. Each elder can speak only from the complete Firestore RAG: {clues.length} recovered fragments currently loaded.</p>

        <div className="mt-7 grid flex-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
          <aside className="dungeon-panel rounded-2xl p-4">
            <p className="dungeon-kicker">Choose an elder</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {ELDERS.map((elder) => (
                <button key={elder.id} type="button" onClick={() => selectElder(elder.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selectedId === elder.id ? "border-[#d9bd7d]/70 bg-[#8a612b]/25" : "border-white/10 bg-black/35 hover:border-white/25"}`}>
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-[#d9bd7d]/40 bg-black text-2xl text-[#d9bd7d]">{elder.glyph}</span>
                  <span><span className="block text-lg font-bold">{elder.name}</span><span className="block text-[10px] text-white/40">{elder.title}</span></span>
                </button>
              ))}
            </div>
          </aside>

          <section className="dungeon-panel flex min-h-[430px] flex-col items-center justify-center rounded-3xl p-7 text-center">
            <div className={`grid h-28 w-28 place-items-center rounded-full border-2 bg-black/70 text-6xl text-[#d9bd7d] transition ${talking ? "dungeon-pass border-emerald-400" : "border-[#d9bd7d]/45"}`}>{selectedElder.glyph}</div>
            <p className="dungeon-kicker mt-5">{selectedElder.title}</p>
            <h2 className="mt-1 text-4xl font-bold">{selectedElder.name}</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/50">{selectedElder.personality}</p>

            <button type="button" role="switch" aria-checked={talking} onClick={() => void toggleTalk()} disabled={live.status === "connecting" || ragPreparing} className={`mt-7 flex w-full max-w-sm items-center justify-between rounded-full border px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider transition ${talking ? "border-emerald-400/70 bg-emerald-950/55 text-emerald-200" : "border-[#d9bd7d]/45 bg-black/50 text-[#ead39b]"}`}>
              <span>{ragPreparing ? "Loading complete RAG…" : live.status === "connecting" ? "Opening the channel…" : talking ? "Voice channel active" : "Talk to this elder"}</span>
              <span className={`relative h-7 w-12 rounded-full transition ${talking ? "bg-emerald-500" : "bg-white/15"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${talking ? "left-6" : "left-1"}`} /></span>
            </button>
            {live.error || ragError ? <p className="mt-3 text-sm text-red-300">{live.error || ragError}</p> : null}
          </section>

          <aside className="dungeon-panel flex max-h-[70dvh] flex-col rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3"><p className="dungeon-kicker">The living record</p><span className="font-mono text-[9px] text-emerald-300/70">RAG · {evidencePreview ? "READY" : "EMPTY"}</span></div>
            <div className="mt-3 flex-1 space-y-3 overflow-auto">
              <div className="rounded-xl border border-white/10 bg-black/40 p-3"><p className="font-mono text-[9px] uppercase tracking-wider text-white/35">You</p><p className="mt-1 min-h-10 text-sm leading-6 text-white/70">{live.userTranscript || "Your question will appear here."}</p></div>
              <div className="dungeon-scroll rounded-xl p-4"><p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#6f4a1f]">{selectedElder.name}</p><p className="mt-2 min-h-24 text-sm leading-6">{live.elderTranscript || "The elder waits in silence."}</p></div>
            </div>
            <button type="button" onClick={finishTalking} className="dungeon-button mt-4 rounded-xl px-4 py-3 text-[10px]">Finish talking to elders</button>
          </aside>
        </div>
      </div>

      {battleCalled ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/88 p-6 backdrop-blur-md">
          <section className="dungeon-panel dungeon-pass max-w-3xl rounded-3xl border-red-400/50 p-9 text-center">
            <p className="dungeon-kicker text-red-300">The truth is assembled</p>
            <h2 className="dungeon-title mt-3 text-5xl sm:text-7xl">Call the party to battle</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-white/65">The stolen crystal waits beyond the northern mountain. Gather every warrior, mage, and archer—the dragon must fall.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/experience/dungeons/4" className="dungeon-button rounded-xl px-6 py-4 text-xs">Enter the battlefield →</Link>
              <button type="button" onClick={() => setBattleCalled(false)} className="rounded-xl border border-white/15 bg-black/45 px-5 py-3 font-mono text-xs uppercase tracking-wider text-white/60">Return to the council</button>
            </div>
          </section>
        </div>
      ) : null}
    </DungeonShell>
  );
}
