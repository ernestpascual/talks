"use client";

import pricingDemoQr from "@/app/talks/raw-school-2026/img/pricingdemo.png";
import { faceBoundsToScreenStyle } from "@/lib/face-mesh/bounds";
/** Tune smile tiers: `lib/face-mesh/smile-config.ts` */
export { SMILE_SENSITIVITY, SMILE_TIER_DISCOUNTS } from "@/lib/face-mesh/smile-config";
import { useFaceMesh } from "@/lib/face-mesh/useFaceMesh";
import type { TrackingStatus } from "@/lib/face-mesh/tracking-status";
import { useCallback, useEffect, useRef, useState } from "react";
import QrOverlay from "./QrOverlay";

const START_PRICE = 100;
const PRICE_INCREASE_STEP = 0.5;
const TICK_MS = 1000;
const COUNTDOWN_SECONDS = 10;

function formatPrice(value: number) {
  return `Php ${value.toFixed(2)}`;
}

function personIndicator(faceCount: number) {
  if (faceCount === 1) {
    return {
      label: "1 person detected",
      className: "border-emerald-400/60 bg-emerald-500/20 text-emerald-100",
      dot: "bg-emerald-400",
    };
  }
  if (faceCount === 0) {
    return {
      label: "No person detected",
      className: "border-white/25 bg-black/50 text-white/70",
      dot: "bg-white/40",
    };
  }
  return {
    label: `${faceCount} people detected — need exactly 1`,
    className: "border-red-400/60 bg-red-500/20 text-red-100",
    dot: "bg-red-400",
  };
}

function expressionIndicatorClass(active: boolean, variant: "smile" | "neutral") {
  if (!active) {
    return "border-white/15 bg-black/30 text-white/35";
  }
  if (variant === "smile") {
    return "border-emerald-400/70 bg-emerald-500/35 text-emerald-50 shadow-[0_0_24px_rgba(52,211,153,0.35)]";
  }
  return "border-amber-400/70 bg-amber-500/25 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.25)]";
}

function statusHint(
  status: TrackingStatus,
  countdown: number | null,
  faceCount: number,
) {
  if (status === "error") return "Camera unavailable";
  if (status === "loading-model" || status === "loading-camera") {
    return "Loading MediaPipe…";
  }
  if (countdown === null) return "Press Start when one person is in frame";
  if (countdown === 0) return "Time's up — price locked";
  if (faceCount !== 1) return "Waiting for exactly one person";
  return "Bigger smile = bigger discount (up to −2.00) · neutral face +0.50";
}

export default function Slide6EyeTrack() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const smileDiscountRef = useRef(0);

  const [price, setPrice] = useState(START_PRICE);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const priceChangesActive = countdown !== null && countdown > 0;
  const sessionStarted = countdown !== null;

  const handleError = useCallback((message: string) => {
    setErrorMessage(message);
  }, []);

  const { bindVideoRef, faceCount, faceBounds, isSmiling, smileDiscount, status } =
    useFaceMesh({
    videoRef,
    enabled: true,
    maxNumFaces: 2,
    onError: handleError,
  });

  smileDiscountRef.current = smileDiscount;

  const onePerson = faceCount === 1;

  useEffect(() => {
    if (!priceChangesActive || faceCount !== 1) return;

    const id = window.setInterval(() => {
      setPrice((current) => {
        const discount = smileDiscountRef.current;
        if (discount > 0) {
          return Math.max(0, current - discount);
        }
        return current + PRICE_INCREASE_STEP;
      });
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [priceChangesActive, faceCount]);

  useEffect(() => {
    if (!priceChangesActive) return;

    const id = window.setInterval(() => {
      setCountdown((current) => (current === null || current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [priceChangesActive]);

  const indicator = personIndicator(faceCount);
  const canPlay = status !== "error" && status !== "loading-model";

  function handleStart() {
    setErrorMessage(null);
    setPrice(START_PRICE);
    setCountdown(COUNTDOWN_SECONDS);
  }

  function handleReset() {
    setCountdown(null);
    setPrice(START_PRICE);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <video
        ref={bindVideoRef}
        muted
        playsInline
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {faceBounds && faceCount === 1 ? (
        <div
          className="pointer-events-none absolute z-[5] animate-pulse rounded-[38%] border-2 border-[#DB1A1A] shadow-[0_0_24px_rgba(219,26,26,0.45)]"
          style={faceBoundsToScreenStyle(faceBounds)}
          aria-hidden
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-[6] bg-black/25" aria-hidden />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="p-6">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-md ${indicator.className}`}
            role="status"
            aria-live="polite"
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${indicator.dot}`}
              aria-hidden
            />
            {indicator.label}
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
          <div
            className="mb-10 flex flex-wrap items-center justify-center gap-4"
            role="status"
            aria-live="polite"
          >
            <span
              className={`rounded-full border px-6 py-3 text-base font-semibold uppercase tracking-wider backdrop-blur-md transition-all sm:text-lg ${expressionIndicatorClass(onePerson && isSmiling, "smile")}`}
            >
              {onePerson && smileDiscount > 0
                ? `Smiling −${smileDiscount.toFixed(2)}`
                : "Smiling"}
            </span>
            <span
              className={`rounded-full border px-6 py-3 text-base font-semibold uppercase tracking-wider backdrop-blur-md transition-all sm:text-lg ${expressionIndicatorClass(onePerson && !isSmiling, "neutral")}`}
            >
              Not smiling
            </span>
          </div>

          {countdown !== null && countdown > 0 ? (
            <p
              className="mb-6 text-center text-8xl font-bold tabular-nums text-white drop-shadow-lg sm:text-9xl"
              aria-live="polite"
            >
              {countdown}
            </p>
          ) : null}

          <p className="text-center text-5xl font-bold tracking-tight text-white drop-shadow-lg sm:text-7xl md:text-8xl">
            {formatPrice(price)}
          </p>
          <p className="mt-4 text-center text-sm text-white/75 sm:text-base">
            {statusHint(status, countdown, faceCount)}
          </p>
          {errorMessage ? (
            <p className="mt-2 text-center text-sm text-red-300">{errorMessage}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 p-6 pb-10">
          <button
            type="button"
            onClick={handleStart}
            disabled={!canPlay || sessionStarted}
            className="rounded-full border border-white/30 bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wider text-black transition-opacity hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-white/40 bg-black/50 px-8 py-3 text-sm font-semibold uppercase tracking-wider text-white backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      </div>

      <QrOverlay image={pricingDemoQr} ariaLabel="Pricing demo QR code" />
    </div>
  );
}