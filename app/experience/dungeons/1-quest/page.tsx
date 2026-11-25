"use client";

import { collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

import { firestore } from "@/lib/firebase";
import { DUNGEON_STAGE_1_PLAYERS, DUNGEON_STATE_COLLECTION, ROLE_DETAILS, isDungeonRole, roleForIndex, type DungeonPlayer, type DungeonRole } from "@/lib/dungeons";
import { DungeonShell, QuestHeader, RoleAvatar } from "../components/DungeonUi";

const STORAGE_KEY = "techeons-prompthons-stage-1-player";

export default function GateQuestPage() {
  const [name, setName] = useState("");
  const [player, setPlayer] = useState<DungeonPlayer | null>(null);
  const [active, setActive] = useState(false);
  const [statedRole, setStatedRole] = useState("");
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(doc(firestore, DUNGEON_STATE_COLLECTION, "stage-1"), (snapshot) => setActive(Boolean(snapshot.data()?.active))), []);

  useEffect(() => {
    const savedId = window.localStorage.getItem(STORAGE_KEY);
    if (!savedId) return;
    const playerRef = doc(firestore, DUNGEON_STAGE_1_PLAYERS, savedId);
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
      if (!isDungeonRole(data.role) || typeof data.name !== "string") return;
      setPlayer({
        id: snapshot.id,
        name: data.name,
        role: data.role,
        status: data.status === "passed" || data.status === "failed" || data.status === "checking" || data.status === "ready" ? data.status : "waiting",
        feedback: typeof data.feedback === "string" ? data.feedback : undefined,
      });
    });
  }, []);

  async function joinParty() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const playerRef = doc(collection(firestore, DUNGEON_STAGE_1_PLAYERS));
    const stateRef = doc(firestore, DUNGEON_STATE_COLLECTION, "stage-1");
    let assignedRole: DungeonRole = "warrior";
    try {
      await runTransaction(firestore, async (transaction) => {
        const state = await transaction.get(stateRef);
        const nextRoleIndex = Number(state.data()?.nextRoleIndex ?? 0);
        assignedRole = roleForIndex(nextRoleIndex);
        transaction.set(stateRef, { nextRoleIndex: nextRoleIndex + 1 }, { merge: true });
        transaction.set(playerRef, {
          name: name.trim().slice(0, 40),
          role: assignedRole,
          status: "waiting",
          joinedAt: serverTimestamp(),
        });
      });
      window.localStorage.setItem(STORAGE_KEY, playerRef.id);
      setPlayer({ id: playerRef.id, name: name.trim(), role: assignedRole, status: "waiting" });
      setStatedRole(ROLE_DETAILS[assignedRole].title);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "The party ledger could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPrompt() {
    if (!player || !intent.trim() || !statedRole.trim()) return;
    setBusy(true);
    setError("");
    await updateDoc(doc(firestore, DUNGEON_STAGE_1_PLAYERS, player.id), { status: "checking", intent: intent.trim() });
    setPlayer((current) => current ? { ...current, status: "checking" } : current);
    try {
      const response = await fetch("/api/dungeons/gate-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedRole: player.role, statedRole, intent }),
      });
      const result = await response.json() as { pass?: boolean; reason?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "The gate did not answer.");
      const status = result.pass ? "passed" : "failed";
      await updateDoc(doc(firestore, DUNGEON_STAGE_1_PLAYERS, player.id), {
        status,
        feedback: result.reason || "The gate has judged your prompt.",
        checkedAt: serverTimestamp(),
      });
      setPlayer((current) => current ? { ...current, status, feedback: result.reason || "The gate has judged your prompt." } : current);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The gate could not judge the prompt.");
      await updateDoc(doc(firestore, DUNGEON_STAGE_1_PLAYERS, player.id), { status: "ready" });
      setPlayer((current) => current ? { ...current, status: "ready" } : current);
    } finally {
      setBusy(false);
    }
  }

  if (player?.status === "passed") {
    return (
      <DungeonShell background="/experience/dungeons/city-gate.png">
        <div className="grid min-h-[100dvh] place-items-center p-6">
          <section className="dungeon-panel dungeon-pass max-w-md rounded-3xl border-emerald-400/70 p-8 text-center">
            <div className="mx-auto w-fit"><RoleAvatar role={player.role} size="lg" /></div>
            <p className="dungeon-kicker mt-6 text-emerald-300">The gate accepts your command</p>
            <h1 className="mt-3 text-4xl font-bold">Pass granted</h1>
            <p className="mt-4 leading-7 text-white/65">{player.feedback}</p>
            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">This quest screen is now sealed</p>
          </section>
        </div>
      </DungeonShell>
    );
  }

  return (
    <DungeonShell background="/experience/dungeons/city-gate.png">
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center p-5 py-12">
        <section className="dungeon-panel rounded-3xl p-6 sm:p-8">
          <QuestHeader chapter="Chapter I" title="Petition the Gate" />

          {!player ? (
            <div className="mt-8">
              <label className="dungeon-kicker" htmlFor="adventurer-name">Adventurer name</label>
              <input id="adventurer-name" value={name} onChange={(event) => setName(event.target.value)} className="dungeon-input mt-2 px-4 py-3" maxLength={40} placeholder="Name yourself" />
              <button type="button" onClick={() => void joinParty()} disabled={busy || !name.trim()} className="dungeon-button mt-4 w-full rounded-xl px-5 py-4 text-xs">{busy ? "Writing your name…" : "Join the party"}</button>
            </div>
          ) : (
            <div className="mt-7">
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/40 p-4">
                <RoleAvatar role={player.role} />
                <div>
                  <p className="dungeon-kicker">Assigned role</p>
                  <h2 className="text-2xl font-bold" style={{ color: ROLE_DETAILS[player.role].color }}>{ROLE_DETAILS[player.role].title}</h2>
                  <p className="mt-1 text-xs leading-5 text-white/45">{ROLE_DETAILS[player.role].lore}</p>
                </div>
              </div>

              {!active ? (
                <div className="mt-6 rounded-2xl border border-[#d9bd7d]/25 bg-black/45 p-5 text-center">
                  <p className="animate-pulse font-mono text-xs uppercase tracking-[0.16em] text-[#d9bd7d]">Awaiting the gatekeeper</p>
                  <p className="mt-2 text-sm text-white/45">Your prompt will unlock when the host activates the trial.</p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="dungeon-kicker" htmlFor="stated-role">State your role</label>
                    <input id="stated-role" value={statedRole} onChange={(event) => setStatedRole(event.target.value)} className="dungeon-input mt-2 px-4 py-3" placeholder="I am a…" />
                  </div>
                  <div>
                    <label className="dungeon-kicker" htmlFor="gate-intent">What do you intend to do?</label>
                    <textarea id="gate-intent" value={intent} onChange={(event) => setIntent(event.target.value)} className="dungeon-input mt-2 min-h-32 resize-none px-4 py-3" placeholder="Describe how you will try to open the city gate…" />
                  </div>
                  {player.status === "failed" && player.feedback ? <p className="rounded-xl border border-red-400/30 bg-red-950/35 p-3 text-sm text-red-200">{player.feedback}</p> : null}
                  <button type="button" onClick={() => void submitPrompt()} disabled={busy || !intent.trim() || !statedRole.trim()} className="dungeon-button w-full rounded-xl px-5 py-4 text-xs">{busy ? "The gate is judging…" : "Speak the prompt"}</button>
                </div>
              )}
            </div>
          )}
          {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
        </section>
      </div>
    </DungeonShell>
  );
}
