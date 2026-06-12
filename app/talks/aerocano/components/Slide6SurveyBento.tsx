"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SurveyInsights } from "@/lib/talks/aerocano/survey-insights";
import { SlideCornerLink, SlideCornerQr } from "./SlideCornerChrome";

function SurveyCard({
  className,
  eyebrow,
  title,
  children,
}: {
  className?: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex h-full min-h-0 flex-col rounded-[2rem] border border-zinc-900 bg-zinc-950/80 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-md ${className ?? ""}`}
    >
      {eyebrow ? (
        <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-500/80">
          {eyebrow}
        </span>
      ) : null}
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-white">{title}</h3>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center rounded-3xl border border-dashed border-zinc-800 px-4 text-center text-sm text-zinc-500">
      {label}
    </div>
  );
}

function Meter({
  value,
  leftLabel,
  rightLabel,
}: {
  value: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (safeValue / 100) * circumference;
  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="flex items-center justify-center">
        <svg viewBox="0 0 160 160" className="h-40 w-40 overflow-visible">
          <defs>
            <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="55%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#18181b" strokeWidth="14" />
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="url(#meterGradient)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 80 80)"
          />
          <circle cx="80" cy="80" r="46" fill="rgba(10,10,10,0.7)" />
          <text
            x="80"
            y="76"
            textAnchor="middle"
            className="fill-white text-[24px] font-black"
          >
            {Math.round(safeValue)}%
          </text>
          <text
            x="80"
            y="96"
            textAnchor="middle"
            className="fill-zinc-500 text-[7px] uppercase tracking-[0.28em]"
          >
            Sweetness
          </text>
        </svg>
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function LineGraph({
  labels,
  values,
  caption,
}: {
  labels: string[];
  values: number[];
  caption?: string;
}) {
  const width = 320;
  const height = 150;
  const padding = 18;
  const maxValue = Math.max(...values, 1);
  const step = labels.length > 1 ? (width - padding * 2) / (labels.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = padding + index * step;
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return { x, y, value, label: labels[index] };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  return (
    <div className="flex h-full flex-col gap-3">
      {caption ? (
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{caption}</p>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} className="min-h-0 flex-1 w-full">
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = height - padding - ratio * (height - padding * 2);
          return (
            <line
              key={ratio}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#27272a"
              strokeDasharray="4 6"
            />
          );
        })}
        <path d={path} fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
        {points.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="5" fill="#f59e0b" />
            <circle cx={point.x} cy={point.y} r="10" fill="rgba(245,158,11,0.15)" />
            <text
              x={point.x}
              y={point.y - 14}
              textAnchor="middle"
              className="fill-zinc-200 text-[9px] font-semibold"
            >
              {point.value}
            </text>
          </g>
        ))}
      </svg>
      <div className="grid grid-cols-4 gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        {points.map((point) => (
          <div key={point.label} className="rounded-xl border border-zinc-900 bg-black/20 px-2 py-2 text-center">
            <div>{point.label}</div>
            <div className="mt-1 font-mono text-zinc-200 normal-case tracking-normal">{point.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarChart({
  labels,
  values,
  descriptions,
}: {
  labels: string[];
  values: number[];
  descriptions: string[];
}) {
  const size = 260;
  const center = size / 2;
  const radius = 88;
  const maxValue = Math.max(...values, 1);
  const angleStep = (Math.PI * 2) / labels.length;
  const toPoint = (ratio: number, index: number) => {
    const angle = -Math.PI / 2 + angleStep * index;
    return {
      x: center + Math.cos(angle) * radius * ratio,
      y: center + Math.sin(angle) * radius * ratio,
    };
  };
  const polygon = values
    .map((value, index) => {
      const point = toPoint(value / maxValue, index);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_40%] items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full min-h-0 w-full">
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={labels
              .map((_, index) => {
                const point = toPoint(ratio, index);
                return `${point.x},${point.y}`;
              })
              .join(" ")}
            fill="none"
            stroke="#27272a"
          />
        ))}
        {labels.map((_, index) => {
          const point = toPoint(1, index);
          return <line key={index} x1={center} y1={center} x2={point.x} y2={point.y} stroke="#27272a" />;
        })}
        {labels.map((label, index) => {
          const point = toPoint(1.18, index);
          return (
            <text
              key={`${label}-label`}
              x={point.x}
              y={point.y}
              textAnchor={point.x < center - 8 ? "end" : point.x > center + 8 ? "start" : "middle"}
              dominantBaseline={point.y < center - 8 ? "alphabetic" : point.y > center + 8 ? "hanging" : "middle"}
              className="fill-zinc-400 text-[7px] font-medium"
            >
              {label}
            </text>
          );
        })}
        <polygon points={polygon} fill="rgba(245,158,11,0.22)" stroke="#f59e0b" strokeWidth="3" />
        {values.map((value, index) => {
          const point = toPoint(value / maxValue, index);
          return <circle key={labels[index]} cx={point.x} cy={point.y} r="4" fill="#fde68a" />;
        })}
      </svg>
      <div className="min-h-0 min-w-0 space-y-1.5 overflow-y-auto">
        {labels.map((label, index) => (
          <div key={label} className="rounded-xl border border-zinc-900 bg-black/20 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-zinc-200">{label}</span>
              <span className="font-mono text-zinc-100">{values[index]}</span>
            </div>
            <p className="mt-1 text-[10px] leading-snug text-zinc-500">
              {descriptions[index]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BubbleChart({
  items,
}: {
  items: Array<{ label: string; value: number }>;
}) {
  const positions = [
    { x: 22, y: 38 },
    { x: 64, y: 28 },
    { x: 48, y: 67 },
    { x: 80, y: 64 },
    { x: 30, y: 79 },
  ];
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <svg viewBox="0 0 100 100" className="h-full min-h-0 w-full">
      {items.map((item, index) => {
        const position = positions[index % positions.length];
        const radius = 10 + (item.value / maxValue) * 11;
        return (
          <g key={item.label}>
            <circle
              cx={position.x}
              cy={position.y}
              r={radius}
              fill={index % 2 === 0 ? "rgba(245,158,11,0.28)" : "rgba(56,189,248,0.22)"}
              stroke={index % 2 === 0 ? "#f59e0b" : "#38bdf8"}
            />
            <text
              x={position.x}
              y={position.y - 1}
              textAnchor="middle"
              className="fill-white text-[4.2px] font-semibold"
            >
              {item.label}
            </text>
            <text
              x={position.x}
              y={position.y + 5}
              textAnchor="middle"
              className="fill-zinc-300 text-[4px]"
            >
              {item.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PairBars({
  values,
  labels,
  colors,
}: {
  values: [number, number];
  labels: [string, string];
  colors: [string, string];
}) {
  const total = values[0] + values[1];
  const percentages =
    total === 0 ? [50, 50] : values.map((value) => Math.round((value / total) * 100));

  return (
    <div className="space-y-4">
      {[0, 1].map((index) => (
        <div key={labels[index]} className="space-y-2">
          <div className="flex items-center justify-between text-sm text-zinc-300">
            <span>{labels[index]}</span>
            <span className="font-mono text-zinc-100">{values[index]}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
            <div
              className={`h-full rounded-full ${colors[index]}`}
              style={{ width: `${percentages[index]}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PulseBars({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const maxValue = Math.max(...values, 1);
  return (
    <div className="flex h-full items-end gap-3">
      {values.map((value, index) => (
        <div key={labels[index]} className="flex flex-1 flex-col items-center gap-2">
          <div className="text-xs font-mono text-zinc-300">{value}</div>
          <div className="flex h-24 w-full items-end rounded-2xl bg-zinc-900/70 p-1">
            <div
              className="w-full rounded-xl bg-gradient-to-t from-amber-500 via-orange-400 to-yellow-200"
              style={{ height: `${Math.max(16, (value / maxValue) * 100)}%` }}
            />
          </div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            {labels[index]}
          </div>
        </div>
      ))}
    </div>
  );
}

const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
  Purist: "Plain, black, brewed, or no-sugar coffee.",
  Alchemist: "Specific build with milk, pumps, or custom rules.",
  Hustler: "Strong coffee for energy and alertness.",
  "Comfort Seeker": "Sweet, creamy, familiar, or dessert-like coffee.",
  Aesthetician: "Trendy cafe orders and photogenic drinks.",
};

function scoreChaoticOrder(answer: string) {
  const normalized = answer.toLowerCase();
  const chaosKeywords = [
    "matcha",
    "oat",
    "foam",
    "pump",
    "dirty",
    "spanish",
    "caramel",
    "mocha",
    "syrup",
    "extra",
    "shot",
    "salt",
    "cheese",
    "weird",
    "kahit",
    "libre",
    "pagmamahal",
    "ipaglaban",
    "nanlalamig",
  ];
  const keywordScore = chaosKeywords.reduce(
    (score, keyword) => score + (normalized.includes(keyword) ? 4 : 0),
    0,
  );
  const punctuationScore = (answer.match(/[!?.,]/g) ?? []).length;
  const lengthScore = Math.min(answer.length / 18, 8);
  const wordScore = Math.min(answer.trim().split(/\s+/).length / 2, 8);

  return keywordScore + punctuationScore + lengthScore + wordScore;
}

export default function Slide6SurveyBento({ text }: { text: string }) {
  const [responses, setResponses] = useState<string[]>([]);
  const [insights, setInsights] = useState<SurveyInsights>({});
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [clearingResponses, setClearingResponses] = useState(false);
  const [surveyPw, setSurveyPw] = useState("");
  const [showSurveyPwPrompt, setShowSurveyPwPrompt] = useState(false);
  const [surveyClearMsg, setSurveyClearMsg] = useState<"ok" | "fail" | null>(null);

  const lastAnalyzedKeyRef = useRef("");
  const surveyUrl = "https://talks.ernestpascual.com/experience/aerocano-survey";

  const analyzeResponses = useCallback(async (answers: string[]) => {
    if (answers.length === 0) {
      setInsights({});
      setInsightsError(null);
      setInsightsLoading(false);
      return;
    }

    setInsightsLoading(true);
    setInsightsError(null);

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze survey answers");
      }

      setInsights(data.insights || {});
    } catch (error) {
      setInsightsError(
        error instanceof Error ? error.message : "Failed to analyze survey answers",
      );
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const fetchResponses = useCallback(async () => {
    try {
      const res = await fetch("/api/survey", { cache: "no-store" });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.list)) return;

      const answers = data.list as string[];
      setResponses(answers);

      const nextKey = JSON.stringify(answers);
      if (nextKey !== lastAnalyzedKeyRef.current) {
        lastAnalyzedKeyRef.current = nextKey;
        void analyzeResponses(answers);
      }
    } catch (error) {
      console.error("Failed to fetch survey responses:", error);
    }
  }, [analyzeResponses]);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => {
      void fetchResponses();
    }, 0);
    const interval = window.setInterval(fetchResponses, 2500);

    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
    };
  }, [fetchResponses]);

  const handleClearResponses = useCallback(async () => {
    if (!surveyPw.trim()) return;

    setClearingResponses(true);
    try {
      const res = await fetch("/api/survey", {
        method: "DELETE",
        headers: { "x-admin-password": surveyPw },
      });
      const data = await res.json();

      if (data.success) {
        setResponses([]);
        setInsights({});
        setSurveyClearMsg("ok");
        setShowSurveyPwPrompt(false);
        setSurveyPw("");
        lastAnalyzedKeyRef.current = "[]";
      } else {
        setSurveyClearMsg("fail");
      }
    } catch {
      setSurveyClearMsg("fail");
    } finally {
      setClearingResponses(false);
      window.setTimeout(() => setSurveyClearMsg(null), 3000);
    }
  }, [surveyPw]);

  const visibleWidgets = Object.keys(insights).length;
  const hotIcedValues = insights.hot_vs_iced
    ? [insights.hot_vs_iced.hot, insights.hot_vs_iced.iced]
    : null;
  const plainMixedValues = insights.purist_vs_mixologist
    ? [insights.purist_vs_mixologist.plain, insights.purist_vs_mixologist.mixed]
    : null;
  const radarEntries = insights.archetype_leaderboard
    ? Object.entries(insights.archetype_leaderboard)
    : null;
  const archetypeLabels = radarEntries?.map(([label]) => label.replace("The ", "")) ?? [];
  const archetypeValues = radarEntries?.map(([, value]) => value) ?? [];
  const archetypeDescriptions = archetypeLabels.map(
    (label) => ARCHETYPE_DESCRIPTIONS[label] ?? "Coffee preference cluster.",
  );
  const whyCloudItems = insights.the_why_cloud?.length
    ? insights.the_why_cloud.map((word, index) => ({
        label: word,
        value: Math.max(5 - index, 1),
      }))
    : null;
  const pulseMetricValues = [
    responses.length,
    insights.kahit_ano_counter ?? 0,
    insights.hugot_detector ? 1 : 0,
    visibleWidgets,
  ];
  const pulseMetricLabels = ["Answers", "Kahit", "Hugot", "Widgets"];
  const calculatedChaoticOrder =
    responses.length > 0
      ? responses.reduce((currentBest, answer) =>
          scoreChaoticOrder(answer) > scoreChaoticOrder(currentBest) ? answer : currentBest,
        )
      : "";
  const chaoticOrder = insights.weirdest_order || calculatedChaoticOrder;

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-black text-left text-white animate-fade-in">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(180deg,rgba(24,24,27,0.88),rgba(0,0,0,1))]" />

      <div className="relative z-10 flex items-start justify-between gap-6 px-8 pt-6">
        <SlideCornerLink url={surveyUrl} />
        <SlideCornerQr url={surveyUrl} />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-8 pb-6 pt-4">
        <div className="mb-4 flex items-start justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.28em] text-amber-500">
              Live Survey Bento
            </span>
            <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-white leading-tight">
              {text}
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-light leading-relaxed text-zinc-400">
              Scan the QR code, send your answer, and Gemini will turn the batch into a live Bento dashboard.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              {insightsLoading ? "Analyzing" : "Live"}
            </span>
            {!showSurveyPwPrompt ? (
              <button
                type="button"
                onClick={() => setShowSurveyPwPrompt(true)}
                className="text-xs uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Clear data
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={surveyPw}
                  onChange={(e) => setSurveyPw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleClearResponses()}
                  placeholder="Admin password"
                  className="w-44 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-red-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleClearResponses}
                  disabled={clearingResponses || !surveyPw.trim()}
                  className="rounded-lg border border-red-500/30 bg-red-600/20 px-4 py-2 text-xs font-bold text-red-400 transition-colors hover:bg-red-600/30 disabled:opacity-40"
                >
                  {clearingResponses ? "..." : "Clear"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSurveyPwPrompt(false);
                    setSurveyPw("");
                  }}
                  className="px-2 py-2 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  ✕
                </button>
              </div>
            )}
            {surveyClearMsg === "ok" ? (
              <p className="text-xs text-emerald-500">Responses cleared ✓</p>
            ) : null}
            {surveyClearMsg === "fail" ? (
              <p className="text-xs text-red-400">Wrong password or error.</p>
            ) : null}
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 xl:grid-cols-12 xl:grid-rows-6">
          <SurveyCard className="xl:col-span-4 xl:row-span-2" eyebrow="Pulse" title="Room Snapshot">
            <div className="grid h-full min-h-0 grid-cols-[1.2fr_0.9fr] gap-5">
              <div className="flex min-h-0 flex-col justify-between gap-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-6xl font-black tracking-tight text-white">{responses.length}</p>
                    <p className="mt-2 text-sm text-zinc-400">answers in the current batch</p>
                  </div>
                  <div className="text-right">
                    <p className="text-6xl">{insights.vibe_check_emoji || "☕"}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.28em] text-zinc-500">
                      vibe check
                    </p>
                  </div>
                </div>
                <div className="flex-1">
                  <PulseBars values={pulseMetricValues} labels={pulseMetricLabels} />
                </div>
              </div>
              <div className="flex min-h-0 flex-col gap-3">
                <div className="rounded-2xl border border-zinc-900 bg-black/25 p-4">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Live State</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {insightsLoading ? "Refreshing" : "Synced"}
                  </p>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-zinc-900 bg-black/25 p-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Widgets</p>
                    <p className="mt-2 text-3xl font-black text-white">{visibleWidgets}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-900 bg-black/25 p-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Mood</p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {insights.hugot_detector ? "Hugot" : "Chill"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SurveyCard>

          <SurveyCard className="xl:col-span-3 xl:row-span-2" eyebrow="Taste" title="Sweetness Target">
            {typeof insights.sweetness_target === "number" ? (
              <>
              <p className="text-sm text-zinc-400">average sweetness across the batch</p>
              <div className="mt-4 flex-1">
                <Meter
                  value={insights.sweetness_target}
                  leftLabel="Mapait"
                  rightLabel="Matamis"
                />
              </div>
              </>
            ) : (
              <EmptyState label="Sweetness appears here once Gemini finds a clear trend." />
            )}
          </SurveyCard>

          <SurveyCard className="xl:col-span-3 xl:row-span-2" eyebrow="Temperature" title="Hot vs Iced">
            {hotIcedValues && plainMixedValues ? (
              <LineGraph
                labels={["Hot", "Iced", "Plain", "Mixed"]}
                caption="Temperature and coffee-build signals"
                values={[
                  hotIcedValues[0],
                  hotIcedValues[1],
                  plainMixedValues[0],
                  plainMixedValues[1],
                ]}
              />
            ) : insights.hot_vs_iced ? (
              <PairBars
                values={[insights.hot_vs_iced.hot, insights.hot_vs_iced.iced]}
                labels={["Hot", "Iced"]}
                colors={["bg-orange-500", "bg-sky-400"]}
              />
            ) : (
              <EmptyState label="Waiting for hot or iced preferences from the crowd." />
            )}
          </SurveyCard>

          <SurveyCard className="xl:col-span-2 xl:row-span-2" eyebrow="Style" title="Plain vs Mixed">
            {insights.purist_vs_mixologist ? (
              <PairBars
                values={[
                  insights.purist_vs_mixologist.plain,
                  insights.purist_vs_mixologist.mixed,
                ]}
                labels={["Plain", "Mixed"]}
                colors={["bg-zinc-200", "bg-fuchsia-400"]}
              />
            ) : (
              <EmptyState label="This split appears once answers show black coffee versus add-ons." />
            )}
          </SurveyCard>

          <SurveyCard className="xl:col-span-6 xl:row-span-2" eyebrow="People" title="Archetype Leaderboard">
            {radarEntries ? (
              <RadarChart
                labels={archetypeLabels}
                values={archetypeValues}
                descriptions={archetypeDescriptions}
              />
            ) : (
              <EmptyState label="Archetypes will rank here once Gemini can classify enough answers." />
            )}
          </SurveyCard>

          <SurveyCard className="xl:col-span-3 xl:row-span-2" eyebrow="Language" title="Why Cloud">
            {whyCloudItems ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="min-h-0 flex-1">
                  <BubbleChart items={whyCloudItems} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {whyCloudItems.map((item) => (
                    <span
                      key={item.label}
                      className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-200"
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState label="Common reasons and descriptors will cluster here." />
            )}
          </SurveyCard>

          <SurveyCard className="xl:col-span-3 xl:row-span-2" eyebrow="Chaos" title="Weirdest Order">
            {chaoticOrder ? (
              <div className="flex h-full flex-col justify-between gap-4">
                <blockquote className="min-h-0 overflow-y-auto text-xl font-medium leading-relaxed text-zinc-100">
                  &quot;{chaoticOrder}&quot;
                </blockquote>
                <div className="rounded-2xl border border-zinc-900 bg-black/25 p-3">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">
                    Chaos Score
                  </p>
                  <p className="mt-1 font-mono text-2xl font-black text-amber-300">
                    {Math.round(scoreChaoticOrder(chaoticOrder))}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState label="The most chaotic coffee order in the room will land here." />
            )}
          </SurveyCard>

          <SurveyCard className="xl:col-span-3 xl:row-span-2" eyebrow="Signals" title="Side Quests">
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              {typeof insights.tito_tita_energy === "number" ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Tito/Tita Energy</p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {Math.round(insights.tito_tita_energy)}%
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                  Tito/tita energy is waiting for classic coffee cues.
                </div>
              )}
              {typeof insights.kahit_ano_counter === "number" ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Kahit Ano Count</p>
                  <p className="mt-2 text-3xl font-black text-white">{insights.kahit_ano_counter}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                  Decision-fatigue answers will count up here.
                </div>
              )}
              {typeof insights.hugot_detector === "boolean" ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Hugot Detector</p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {insights.hugot_detector ? "ON" : "OFF"}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
                  Hugot mode lights up when someone gets dramatic.
                </div>
              )}
            </div>
          </SurveyCard>

          <SurveyCard className="xl:col-span-7 xl:row-span-2" eyebrow="Feed" title="Latest Answers">
            {responses.length === 0 ? (
              <div className="flex h-full min-h-44 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-zinc-800 text-center text-zinc-600">
                <span className="text-3xl">☕</span>
                <p className="text-xs font-light">Waiting for responses...</p>
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                {responses
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((response, index) => (
                    <div
                      key={`${response}-${index}`}
                      className="rounded-2xl border border-zinc-900 bg-zinc-900/40 p-4 text-sm leading-relaxed text-zinc-200"
                    >
                      {response}
                    </div>
                  ))}
              </div>
            )}
          </SurveyCard>

          <SurveyCard className="xl:col-span-2 xl:row-span-2" eyebrow="Status" title="Gemini">
            {insightsError ? (
              <p className="text-sm leading-relaxed text-red-300">{insightsError}</p>
            ) : (
              <div className="flex h-full flex-col justify-between gap-4">
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-zinc-900 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Engine</p>
                    <p className="mt-2 text-xl font-black text-white">
                      {insightsLoading ? "Thinking" : "Ready"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-900 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Widgets</p>
                    <p className="mt-2 text-xl font-black text-white">{visibleWidgets}</p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">
                  Gemini only refreshes when new answers change the batch.
                </p>
              </div>
            )}
            <p className="mt-3 text-xs text-zinc-500">
              The live answers continue updating even if analysis is unavailable.
            </p>
          </SurveyCard>
        </div>
      </div>
    </div>
  );
}
