"use client";

import { addDoc, collection, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import {
  CELEBRATION_GROUND_FINDINGS,
  DEFAULT_CELEBRATION_BOARD,
  DUNGEON_ROLES,
  DUNGEON_STAGE_5_SUBMISSIONS,
  DUNGEON_STATE_COLLECTION,
  ROLE_DETAILS,
  normalizeCelebrationBoard,
  type CelebrationBoard,
  type DungeonRole,
} from "@/lib/dungeons";
import { firestore } from "@/lib/firebase";
import { DungeonShell, QuestHeader, RoleAvatar } from "../components/DungeonUi";

export default function BardQuestPage() {
  const [role, setRole] = useState<DungeonRole | null>(null);
  const [groundFinding, setGroundFinding] = useState("");
  const [songWish, setSongWish] = useState("");
  const [lyricLimitations, setLyricLimitations] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const random = new Uint32Array(2);
      window.crypto.getRandomValues(random);
      setRole(DUNGEON_ROLES[random[0] % DUNGEON_ROLES.length]);
      setGroundFinding(CELEBRATION_GROUND_FINDINGS[random[1] % CELEBRATION_GROUND_FINDINGS.length]);
    });
    const stateRef = doc(firestore, DUNGEON_STATE_COLLECTION, "stage-5");
    void getDoc(stateRef).then((snapshot) => {
      if (!snapshot.exists()) void setDoc(stateRef, { ...DEFAULT_CELEBRATION_BOARD, initializedAt: serverTimestamp() });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const composedPrompt = useMemo(() => role ? `I am the ${role}. I want ${songWish.trim() || "[your musical idea]"} in the victory song. The lyrics must ${lyricLimitations.trim() || "[your lyric limitation]"}. On the ground I found ${groundFinding}.` : "", [groundFinding, lyricLimitations, role, songWish]);

  async function submitContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || !songWish.trim() || !lyricLimitations.trim() || busy) return;
    setBusy(true);
    setError("");
    const submissionRef = await addDoc(collection(firestore, DUNGEON_STAGE_5_SUBMISSIONS), {
      role,
      songWish: songWish.trim().slice(0, 500),
      lyricLimitations: lyricLimitations.trim().slice(0, 500),
      groundFinding,
      prompt: composedPrompt,
      status: "processing",
      createdAt: serverTimestamp(),
    });

    try {
      const stateRef = doc(firestore, DUNGEON_STATE_COLLECTION, "stage-5");
      let committedBoard: CelebrationBoard | null = null;
      for (let attempt = 0; attempt < 4 && !committedBoard; attempt += 1) {
        const stateSnapshot = await getDoc(stateRef);
        const currentBoard = normalizeCelebrationBoard(stateSnapshot.data());
        const response = await fetch("/api/dungeons/celebration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            board: currentBoard,
            submission: { role, songWish: songWish.trim(), lyricLimitations: lyricLimitations.trim(), groundFinding, prompt: composedPrompt },
          }),
        });
        const result = await response.json() as { success?: boolean; board?: CelebrationBoard; error?: string };
        if (!response.ok || !result.success || !result.board) throw new Error(result.error || "The bard could not revise the song.");

        let didCommit = false;
        await runTransaction(firestore, async (transaction) => {
          didCommit = false;
          const latestSnapshot = await transaction.get(stateRef);
          const latestBoard = normalizeCelebrationBoard(latestSnapshot.data());
          if (latestBoard.revision !== currentBoard.revision) return;
          transaction.set(stateRef, { ...result.board, lastSubmissionId: submissionRef.id, updatedAt: serverTimestamp() }, { merge: true });
          didCommit = true;
        });
        if (didCommit) committedBoard = result.board;
      }
      if (!committedBoard) throw new Error("The celebration changed too quickly. Please offer your verse again.");

      await updateDoc(submissionRef, { status: "incorporated", processedAt: serverTimestamp(), boardRevision: committedBoard.revision });
      setSubmitted(true);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "The bard could not hear this contribution.";
      setError(message);
      await updateDoc(submissionRef, { status: "failed", error: message, processedAt: serverTimestamp() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DungeonShell background="/experience/dungeons/battle/battlefield.png">
      <div className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-5 py-12">
        <section className={`dungeon-panel w-full rounded-3xl p-6 sm:p-8 ${submitted ? "dungeon-pass" : ""}`}>
          <QuestHeader chapter="Chapter V" title="Help the Victory Bard" />
          {!submitted ? (
            <>
              <p className="mx-auto mt-4 max-w-md text-center text-sm leading-6 text-white/55">What should the bard sing while the city celebrates the dragon&apos;s defeat?</p>
              {role ? (
                <form onSubmit={submitContribution} className="mt-7 space-y-5">
                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/45 p-4">
                    <RoleAvatar role={role} />
                    <div><p className="dungeon-kicker">Your random role</p><h2 className="text-2xl font-bold" style={{ color: ROLE_DETAILS[role].color }}>{ROLE_DETAILS[role].title}</h2></div>
                  </div>
                  <div>
                    <label className="dungeon-kicker" htmlFor="song-wish">What do you want in the song?</label>
                    <textarea id="song-wish" value={songWish} onChange={(event) => setSongWish(event.target.value)} className="dungeon-input mt-2 min-h-24 resize-none px-4 py-3" maxLength={500} placeholder="A soaring chorus about everyone fighting together…" />
                  </div>
                  <div>
                    <label className="dungeon-kicker" htmlFor="lyric-limitations">What limitations must the lyrics follow?</label>
                    <textarea id="lyric-limitations" value={lyricLimitations} onChange={(event) => setLyricLimitations(event.target.value)} className="dungeon-input mt-2 min-h-20 resize-none px-4 py-3" maxLength={500} placeholder="Use short lines, no sad words, repeat the final refrain…" />
                  </div>
                  <div className="dungeon-scroll rounded-2xl p-5">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#715126]">You found this on the ground</p>
                    <p className="mt-2 leading-6">{groundFinding}</p>
                  </div>
                  <div className="rounded-xl border border-[#d9bd7d]/20 bg-black/35 p-4">
                    <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/35">Your complete prompt</p>
                    <p className="mt-2 text-xs leading-5 text-white/60">{composedPrompt}</p>
                  </div>
                  <button type="submit" disabled={busy || !songWish.trim() || !lyricLimitations.trim()} className="dungeon-button w-full rounded-xl px-5 py-4 text-xs">{busy ? "The bard is rewriting the song…" : "Offer this verse"}</button>
                  {error ? <p className="rounded-xl border border-red-400/30 bg-red-950/35 p-3 text-sm text-red-200">{error}</p> : null}
                </form>
              ) : <p className="mt-8 animate-pulse text-center font-mono text-xs uppercase tracking-wider text-[#d9bd7d]">Drawing your role…</p>}
            </>
          ) : (
            <div className="py-8 text-center">
              {role ? <div className="mx-auto w-fit"><RoleAvatar role={role} size="lg" /></div> : null}
              <p className="dungeon-kicker mt-6 text-emerald-300">Contribution incorporated</p>
              <h2 className="mt-3 text-4xl font-bold">The song has changed</h2>
              <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-white/60">Look to the bard&apos;s board. Your discovery now lives in the celebration lyrics.</p>
            </div>
          )}
        </section>
      </div>
    </DungeonShell>
  );
}
