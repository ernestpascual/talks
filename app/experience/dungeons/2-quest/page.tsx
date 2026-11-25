"use client";

import { collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { DUNGEON_STAGE_2_CLUES, DUNGEON_STAGE_2_PLAYERS, DUNGEON_STATE_COLLECTION, DRAGON_CLUE, ROLE_DETAILS, isDungeonRole, roleClueSeed, roleForIndex, type DungeonPlayer, type DungeonRole } from "@/lib/dungeons";
import { firestore } from "@/lib/firebase";
import { DungeonShell, QuestHeader, RoleAvatar } from "../components/DungeonUi";

const STORAGE_KEY = "techeons-prompthons-stage-2-player";

type StageTwoPlayer = DungeonPlayer & { seed: string; assignmentIndex: number };

export default function RuinsQuestPage() {
  const [name, setName] = useState("");
  const [player, setPlayer] = useState<StageTwoPlayer | null>(null);
  const [intent, setIntent] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void setDoc(doc(firestore, DUNGEON_STAGE_2_CLUES, DRAGON_CLUE.id), { ...DRAGON_CLUE, createdAt: serverTimestamp(), protected: true }, { merge: true });
    const savedId = window.localStorage.getItem(STORAGE_KEY);
    if (!savedId) return;
    const playerRef = doc(firestore, DUNGEON_STAGE_2_PLAYERS, savedId);
    void getDoc(playerRef).then((snapshot) => {
      if (!snapshot.exists()) window.localStorage.removeItem(STORAGE_KEY);
    });
    return onSnapshot(playerRef, (snapshot) => {
      if (!snapshot.exists()) {
        window.localStorage.removeItem(STORAGE_KEY);
        setPlayer(null);
        return;
      }
      const data = snapshot.data();
      if (data.disconnected === true) {
        window.localStorage.removeItem(STORAGE_KEY);
        setPlayer(null);
        setError("The dungeon master disconnected this quest session. You may join again.");
        return;
      }
      if (!isDungeonRole(data.role) || typeof data.name !== "string" || typeof data.seed !== "string") return;
      setPlayer({
        id: snapshot.id,
        name: data.name,
        role: data.role,
        status: data.status === "passed" || data.status === "failed" || data.status === "checking" ? data.status : "ready",
        feedback: typeof data.feedback === "string" ? data.feedback : undefined,
        clue: typeof data.clue === "string" ? data.clue : undefined,
        seed: data.seed,
        assignmentIndex: Number(data.assignmentIndex ?? 0),
      });
    });
  }, []);

  async function joinQuest() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const playerRef = doc(collection(firestore, DUNGEON_STAGE_2_PLAYERS));
    const stateRef = doc(firestore, DUNGEON_STATE_COLLECTION, "stage-2");
    let assignedRole: DungeonRole = "warrior";
    let assignmentIndex = 0;
    let seed = "";
    try {
      await runTransaction(firestore, async (transaction) => {
        const state = await transaction.get(stateRef);
        assignmentIndex = Number(state.data()?.nextRoleIndex ?? 0);
        assignedRole = roleForIndex(assignmentIndex);
        seed = roleClueSeed(assignedRole, assignmentIndex);
        transaction.set(stateRef, { nextRoleIndex: assignmentIndex + 1 }, { merge: true });
        transaction.set(playerRef, {
          name: name.trim().slice(0, 40),
          role: assignedRole,
          status: "ready",
          seed,
          assignmentIndex,
          joinedAt: serverTimestamp(),
        });
      });
      window.localStorage.setItem(STORAGE_KEY, playerRef.id);
      setPlayer({ id: playerRef.id, name: name.trim(), role: assignedRole, status: "ready", seed, assignmentIndex });
      setAction(ROLE_DETAILS[assignedRole].action);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "The town ledger could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  async function recoverEvidence() {
    if (!player || !intent.trim() || !action.trim()) return;
    setBusy(true);
    setError("");
    const playerRef = doc(firestore, DUNGEON_STAGE_2_PLAYERS, player.id);
    await updateDoc(playerRef, {
      status: "checking",
      intent: intent.trim(),
      action: action.trim(),
    });
    setPlayer((current) => current ? { ...current, status: "checking" } : current);
    try {
      const response = await fetch("/api/dungeons/reconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: player.role, intent, action, seed: player.seed, playerName: player.name }),
      });
      const result = await response.json() as { pass?: boolean; reason?: string; fragment?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "The evidence could not be read.");
      if (!result.pass || !result.fragment) {
        await updateDoc(playerRef, { status: "failed", feedback: result.reason || "Use the required prompt format." });
        setPlayer((current) => current ? { ...current, status: "failed", feedback: result.reason || "Use the required prompt format." } : current);
        return;
      }
      const clueRef = doc(collection(firestore, DUNGEON_STAGE_2_CLUES));
      await setDoc(clueRef, {
        playerId: player.id,
        playerName: player.name,
        role: player.role,
        artifact: ROLE_DETAILS[player.role].artifact,
        text: result.fragment,
        createdAt: serverTimestamp(),
      });
      await updateDoc(playerRef, { status: "passed", feedback: result.reason, clue: result.fragment, submittedAt: serverTimestamp() });
      setPlayer((current) => current ? { ...current, status: "passed", feedback: result.reason, clue: result.fragment } : current);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The evidence could not be recovered.");
      await updateDoc(playerRef, { status: "ready" });
      setPlayer((current) => current ? { ...current, status: "ready" } : current);
    } finally {
      setBusy(false);
    }
  }

  if (player?.status === "passed") {
    return (
      <DungeonShell background="/experience/dungeons/ruined-town.png">
        <div className="grid min-h-[100dvh] place-items-center p-5">
          <section className="dungeon-panel dungeon-pass max-w-xl rounded-3xl border-emerald-400/60 p-7 text-center">
            <div className="mx-auto w-fit"><RoleAvatar role={player.role} size="lg" /></div>
            <p className="dungeon-kicker mt-5 text-emerald-300">Evidence delivered</p>
            <h1 className="mt-2 text-3xl font-bold">The elders will remember</h1>
            <p className="dungeon-scroll mt-6 rounded-2xl p-5 text-left leading-7">{player.clue}</p>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">This quest screen is now sealed</p>
          </section>
        </div>
      </DungeonShell>
    );
  }

  return (
    <DungeonShell background="/experience/dungeons/ruined-town.png">
      <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center p-5 py-12">
        <section className="dungeon-panel rounded-3xl p-6 sm:p-8">
          <QuestHeader chapter="Chapter II" title="Recover a Memory" />
          {!player ? (
            <div className="mt-8">
              <label className="dungeon-kicker" htmlFor="ruins-name">Adventurer name</label>
              <input id="ruins-name" value={name} onChange={(event) => setName(event.target.value)} className="dungeon-input mt-2 px-4 py-3" maxLength={40} placeholder="Name yourself" />
              <button type="button" onClick={() => void joinQuest()} disabled={busy || !name.trim()} className="dungeon-button mt-4 w-full rounded-xl px-5 py-4 text-xs">{busy ? "Drawing lots…" : "Receive your role"}</button>
            </div>
          ) : (
            <div className="mt-7 space-y-5">
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/45 p-4">
                <RoleAvatar role={player.role} />
                <div><p className="dungeon-kicker">You returned as</p><h2 className="text-2xl font-bold" style={{ color: ROLE_DETAILS[player.role].color }}>{ROLE_DETAILS[player.role].title}</h2><p className="text-xs text-white/45">Search your {ROLE_DETAILS[player.role].artifact}.</p></div>
              </div>
              <div className="dungeon-scroll rounded-2xl p-5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#715126]">A fragment caught your attention</p>
                <p className="mt-2 leading-6">{player.seed}</p>
              </div>
              <div className="rounded-xl border border-[#d9bd7d]/20 bg-black/35 p-4 font-mono text-[10px] leading-5 text-white/50">
                Prompt format: <span className="text-[#e7cb8a]">role</span> + <span className="text-[#e7cb8a]">intent: discover what happened</span> + <span className="text-[#e7cb8a]">{ROLE_DETAILS[player.role].action}</span>
              </div>
              <div>
                <label className="dungeon-kicker" htmlFor="memory-intent">Your intent</label>
                <textarea id="memory-intent" value={intent} onChange={(event) => setIntent(event.target.value)} className="dungeon-input mt-2 min-h-24 resize-none px-4 py-3" placeholder="As a warrior/mage/archer, I intend to learn what happened…" />
              </div>
              <div>
                <label className="dungeon-kicker" htmlFor="memory-action">Your action</label>
                <input id="memory-action" value={action} onChange={(event) => setAction(event.target.value)} className="dungeon-input mt-2 px-4 py-3" placeholder={ROLE_DETAILS[player.role].action} />
              </div>
              {player.status === "failed" && player.feedback ? <p className="rounded-xl border border-red-400/30 bg-red-950/35 p-3 text-sm text-red-200">{player.feedback}</p> : null}
              <button type="button" onClick={() => void recoverEvidence()} disabled={busy || !intent.trim() || !action.trim()} className="dungeon-button w-full rounded-xl px-5 py-4 text-xs">{busy ? "The memory is forming…" : "Recover the evidence"}</button>
            </div>
          )}
          {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
        </section>
      </div>
    </DungeonShell>
  );
}
