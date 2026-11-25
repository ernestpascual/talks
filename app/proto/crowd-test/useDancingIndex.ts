"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import type { PersonTrack } from "@/lib/crowd-test/analytics";
import {
  DanceMotionAnalyzer,
  summarizeDancing,
  type DanceSnapshot,
} from "@/lib/crowd-test/dance";

const EMPTY = {
  people: [],
  sceneChanged: false,
  session: -1,
} as DanceSnapshot & { session: number };

export function useDancingIndex(
  videoRef: RefObject<HTMLVideoElement | null>,
  tracks: PersonTrack[],
  live: boolean,
  sensitivity: number,
  session: number,
) {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [error, setError] = useState("");
  const tracksRef = useRef(tracks);
  const sensitivityRef = useRef(sensitivity);
  useEffect(() => {
    tracksRef.current = tracks;
    sensitivityRef.current = sensitivity;
  }, [tracks, sensitivity]);

  useEffect(() => {
    if (!live) return;
    const analyzer = new DanceMotionAnalyzer();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let timer: number;
    let lastPaint = -Infinity;
    let sceneAlertUntil = 0;
    let samplingError: string | null = null;
    function sample() {
      if (!context) {
        setError(
          "Movement sampling is unavailable. Restart the camera to try again.",
        );
        return;
      }
      const video = videoRef.current;
      const now = performance.now();
      if (
        context &&
        video &&
        !document.hidden &&
        video.readyState >= 2 &&
        video.videoWidth
      ) {
        try {
          const scale = Math.min(
            1,
            480 / Math.max(video.videoWidth, video.videoHeight),
          );
          const width = Math.round(video.videoWidth * scale);
          const height = Math.round(video.videoHeight * scale);
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          context.drawImage(video, 0, 0, width, height);
          const pixels = context.getImageData(0, 0, width, height).data;
          const gray = new Uint8Array(width * height);
          for (let index = 0; index < gray.length; index++) {
            const pixel = index * 4;
            gray[index] =
              (pixels[pixel] * 77 +
                pixels[pixel + 1] * 150 +
                pixels[pixel + 2] * 29) >>
              8;
          }
          const next = analyzer.update(
            tracksRef.current,
            { data: gray, width, height },
            now,
            sensitivityRef.current,
          );
          if (next.sceneChanged) sceneAlertUntil = now + 1_500;
          if (now - lastPaint >= 450) {
            setSnapshot({
              ...next,
              sceneChanged: now < sceneAlertUntil,
              session,
            });
            lastPaint = now;
          }
          if (samplingError !== "") {
            samplingError = "";
            setError("");
          }
        } catch {
          if (!samplingError) {
            samplingError =
              "Movement sampling is unavailable. Restart the camera to try again.";
            setError(samplingError);
          }
        }
      }
      timer = window.setTimeout(sample, 125);
    }
    timer = window.setTimeout(sample, 0);
    return () => window.clearTimeout(timer);
  }, [live, videoRef, session]);

  // Reconcile immediately with current detections so lost tracks never stay in totals.
  const people = useMemo(() => {
    const latest = new Map(
      (snapshot.session === session && !error ? snapshot.people : []).map(
        (person) => [person.id, person],
      ),
    );
    return live
      ? tracks.map(
          (track) =>
            latest.get(track.id) ?? {
              id: track.id,
              score: null,
              status: "sampling" as const,
            },
        )
      : [];
  }, [live, tracks, snapshot, session, error]);
  return {
    people,
    summary: useMemo(() => summarizeDancing(people), [people]),
    sceneChanged: live && snapshot.sceneChanged,
    error: live ? error : "",
  };
}
