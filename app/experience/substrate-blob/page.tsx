"use client";

import { FormEvent, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import {
  SUBSTRATE_COLLECTION,
  SUBSTRATE_QUESTIONS,
} from "@/lib/substrate-blob";

const QUESTION_STYLES = [
  {
    color: "#FF3154",
    border: "border-[#FF3154]/35",
    glow: "shadow-[0_0_60px_rgba(255,49,84,0.08)]",
  },
  {
    color: "#246BFD",
    border: "border-[#246BFD]/35",
    glow: "shadow-[0_0_60px_rgba(36,107,253,0.08)]",
  },
  {
    color: "#FFD23F",
    border: "border-[#FFD23F]/35",
    glow: "shadow-[0_0_60px_rgba(255,210,63,0.08)]",
  },
] as const;

function LikertQuestion({
  index,
  value,
  onChange,
}: {
  index: number;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const style = QUESTION_STYLES[index];

  return (
    <fieldset
      className={`rounded-3xl border ${style.border} bg-white/[0.035] p-5 sm:p-6 ${style.glow}`}
    >
      <legend className="sr-only">{SUBSTRATE_QUESTIONS[index]}</legend>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-black"
          style={{ backgroundColor: style.color }}
        >
          {index + 1}
        </span>
        <p className="text-base font-semibold leading-snug text-white sm:text-lg">
          {SUBSTRATE_QUESTIONS[index]}
        </p>
      </div>
      <div className="mt-5 grid grid-cols-5 gap-2" role="radiogroup">
        {[1, 2, 3, 4, 5].map((score) => {
          const selected = value === score;
          return (
            <label key={score} className="cursor-pointer">
              <input
                type="radio"
                name={`question-${index + 1}`}
                value={score}
                checked={selected}
                onChange={() => onChange(score)}
                className="sr-only"
                required
              />
              <span
                className="flex aspect-square items-center justify-center rounded-2xl border text-sm font-black transition active:scale-95 sm:text-base"
                style={{
                  borderColor: selected ? style.color : "rgba(255,255,255,0.12)",
                  backgroundColor: selected
                    ? `${style.color}26`
                    : "rgba(255,255,255,0.025)",
                  color: selected ? style.color : "rgba(255,255,255,0.62)",
                  boxShadow: selected ? `0 0 24px ${style.color}24` : "none",
                }}
              >
                {score}
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
        <span>Very negative</span>
        <span>Very positive</span>
      </div>
    </fieldset>
  );
}

export default function SubstrateBlobExperiencePage() {
  const [name, setName] = useState("");
  const [scores, setScores] = useState<Array<number | null>>([
    null,
    null,
    null,
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const complete =
    name.trim().length > 0 && scores.every((score) => score !== null);

  const updateScore = (index: number, value: number) => {
    setScores((current) =>
      current.map((score, scoreIndex) =>
        scoreIndex === index ? value : score,
      ),
    );
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete) return;

    setSubmitting(true);
    setError("");

    try {
      await addDoc(collection(firestore, SUBSTRATE_COLLECTION), {
        name: name.trim().slice(0, 48),
        redScore: scores[0],
        blueScore: scores[1],
        yellowScore: scores[2],
        submittedAt: Date.now(),
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (submissionError) {
      console.error("Failed to submit substrate response:", submissionError);
      setError("We could not save your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const reset = () => {
    setName("");
    setScores([null, null, null]);
    setSubmitted(false);
    setError("");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-5 py-12 text-white sm:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-[#FF3154]/10 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-[#246BFD]/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-[#FFD23F]/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto w-full max-w-2xl">
        <header className="mb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/45">
            BBDO AI Playday
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
            AI Creative Substrates
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/50 sm:text-base">
            Share how you feel about creating with AI. Your answers will shape
            a live color substrate on screen.
          </p>
        </header>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
                Name
              </span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 48))}
                required
                autoComplete="name"
                placeholder="Enter your name"
                className="h-12 w-full rounded-2xl border border-white/15 bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/45"
              />
            </label>

            <LikertQuestion
              index={0}
              value={scores[0]}
              onChange={(value) => updateScore(0, value)}
            />

            <LikertQuestion
              index={1}
              value={scores[1]}
              onChange={(value) => updateScore(1, value)}
            />

            <LikertQuestion
              index={2}
              value={scores[2]}
              onChange={(value) => updateScore(2, value)}
            />

            {error && (
              <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!complete || submitting}
              className="mt-2 h-14 w-full rounded-2xl bg-white text-sm font-black uppercase tracking-[0.12em] text-black transition hover:bg-white/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {submitting ? "Creating your substrate…" : "Create my substrate"}
            </button>
          </form>
        ) : (
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] px-6 py-14 text-center shadow-2xl backdrop-blur-xl sm:px-12">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#FF3154,transparent_55%),radial-gradient(circle_at_70%_35%,#246BFD,transparent_58%),radial-gradient(circle_at_50%_78%,#FFD23F,transparent_60%)] shadow-[0_0_70px_rgba(255,255,255,0.12)]" />
            <h2 className="mt-8 text-3xl font-black tracking-tight">
              Your substrate is live
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/50">
              Thanks, {name.trim()}. Look at slide 3 to see your response join
              the collective visualization.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-8 rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white/65 transition hover:border-white/35 hover:text-white"
            >
              Submit another response
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
