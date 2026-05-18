"use client";

import type { Slide } from "@/lib/talks/raw-school-2026/slides";
import Slide6EyeTrack from "./Slide6EyeTrack";

const center = "flex min-h-screen items-center justify-center px-16 py-12";

export default function SlideContent({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "title":
      return (
        <div className={center}>
          <h1 className="max-w-5xl text-center text-3xl font-bold uppercase leading-tight tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            {slide.text}
          </h1>
        </div>
      );

    case "heading":
      return (
        <div className={center}>
          <h2 className="text-center text-4xl font-medium capitalize sm:text-5xl md:text-6xl">
            {slide.text}
          </h2>
        </div>
      );

    case "venn":
      return (
        <div className={`${center} flex-col gap-10`}>
          <h2 className="text-3xl font-medium sm:text-4xl">{slide.title}</h2>
          <div className="relative h-56 w-80 sm:h-64 sm:w-96">
            <div
              className="absolute left-0 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full border-2 border-white/40 bg-white/5 sm:h-52 sm:w-52"
              aria-hidden
            />
            <div className="absolute left-0 top-1/2 flex h-44 w-44 -translate-y-1/2 items-center justify-center sm:h-52 sm:w-52">
              <span className="text-sm font-medium text-white/70">Creative</span>
            </div>
            <div className="absolute right-0 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full border-2 border-white/40 bg-white/5 sm:h-52 sm:w-52" />
            <div className="absolute right-0 top-1/2 flex h-44 w-44 -translate-y-1/2 items-center justify-center sm:h-52 sm:w-52">
              <span className="text-sm font-medium text-white/70">
                Technologist
              </span>
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-white sm:text-sm">
                Creative Technologist
              </span>
            </div>
          </div>
        </div>
      );

    case "ipo":
      return (
        <div className={`${center} flex-col gap-12`}>
          <h2 className="max-w-3xl text-center text-2xl font-medium sm:text-3xl md:text-4xl">
            {slide.title}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {(["Input", "Process", "Output"] as const).map((label, i) => (
              <div key={label} className="flex items-center gap-4 sm:gap-6">
                {i > 0 ? (
                  <span className="text-2xl text-white/40" aria-hidden>
                    →
                  </span>
                ) : null}
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/30 bg-white/5 text-lg font-medium sm:h-32 sm:w-32 sm:text-xl">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "ipo-ai":
      return (
        <div className={`${center} flex-col gap-10`}>
          <h2 className="text-center text-2xl font-medium capitalize sm:text-3xl md:text-4xl">
            {slide.title}
          </h2>
          <div className="grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              { stage: "Input", role: "gather, sense, ingest" },
              { stage: "Process", role: "transform, reason, generate" },
              { stage: "Output", role: "deliver, act, express" },
            ].map(({ stage, role }) => (
              <div
                key={stage}
                className="rounded-2xl border border-white/25 bg-white/5 p-6 text-center"
              >
                <p className="text-lg font-semibold">{stage}</p>
                <p className="mt-3 text-sm text-white/60">AI: {role}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "statement-eye":
      return <Slide6EyeTrack text={slide.text} />;

    case "statement":
      return (
        <div className={center}>
          <p className="max-w-4xl text-center text-2xl font-light leading-relaxed sm:text-3xl md:text-4xl">
            {slide.text}
          </p>
        </div>
      );

    case "poll":
      return (
        <div className={`${center} flex-col gap-8`}>
          <h2 className="text-center text-3xl font-medium capitalize sm:text-4xl md:text-5xl">
            {slide.title}
          </h2>
          <p className="max-w-2xl text-center text-lg text-white/70 sm:text-xl">
            {slide.subtitle}
          </p>
          <div className="mt-4 grid w-full max-w-lg grid-cols-3 gap-3 text-center text-sm text-white/50">
            <div className="rounded-xl border border-dashed border-white/25 py-8">
              poll
            </div>
            <div className="rounded-xl border border-dashed border-white/25 py-8">
              canvas
            </div>
            <div className="rounded-xl border border-dashed border-white/25 py-8">
              LLM → IPO
            </div>
          </div>
        </div>
      );

    case "compare":
      return (
        <div className={`${center} flex-col gap-12 sm:flex-row sm:gap-16`}>
          <p className="max-w-xs text-center text-2xl font-medium sm:text-3xl">
            {slide.left}
          </p>
          <span className="text-3xl text-white/30" aria-hidden>
            vs
          </span>
          <p className="max-w-xs text-center text-2xl font-medium capitalize sm:text-3xl">
            {slide.right}
          </p>
        </div>
      );

    case "questions":
      return (
        <div className={`${center} flex-col gap-8`}>
          {slide.items.map((item) => (
            <p
              key={item}
              className="text-center text-3xl font-medium sm:text-4xl md:text-5xl"
            >
              {item}
            </p>
          ))}
        </div>
      );

    case "metaphor":
      return (
        <div className={`${center} flex-col gap-6`}>
          {slide.lines.map((line) => (
            <p
              key={line}
              className="text-center text-2xl font-light sm:text-3xl md:text-4xl"
            >
              {line}
            </p>
          ))}
        </div>
      );

    case "camera-demo":
      return (
        <div className={`${center} flex-col gap-10`}>
          <h2 className="max-w-3xl text-center text-xl font-medium sm:text-2xl md:text-3xl">
            {slide.title}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-white/50 sm:text-base">
            <span className="rounded-lg border border-white/30 px-4 py-2">
              input
            </span>
            <span aria-hidden>→</span>
            <span className="rounded-lg border border-white/30 px-4 py-2">
              process
            </span>
            <span aria-hidden>→</span>
            <span className="rounded-lg border border-white/30 px-4 py-2">
              output
            </span>
          </div>
          <ul className="flex flex-col gap-3 text-center text-lg text-white/70 sm:text-xl">
            {slide.flow.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      );

    case "list":
      return (
        <div className={`${center} flex-col gap-6 sm:flex-row sm:gap-12`}>
          {slide.items.map((item, i) => (
            <div key={item} className="flex items-center gap-6 sm:gap-12">
              {i > 0 ? (
                <span
                  className="hidden text-2xl text-white/30 sm:inline"
                  aria-hidden
                >
                  →
                </span>
              ) : null}
              <p className="text-3xl font-medium sm:text-4xl md:text-5xl">
                {item}
              </p>
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
}
