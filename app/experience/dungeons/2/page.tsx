"use client";

import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { DUNGEON_STAGE_2_CLUES, DUNGEON_STAGE_2_PLAYERS, DRAGON_CLUE, ELDERS, isDungeonRole, type DungeonClue, type DungeonPlayer } from "@/lib/dungeons";
import { firestore } from "@/lib/firebase";
import { BackToCampaign, DungeonShell, QuestHeader, QuestQr, RoleAvatar } from "../components/DungeonUi";

export default function RuinsHostPage() {
  const [players, setPlayers] = useState<DungeonPlayer[]>([]);
  const [clues, setClues] = useState<DungeonClue[]>([]);

  useEffect(() => {
    void setDoc(doc(firestore, DUNGEON_STAGE_2_CLUES, DRAGON_CLUE.id), {
      ...DRAGON_CLUE,
      createdAt: serverTimestamp(),
      protected: true,
    }, { merge: true });
  }, []);

  function removePlayer(player: DungeonPlayer) {
    if (!window.confirm(`Remove ${player.name} from Chapter II? They will be able to scan and join again.`)) return;
    void deleteDoc(doc(firestore, DUNGEON_STAGE_2_PLAYERS, player.id));
  }

  useEffect(() => {
    const playersQuery = query(collection(firestore, DUNGEON_STAGE_2_PLAYERS), orderBy("joinedAt", "asc"));
    return onSnapshot(playersQuery, (snapshot) => setPlayers(snapshot.docs.flatMap((playerDoc) => {
      const data = playerDoc.data();
      if (data.disconnected === true) return [];
      if (typeof data.name !== "string" || !isDungeonRole(data.role)) return [];
      return [{ id: playerDoc.id, name: data.name, role: data.role, status: data.status === "passed" ? "passed" : "waiting" } satisfies DungeonPlayer];
    })));
  }, []);

  useEffect(() => {
    const cluesQuery = query(collection(firestore, DUNGEON_STAGE_2_CLUES), orderBy("createdAt", "asc"));
    return onSnapshot(cluesQuery, (snapshot) => setClues(snapshot.docs.flatMap((clueDoc) => {
      const data = clueDoc.data();
      if (typeof data.text !== "string" || typeof data.playerName !== "string") return [];
      return [{
        id: clueDoc.id,
        text: data.text,
        playerName: data.playerName,
        role: isDungeonRole(data.role) ? data.role : "elder",
        artifact: typeof data.artifact === "string" ? data.artifact : "unknown evidence",
      } satisfies DungeonClue];
    })));
  }, []);

  return (
    <DungeonShell background="/experience/dungeons/ruined-town.png">
      <BackToCampaign />
      <div className="mx-auto grid min-h-[100dvh] max-w-[1600px] gap-5 px-5 py-7 xl:grid-cols-[280px_minmax(0,1fr)_380px] xl:items-end">
        <div className="space-y-4">
          <QuestQr path="/experience/dungeons/2-quest" label="Join chapter two" />
          <div className="dungeon-panel rounded-2xl p-4">
            <p className="dungeon-kicker">The last four</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {ELDERS.map((elder) => <div key={elder.id} className="rounded-xl border border-white/10 bg-black/40 p-3 text-center"><span className="text-2xl text-[#d9bd7d]">{elder.glyph}</span><p className="mt-1 font-bold">{elder.name}</p><p className="text-[9px] text-white/40">{elder.title}</p></div>)}
            </div>
          </div>
        </div>

        <section className="pb-4 text-center xl:pb-9">
          <QuestHeader chapter="Chapter II" title="Ashes Remember" />
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">Batt, Arto, Durst, and Sbor survived—but memory reaches them only in fragments. Bring the evidence you found on the road and help the town remember.</p>
          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
            {players.map((player) => (
              <div key={player.id} className={`flex items-center gap-2 rounded-full border py-2 pl-3 pr-2 ${player.status === "passed" ? "border-emerald-400/50 bg-emerald-950/45" : "border-white/10 bg-black/50"}`}>
                <RoleAvatar role={player.role} size="sm" />
                <span className="text-sm font-bold">{player.name}</span>
                <button type="button" onClick={() => removePlayer(player)} className="grid h-7 w-7 place-items-center rounded-full border border-red-400/30 bg-red-950/45 font-mono text-xs text-red-300 transition hover:bg-red-500 hover:text-white" aria-label={`Remove ${player.name}`}>×</button>
              </div>
            ))}
          </div>
        </section>

        <aside className="dungeon-panel max-h-[82dvh] overflow-auto rounded-2xl p-4">
          <div className="sticky top-0 z-10 -mx-1 border-b border-white/10 bg-[#0b0e0c]/95 px-1 pb-3 backdrop-blur">
            <p className="dungeon-kicker">Recovered evidence</p>
            <h2 className="mt-1 text-xl font-bold">{clues.length} fragments</h2>
          </div>
          <div className="mt-3 space-y-3">
            {clues.map((clue) => (
              <article key={clue.id} className="dungeon-scroll rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 font-mono text-[9px] font-bold uppercase tracking-wider text-[#62451f]">
                  <span>{clue.playerName}</span><span>{clue.artifact}</span>
                </div>
                <p className="mt-3 text-sm leading-6">{clue.text}</p>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </DungeonShell>
  );
}
