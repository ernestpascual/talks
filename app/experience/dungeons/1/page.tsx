"use client";

import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";

import { firestore } from "@/lib/firebase";
import { DUNGEON_STAGE_1_PLAYERS, DUNGEON_STATE_COLLECTION, isDungeonRole, type DungeonPlayer } from "@/lib/dungeons";
import { BackToCampaign, DungeonShell, QuestHeader, QuestQr, RoleAvatar } from "../components/DungeonUi";

export default function GateHostPage() {
  const [players, setPlayers] = useState<DungeonPlayer[]>([]);
  const [active, setActive] = useState(false);
  const [activating, setActivating] = useState(false);
  const passedCount = players.filter((player) => player.status === "passed").length;
  const allPassed = players.length > 0 && passedCount === players.length;

  useEffect(() => {
    const stateRef = doc(firestore, DUNGEON_STATE_COLLECTION, "stage-1");
    void setDoc(stateRef, { initializedAt: serverTimestamp() }, { merge: true });
    return onSnapshot(stateRef, (snapshot) => setActive(Boolean(snapshot.data()?.active)));
  }, []);

  useEffect(() => {
    const playersQuery = query(collection(firestore, DUNGEON_STAGE_1_PLAYERS), orderBy("joinedAt", "asc"));
    return onSnapshot(playersQuery, (snapshot) => {
      setPlayers(snapshot.docs.flatMap((playerDoc) => {
        const data = playerDoc.data();
        if (data.disconnected === true) return [];
        if (typeof data.name !== "string" || !isDungeonRole(data.role)) return [];
        return [{
          id: playerDoc.id,
          name: data.name,
          role: data.role,
          status: data.status === "passed" || data.status === "failed" || data.status === "checking" || data.status === "ready" ? data.status : "waiting",
          intent: typeof data.intent === "string" ? data.intent : undefined,
          feedback: typeof data.feedback === "string" ? data.feedback : undefined,
        } satisfies DungeonPlayer];
      }));
    });
  }, []);

  async function activateGateTrial() {
    setActivating(true);
    try {
      await setDoc(doc(firestore, DUNGEON_STATE_COLLECTION, "stage-1"), {
        active: true,
        activatedAt: serverTimestamp(),
      }, { merge: true });
    } finally {
      setActivating(false);
    }
  }

  function removePlayer(player: DungeonPlayer) {
    if (!window.confirm(`Remove ${player.name} from Chapter I? They will be able to scan and join again.`)) return;
    void deleteDoc(doc(firestore, DUNGEON_STAGE_1_PLAYERS, player.id));
  }

  return (
    <DungeonShell background="/experience/dungeons/city-gate.png">
      <BackToCampaign />
      <div className="mx-auto grid min-h-[100dvh] max-w-[1500px] gap-6 px-6 py-8 lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:items-end">
        <QuestQr path="/experience/dungeons/1-quest" label="Join chapter one" />

        <section className="pb-4 text-center lg:pb-10">
          <QuestHeader chapter="Chapter I" title="The Sealed Gate" />
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
            The city recognizes neither strength nor magic alone. Every adventurer must declare who they are and how they intend to open the way.
          </p>
          <button
            type="button"
            onClick={() => void activateGateTrial()}
            disabled={active || activating || players.length === 0}
            className="dungeon-button mt-7 rounded-xl px-8 py-4 text-sm"
          >
            {active ? "The trial is active" : activating ? "Awakening the gate…" : "Activate all prompts"}
          </button>
          <div className={`mx-auto mt-5 h-2 max-w-lg overflow-hidden rounded-full border border-white/10 bg-black/60 ${allPassed ? "dungeon-pass" : ""}`}>
            <div
              className={`h-full transition-all duration-700 ${allPassed ? "bg-emerald-400" : "bg-[#d9bd7d]"}`}
              style={{ width: `${players.length > 0 ? (passedCount / players.length) * 100 : 0}%` }}
            />
          </div>
          {active ? <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/45">{passedCount} of {players.length} adventurers passed</p> : null}
          {allPassed ? (
            <Link href="/experience/dungeons/2" className="dungeon-button mt-6 inline-block rounded-xl px-8 py-4 text-sm">
              Continue to Chapter II →
            </Link>
          ) : null}
        </section>

        <aside className="dungeon-panel max-h-[76dvh] overflow-auto rounded-2xl p-4">
          <div className="flex items-end justify-between border-b border-white/10 pb-3">
            <div>
              <p className="dungeon-kicker">Party roster</p>
              <h2 className="mt-1 text-xl font-bold">At the gate</h2>
            </div>
            <span className="font-mono text-xs text-[#d9bd7d]">{players.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {players.length === 0 ? <p className="py-8 text-center text-sm text-white/40">Waiting for adventurers…</p> : null}
            {players.map((player) => (
              <article key={player.id} className={`flex items-center gap-3 rounded-xl border p-3 ${player.status === "passed" ? "dungeon-pass border-emerald-400/70 bg-emerald-950/45" : "border-white/10 bg-black/35"}`}>
                <RoleAvatar role={player.role} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{player.name}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">{player.role}</p>
                </div>
                <span className={`h-3 w-3 rounded-full border ${player.status === "passed" ? "border-emerald-200 bg-emerald-400 shadow-[0_0_14px_#4ade80]" : player.status === "failed" ? "border-red-200 bg-red-500" : "border-[#d9bd7d]/50 bg-black"}`} aria-label={player.status} />
                <button type="button" onClick={() => removePlayer(player)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-red-400/30 bg-red-950/45 font-mono text-xs text-red-300 transition hover:bg-red-500 hover:text-white" aria-label={`Remove ${player.name}`}>×</button>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </DungeonShell>
  );
}
