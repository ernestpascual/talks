"use client";

import { useEffect, useRef, useState } from "react";

import { parseCo2, validCo2, type Co2Reading } from "@/lib/crowd-test/co2";

export function useCo2(people: number) {
  const [reading, setReading] = useState<Co2Reading | null>(null);
  const [connection, setConnection] = useState<{
    url: string;
    generation: number;
  } | null>(null);
  const generationRef = useRef(0);
  const endpoint = connection?.url ?? "";
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error" | "manual"
  >("idle");
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const peopleRef = useRef(people);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  useEffect(() => {
    if (!reading) return;
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [reading]);

  useEffect(() => {
    if (!connection) return;
    const { url, generation } = connection;
    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    async function poll() {
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 5_000);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
          credentials: "omit",
        });
        if (!response.ok)
          throw new Error(`The sensor returned HTTP ${response.status}.`);
        const sample = parseCo2(
          await response.json(),
          Date.now(),
          peopleRef.current,
        );
        if (cancelled || generationRef.current !== generation) return;
        setReading(sample);
        setNow(Date.now());
        setStatus("connected");
        setError("");
      } catch (cause) {
        if (cancelled || generationRef.current !== generation) return;
        setStatus("error");
        setError(
          cause instanceof Error &&
            cause.name !== "TypeError" &&
            cause.name !== "AbortError"
            ? cause.message
            : "Could not read the sensor. Check its URL, HTTPS, and browser CORS access.",
        );
      } finally {
        window.clearTimeout(timeout);
        if (!cancelled && generationRef.current === generation)
          timer = window.setTimeout(() => void poll(), 5_000);
      }
    }
    void poll();
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearTimeout(timer);
    };
  }, [connection]);

  function connect(url: string) {
    try {
      const parsed = new URL(url, window.location.origin);
      if (
        !url.trim() ||
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        throw new Error(
          "Enter an HTTP or HTTPS sensor URL without embedded credentials.",
        );
      if (window.location.protocol === "https:" && parsed.protocol === "http:")
        throw new Error("This HTTPS page needs an HTTPS sensor endpoint.");
      setReading(null);
      setNow(Date.now());
      setError("");
      setStatus("connecting");
      setConnection({ url: parsed.href, generation: ++generationRef.current });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Enter a valid sensor URL.",
      );
    }
  }

  function manual(value: string) {
    const ppm = Number(value);
    if (!validCo2(ppm)) {
      setError("Enter a positive CO₂ reading in ppm, up to 1,000,000.");
      return;
    }
    const timestamp = Date.now();
    generationRef.current++;
    setConnection(null);
    setStatus("manual");
    setError("");
    setNow(timestamp);
    setReading({
      ppm: Math.round(ppm),
      measuredAt: timestamp,
      receivedAt: timestamp,
      source: "manual",
      people: peopleRef.current,
    });
  }

  function disconnect() {
    generationRef.current++;
    setConnection(null);
    setStatus("idle");
    setReading(null);
    setError("");
  }
  const stale = Boolean(
    reading &&
    (now - reading.measuredAt > 30_000 ||
      (reading.source === "sensor" && status !== "connected")),
  );
  return {
    reading,
    status,
    error,
    stale,
    endpoint,
    connect,
    manual,
    disconnect,
  };
}
