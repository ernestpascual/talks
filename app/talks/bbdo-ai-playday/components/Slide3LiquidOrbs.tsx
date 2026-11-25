"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, ref, runTransaction } from "firebase/database";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import QRCode from "qrcode";

import { firestore, realtimeDatabase } from "@/lib/firebase";
import {
  normalizeSubstrateSubmission,
  SUBSTRATE_COLLECTION,
  SUBSTRATE_REDIRECT_PATH,
  SUBSTRATE_TUNING_PATH,
  type SubstrateSubmission,
} from "@/lib/substrate-blob";

const ORBS_PER_ROW = 5;

type GrainSettings = {
  amount: number;
  background: number;
  spread: number;
  offset: number;
  glow: number;
  seed: number;
};

type NumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function NumberField({ label, value, min, max, step, onChange }: NumberFieldProps) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_64px] items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const nextValue = event.currentTarget.valueAsNumber;
          if (Number.isFinite(nextValue)) {
            onChange(Math.min(max, Math.max(min, nextValue)));
          }
        }}
        className="h-8 rounded-md border border-white/15 bg-white/8 px-2 text-right font-mono text-xs tracking-normal text-white outline-none transition focus:border-white/45 focus:bg-white/12"
      />
    </label>
  );
}

function fract(value: number) {
  return value - Math.floor(value);
}

function hash12(x: number, y: number) {
  let px = fract(x * 0.1031);
  let py = fract(y * 0.1031);
  let pz = fract(x * 0.1031);
  const dot = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += dot;
  py += dot;
  pz += dot;
  return fract((px + py) * pz);
}

function finePrintGrain(x: number, y: number) {
  const a = hash12(x, y);
  const b = hash12(x + 31.7, y + 17.3);
  const c = hash12(x + 11.1, y + 73.9);
  return ((a + b + c) / 3 - 0.5) * 1.8;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const normalized = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return normalized * normalized * (3 - 2 * normalized);
}

function GrainLayer({
  size,
  settings,
  submissionSeed,
  animationSpeed,
}: {
  size: number;
  settings: GrainSettings;
  submissionSeed: number;
  animationSpeed: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padding = Math.ceil(Math.max(2, (settings.spread - size) * 0.5 + settings.glow));
  const cssSize = size + padding * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const physicalSize = Math.max(1, Math.round(cssSize * pixelRatio));
    canvas.width = physicalSize;
    canvas.height = physicalSize;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    const image = context.createImageData(physicalSize, physicalSize);
    const center = physicalSize * 0.5;
    const grainRadius = settings.spread * pixelRatio * 0.5;
    const glowWidth = Math.max(0.5, settings.glow * pixelRatio);
    const physicalOffset = settings.offset * pixelRatio;
    const seededOffset = settings.seed * 19 + submissionSeed * 13;

    for (let y = 0; y < physicalSize; y += 1) {
      for (let x = 0; x < physicalSize; x += 1) {
        const distance = Math.hypot(x - center, y - center);
        const mask = 1 - smoothstep(grainRadius, grainRadius + glowWidth, distance);
        const strength =
          settings.amount *
          (settings.background + (1 - settings.background) * mask);
        const grain = finePrintGrain(
          x + physicalOffset + seededOffset,
          y - physicalOffset * 0.65 + seededOffset * 0.37,
        );
        const monochrome = Math.round(
          Math.min(255, Math.max(0, (0.5 + grain * strength * 0.5) * 255)),
        );
        const index = (y * physicalSize + x) * 4;
        image.data[index] = monochrome;
        image.data[index + 1] = monochrome;
        image.data[index + 2] = monochrome;
        image.data[index + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
  }, [cssSize, settings, submissionSeed]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        left: -padding,
        top: -padding,
        animation:
          animationSpeed > 0
            ? `substrate-atmosphere-flow ${10 / animationSpeed}s steps(90, end) infinite`
            : "none",
        animationDelay: `${-submissionSeed * 0.47}s`,
      }}
      className="substrate-atmosphere-noise pointer-events-none absolute rounded-full opacity-75 mix-blend-overlay"
      aria-hidden="true"
    />
  );
}

function scoreOpacity(score: number) {
  return 0.2 + (score / 5) * 0.8;
}

function SubstrateOrb({
  submission,
  index,
  size,
  gaussian,
  grainSettings,
  animationSpeed,
}: {
  submission: SubstrateSubmission;
  index: number;
  size: number;
  gaussian: number;
  grainSettings: GrainSettings;
  animationSpeed: number;
}) {
  const red = scoreOpacity(submission.redScore);
  const blue = scoreOpacity(submission.blueScore);
  const yellow = scoreOpacity(submission.yellowScore);
  const rotation = ((index * 37) % 28) - 14;

  return (
    <figure
      className="flex min-w-0 flex-col items-center"
      style={{ width: size }}
      title={`${submission.name}: ${submission.redScore}, ${submission.blueScore}, ${submission.yellowScore}`}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            backgroundColor: "#030303",
            backgroundImage: [
              `radial-gradient(circle at 29% 30%, rgba(255,49,84,${red}) 0%, rgba(255,49,84,${red * 0.9}) 26%, transparent 68%)`,
              `radial-gradient(circle at 31% 74%, rgba(36,107,253,${blue}) 0%, rgba(36,107,253,${blue * 0.88}) 28%, transparent 69%)`,
              `radial-gradient(circle at 77% 52%, rgba(255,210,63,${yellow}) 0%, rgba(255,210,63,${yellow * 0.88}) 27%, transparent 68%)`,
            ].join(","),
            backgroundSize: "114% 114%",
            backgroundPosition: "48% 52%",
            filter: `blur(${gaussian}px) brightness(1.22) saturate(2) contrast(2)`,
            animation:
              animationSpeed > 0
                ? `substrate-color-drift ${1 / animationSpeed}s ease-in-out infinite alternate`
                : "none",
            animationDelay: `${-index * 0.73}s`,
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <GrainLayer
            size={size}
            settings={grainSettings}
            submissionSeed={index + 1}
            animationSpeed={animationSpeed}
          />
        </div>
      </div>
      <figcaption
        className="mt-2 max-w-full truncate text-center font-semibold tracking-[-0.01em] text-white/70"
        style={{ fontSize: Math.max(9, Math.min(13, size * 0.12)) }}
      >
        {submission.name}
      </figcaption>
    </figure>
  );
}

function ExperienceQrCode() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = `${window.location.origin}${SUBSTRATE_REDIRECT_PATH}`;
    void QRCode.toCanvas(canvas, url, {
      width: 116,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#FFFFFF" },
    });
  }, []);

  return (
    <div className="absolute bottom-5 right-5 z-30 flex items-end gap-3">
      <div className="pb-1 text-right">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
          Add your substrate
        </p>
        <p className="mt-1 font-mono text-[9px] text-white/35">
          /experience/substrate-blob
        </p>
      </div>
      <div className="rounded-xl bg-white p-1.5 shadow-[0_0_32px_rgba(255,255,255,0.12)]">
        <canvas
          ref={canvasRef}
          className="block h-[92px] w-[92px]"
          aria-label="QR code for the BBDO AI Creative Substrates experience"
        />
      </div>
    </div>
  );
}

function ColorLegend() {
  const [open, setOpen] = useState(false);

  const items = [
    { color: "#FF3154", label: "Red", meaning: "You like using AI as a tool" },
    { color: "#246BFD", label: "Blue", meaning: "You like to automate using AI" },
    { color: "#FFD23F", label: "Yellow", meaning: "You like to co-work with AI" },
  ];

  return (
    <div className="fixed bottom-5 left-20 z-30">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-white/12 bg-black/85 p-4 shadow-2xl backdrop-blur-xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
            Color legend
          </p>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.label} className="grid grid-cols-[12px_48px_1fr] items-start gap-2 text-xs">
                <span
                  className="mt-0.5 h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 14px ${item.color}80` }}
                  aria-hidden="true"
                />
                <span className="font-bold text-white/85">{item.label}</span>
                <span className="leading-4 text-white/55">{item.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full border border-white/12 bg-black/70 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 shadow-xl backdrop-blur-md transition hover:border-white/25 hover:text-white"
      >
        <span aria-hidden="true">{open ? "−" : "+"}</span>
        Color legend
      </button>
    </div>
  );
}

export default function Slide3LiquidOrbs() {
  const [submissions, setSubmissions] = useState<SubstrateSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const [gaussian, setGaussian] = useState(8);
  const [grainAmount, setGrainAmount] = useState(0.04);
  const [grainBackground, setGrainBackground] = useState(0.08);
  const [grainSpread, setGrainSpread] = useState(144);
  const [grainOffset, setGrainOffset] = useState(6);
  const [grainGlow, setGrainGlow] = useState(4);
  const [grainSeed, setGrainSeed] = useState(27);
  const [animationSpeed, setAnimationSpeed] = useState(0.6);
  const [tuningVisible, setTuningVisible] = useState(false);

  useEffect(() => {
    const submissionsQuery = query(
      collection(firestore, SUBSTRATE_COLLECTION),
      orderBy("submittedAt", "asc"),
    );
    return onSnapshot(
      submissionsQuery,
      (snapshot) => {
        setSubmissions(
          snapshot.docs.map((document) =>
            normalizeSubstrateSubmission(document.id, document.data()),
          ),
        );
        setLoadError("");
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load substrate responses:", error);
        setLoadError("Live responses are unavailable");
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const tuningRef = ref(realtimeDatabase, SUBSTRATE_TUNING_PATH);
    return onValue(tuningRef, (snapshot) => {
      if (!snapshot.exists()) {
        setTuningVisible(false);
        void runTransaction(tuningRef, (current) => current ?? { visible: false, updatedAt: Date.now() });
        return;
      }
      const value = snapshot.val() as { visible?: unknown } | null;
      setTuningVisible(value?.visible === true);
    });
  }, []);

  const layout = useMemo(() => {
    const count = Math.max(1, submissions.length);
    const columns = Math.min(ORBS_PER_ROW, count);
    const rows = Math.ceil(count / ORBS_PER_ROW);
    const columnGap = 32;
    const rowGap = 24;
    const widthAvailable = Math.max(320, viewport.width - 120);
    const heightAvailable = Math.max(220, viewport.height - 215);
    const horizontalFit =
      (widthAvailable - columnGap * Math.max(0, columns - 1)) / columns;
    const verticalFit =
      (heightAvailable - rowGap * Math.max(0, rows - 1)) / rows - 22;
    const size = Math.max(28, Math.min(100, horizontalFit, verticalFit));
    return { columns, columnGap, rowGap, size };
  }, [submissions.length, viewport]);

  const grainSettings = useMemo<GrainSettings>(
    () => ({
      amount: grainAmount,
      background: grainBackground,
      spread: grainSpread,
      offset: grainOffset,
      glow: grainGlow,
      seed: grainSeed,
    }),
    [grainAmount, grainBackground, grainGlow, grainOffset, grainSeed, grainSpread],
  );

  const submissionRows = useMemo(() => {
    const rows: SubstrateSubmission[][] = [];
    for (let start = 0; start < submissions.length; start += ORBS_PER_ROW) {
      rows.push(submissions.slice(start, start + ORBS_PER_ROW));
    }
    return rows;
  }, [submissions]);

  return (
    <section
      className="fixed inset-0 overflow-hidden bg-black text-white"
      aria-label="Live BBDO AI Creative Substrates audience visualization"
    >
      <style jsx global>{`
        @keyframes substrate-color-drift {
          0% {
            background-position: 45% 53%;
          }
          50% {
            background-position: 52% 46%;
          }
          100% {
            background-position: 57% 51%;
          }
        }

        @keyframes substrate-atmosphere-flow {
          0% {
            transform: translate3d(-1.5px, 1px, 0) rotate(0deg) scale(1.025);
          }
          33% {
            transform: translate3d(1px, -1.5px, 0) rotate(119deg) scale(1.045);
          }
          66% {
            transform: translate3d(-0.5px, 1.5px, 0) rotate(241deg) scale(1.035);
          }
          100% {
            transform: translate3d(-1.5px, 1px, 0) rotate(360deg) scale(1.025);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [style*="substrate-color-drift"],
          .substrate-atmosphere-noise {
            animation: none !important;
          }
        }
      `}</style>

      <h1 className="absolute inset-x-0 top-7 z-20 whitespace-nowrap text-center text-[clamp(1.35rem,4.4vw,3rem)] font-black tracking-[-0.045em]">
        BBDO AI CREATIVE SUBSTRATES
      </h1>

      <div className="absolute inset-x-12 bottom-16 top-24 flex items-center justify-center overflow-hidden">
        {loading ? (
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/30">
            Loading live substrates…
          </p>
        ) : loadError ? (
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-red-300/70">
            {loadError}
          </p>
        ) : submissions.length === 0 ? (
          <div className="text-center">
            <div className="mx-auto h-24 w-24 rounded-full border border-dashed border-white/15" />
            <p className="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-white/30">
              Waiting for the first substrate
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center" style={{ rowGap: layout.rowGap }}>
            {submissionRows.map((row, rowIndex) => (
              <div
                key={row[0]?.id ?? rowIndex}
                className="grid place-items-start justify-center"
                style={{
                  gridTemplateColumns: `repeat(${row.length}, ${layout.size}px)`,
                  columnGap: layout.columnGap,
                }}
              >
                {row.map((submission, columnIndex) => (
                  <SubstrateOrb
                    key={submission.id}
                    submission={submission}
                    index={rowIndex * ORBS_PER_ROW + columnIndex}
                    size={layout.size}
                    gaussian={gaussian}
                    grainSettings={grainSettings}
                    animationSpeed={animationSpeed}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <ExperienceQrCode />
      <ColorLegend />

      {tuningVisible && (
        <aside className="fixed left-5 top-24 z-40 w-[calc(100vw-2.5rem)] max-w-[28rem] rounded-xl border border-white/12 bg-black/75 p-3 shadow-2xl backdrop-blur-xl xl:top-5">
          <div className="mb-3 grid grid-cols-[1fr_auto] items-start gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/85">
                Live tuning
              </p>
              <p className="mt-1 text-[10px] leading-4 text-white/40">
                Reference grain · controlled from admin
              </p>
            </div>
            <p className="pt-0.5 text-right font-mono text-[9px] uppercase leading-4 tracking-[0.12em] text-white/45">
              Brightness 1.22
              <br />
              Saturation 2 · Contrast 2
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <NumberField label="Gaussian" value={gaussian} min={0} max={30} step={0.5} onChange={setGaussian} />
            <NumberField label="Amount" value={grainAmount} min={0} max={0.1} step={0.005} onChange={setGrainAmount} />
            <NumberField label="Background" value={grainBackground} min={0} max={0.25} step={0.01} onChange={setGrainBackground} />
            <NumberField label="Spread" value={grainSpread} min={60} max={240} step={2} onChange={setGrainSpread} />
            <NumberField label="Offset" value={grainOffset} min={-48} max={48} step={1} onChange={setGrainOffset} />
            <NumberField label="Glow px" value={grainGlow} min={0} max={32} step={0.5} onChange={setGrainGlow} />
            <NumberField label="Seed" value={grainSeed} min={1} max={99} step={1} onChange={setGrainSeed} />
            <NumberField label="Animation" value={animationSpeed} min={0} max={1} step={0.01} onChange={setAnimationSpeed} />
          </div>
        </aside>
      )}
    </section>
  );
}
