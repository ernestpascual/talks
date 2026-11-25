"use client";

import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_CELEBRATION_BOARD,
  DUNGEON_STAGE_5_SUBMISSIONS,
  DUNGEON_STATE_COLLECTION,
  ROLE_DETAILS,
  isDungeonRole,
  normalizeCelebrationBoard,
  type CelebrationBoard,
  type DungeonRole,
} from "@/lib/dungeons";
import { firestore } from "@/lib/firebase";
import { BackToCampaign, DungeonShell, QuestHeader, QuestQr } from "../components/DungeonUi";

type CelebrationSubmission = {
  id: string;
  role: DungeonRole;
  prompt: string;
  status: string;
};

type GeneratedSong = {
  audioUrl: string;
  mimeType: string;
  prompt: string;
};

function base64AudioUrl(base64: string, mimeType: string) {
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export default function CelebrationHostPage() {
  const [board, setBoard] = useState<CelebrationBoard>(DEFAULT_CELEBRATION_BOARD);
  const [submissions, setSubmissions] = useState<CelebrationSubmission[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [song, setSong] = useState<GeneratedSong | null>(null);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const stateRef = doc(firestore, DUNGEON_STATE_COLLECTION, "stage-5");
    void getDoc(stateRef).then((snapshot) => {
      if (!snapshot.exists()) void setDoc(stateRef, { ...DEFAULT_CELEBRATION_BOARD, initializedAt: serverTimestamp() });
    });
    const boardOff = onSnapshot(stateRef, (snapshot) => setBoard(normalizeCelebrationBoard(snapshot.data())));
    const submissionsQuery = query(collection(firestore, DUNGEON_STAGE_5_SUBMISSIONS), orderBy("createdAt", "desc"));
    const submissionsOff = onSnapshot(submissionsQuery, (snapshot) => setSubmissions(snapshot.docs.flatMap((entry) => {
      const data = entry.data();
      if (!isDungeonRole(data.role)) return [];
      return [{ id: entry.id, role: data.role, prompt: typeof data.prompt === "string" ? data.prompt : "", status: typeof data.status === "string" ? data.status : "received" } satisfies CelebrationSubmission];
    })));
    return () => { boardOff(); submissionsOff(); };
  }, []);

  useEffect(() => {
    const audioUrl = song?.audioUrl;
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [song?.audioUrl]);

  const roleCounts = useMemo(() => ({
    warrior: submissions.filter((entry) => entry.role === "warrior").length,
    mage: submissions.filter((entry) => entry.role === "mage").length,
    archer: submissions.filter((entry) => entry.role === "archer").length,
  }), [submissions]);

  async function generateSong() {
    if (generating || board.revision === 0) return;
    setGenerating(true);
    setError("");
    setGenerationStatus("The bard is arranging the final chorus…");
    try {
      const strictPrompt = `${board.songPrompt}\n\nVOCAL PERFORMANCE REQUIREMENT:\nPerform the following lyrics exactly as written. Do not add, remove, paraphrase, or replace any lyric line. Use a clear communal medieval-fantasy vocal performance.\n\nLYRICS:\n${board.lyrics}`;
      const response = await fetch("/api/lyria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: strictPrompt, model: "lyria-3-clip-preview", genre: "Ambient", mood: "Euphoric", tempo: "120 BPM", isInstrumental: false, durationSeconds: 30 }),
      });
      setGenerationStatus("Lyria is giving the party a voice…");
      const result = await response.json() as { success?: boolean; audioBase64?: string; mimeType?: string; prompt?: string; error?: string };
      if (!response.ok || !result.success || !result.audioBase64) throw new Error(result.error || "Lyria returned no celebration audio.");
      const mimeType = result.mimeType || "audio/mp3";
      const audioUrl = base64AudioUrl(result.audioBase64, mimeType);
      setSong({ audioUrl, mimeType, prompt: result.prompt || strictPrompt });
      window.setTimeout(() => { void audioRef.current?.play().catch(() => undefined); }, 250);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "The victory song could not be generated.");
    } finally {
      setGenerating(false);
      setGenerationStatus("");
    }
  }

  return (
    <DungeonShell background="/experience/dungeons/battle/battlefield.png">
      <BackToCampaign />
      <div className="mx-auto grid min-h-[100dvh] max-w-[1600px] gap-5 px-5 py-7 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="space-y-4 self-start xl:sticky xl:top-7">
          <QuestQr path="/experience/dungeons/5-quest" label="Help write the victory song" />
          <section className="dungeon-panel overflow-hidden rounded-2xl">
            <div className="relative aspect-[3/2] border-b border-[#d9bd7d]/20">
              <Image src="/experience/dungeons/bard-calling-for-help.png" alt="The royal bard reaches out to the adventurers for help composing the victory song" fill sizes="(min-width: 1280px) 280px, 100vw" className="object-cover" priority />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-12">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#f5d78f]">The bard calls for aid</p>
              </div>
            </div>
            <div className="p-4">
              <p className="dungeon-kicker">The royal bard</p>
              <h2 className="mt-2 text-2xl font-bold">One song, many voices</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">Every offering changes the lyrics, the musical direction, and the feeling of the final celebration.</p>
              <button type="button" onClick={() => void generateSong()} disabled={generating || board.revision === 0} className="dungeon-button mt-5 w-full rounded-xl px-4 py-4 text-[10px]">{generating ? "Composing…" : board.revision === 0 ? "Awaiting first verse" : "Generate song"}</button>
              {generationStatus ? <p className="mt-3 animate-pulse text-center font-mono text-[10px] text-violet-200">{generationStatus}</p> : null}
              {error ? <p className="mt-3 rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-xs text-red-200">{error}</p> : null}
            </div>
          </section>
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="dungeon-panel rounded-3xl p-6 text-center sm:p-8">
            <QuestHeader chapter="Chapter V" title="The Bard's Victory Song" />
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/55">The dragon has fallen. Help the bard turn the party&apos;s discoveries into one euphoric song for the city.</p>
            {board.revision > 0 ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <Meter label="Mood meter" value={board.moodMeter} caption={board.moodLabel} color="from-violet-500 to-fuchsia-300" />
                <Meter label="Happiness index" value={board.happinessIndex} caption={`${board.happinessIndex}% joyful`} color="from-amber-500 to-yellow-200" />
              </div>
            ) : <p className="mt-7 rounded-2xl border border-dashed border-[#d9bd7d]/25 bg-black/25 p-5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Awaiting the first adventurer&apos;s contribution before analyzing the celebration mood.</p>}
          </section>

          <section className="dungeon-scroll rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 border-b border-[#6f4a1f]/25 pb-4">
              <div><p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6f4a1f]">Living lyrics</p><h2 className="mt-1 text-3xl font-bold">The Dragonfall Chorus</h2></div>
              <span className="rounded-full border border-[#6f4a1f]/30 px-3 py-1 font-mono text-[9px] font-bold uppercase text-[#6f4a1f]">Revision {board.revision}</span>
            </div>
            {board.revision > 0 ? <p className="mt-6 whitespace-pre-line text-lg leading-8">{board.lyrics}</p> : <p className="mt-6 font-mono text-xs uppercase tracking-wider text-[#6f4a1f]/55">No lyrics have been written yet.</p>}
          </section>

          {board.revision > 0 ? <section className="dungeon-panel rounded-2xl p-5"><p className="dungeon-kicker">Final Lyria prompt</p><p className="mt-3 text-sm leading-6 text-white/65">{board.songPrompt}</p></section> : null}

          {song ? (
            <section className="dungeon-panel dungeon-pass rounded-3xl border-violet-400/45 p-6 text-center">
              <p className="dungeon-kicker text-violet-200">The celebration is ready</p>
              <h2 className="mt-2 text-4xl font-bold">Play the victory song</h2>
              <div className="bard-equalizer mx-auto my-6" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <span key={index} style={{ animationDelay: `${index * 70}ms` }} />)}</div>
              <audio ref={audioRef} src={song.audioUrl} controls autoPlay className="mx-auto w-full max-w-2xl" />
              <a href={song.audioUrl} download={`techeons-victory-song.${song.mimeType.includes("wav") ? "wav" : "mp3"}`} className="mt-4 inline-block font-mono text-xs text-violet-200 underline underline-offset-4">Download celebration clip</a>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 self-start xl:sticky xl:top-7">
          <section className="dungeon-panel rounded-2xl p-5">
            <div className="flex items-end justify-between"><div><p className="dungeon-kicker">Party chorus</p><h2 className="mt-1 text-xl font-bold">Role counts</h2></div><span className="font-mono text-lg text-[#d9bd7d]">{submissions.length}</span></div>
            <div className="mt-4 space-y-2">{(["warrior", "mage", "archer"] as DungeonRole[]).map((role) => <div key={role} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 p-3"><span className="flex items-center gap-2 font-bold" style={{ color: ROLE_DETAILS[role].color }}><span className="text-xl">{ROLE_DETAILS[role].glyph}</span>{ROLE_DETAILS[role].title}</span><strong className="font-mono text-xl text-white">{roleCounts[role]}</strong></div>)}</div>
          </section>
          {board.revision > 0 ? <section className="dungeon-panel rounded-2xl p-5"><p className="dungeon-kicker">Cumulative look &amp; feel</p><p className="mt-3 text-sm leading-6 text-white/65">{board.lookAndFeel}</p></section> : null}
          <section className="dungeon-panel max-h-72 overflow-auto rounded-2xl p-5">
            <p className="dungeon-kicker">Latest offerings</p>
            <div className="mt-3 space-y-2">{submissions.slice(0, 8).map((submission) => <article key={submission.id} className="rounded-xl border border-white/10 bg-black/35 p-3"><div className="flex items-center justify-between"><span className="font-mono text-[9px] font-bold uppercase" style={{ color: ROLE_DETAILS[submission.role].color }}>{submission.role}</span><span className="font-mono text-[8px] uppercase text-white/30">{submission.status}</span></div><p className="mt-2 line-clamp-3 text-xs leading-5 text-white/50">{submission.prompt}</p></article>)}</div>
          </section>
        </aside>
      </div>
    </DungeonShell>
  );
}

function Meter({ label, value, caption, color }: { label: string; value: number; caption: string; color: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/35 p-5 text-left"><div className="flex items-end justify-between"><div><p className="dungeon-kicker">{label}</p><p className="mt-1 text-sm text-white/45">{caption}</p></div><strong className="text-4xl">{value}</strong></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-black/70"><span className={`block h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${value}%` }} /></div></div>;
}
