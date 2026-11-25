import type { PersonTrack } from "./analytics";

export type MotionStatus = "sampling" | "moving" | "steady" | "low-detail";
export interface PersonMotion {
  id: number;
  score: number | null;
  status: MotionStatus;
}
export interface GrayFrame {
  data: Uint8Array;
  width: number;
  height: number;
}
export interface DanceSnapshot {
  people: PersonMotion[];
  sceneChanged: boolean;
}

interface MotionState {
  patch: Uint8Array;
  bbox: PersonTrack["bbox"];
  patchBox: PersonTrack["bbox"];
  detectionAt: number;
  sampledAt: number;
  startedAt: number;
  samples: number;
  smoothed: number;
  boxActivity: number;
  boxChangedAt: number;
  activeMs: number;
  quietMs: number;
  moving: boolean | null;
}

export const MOTION_LABELS: Record<MotionStatus, string> = {
  sampling: "Sampling",
  moving: "Moving",
  steady: "Steady",
  "low-detail": "Low detail",
};

const PATCH_COLUMNS = 12;
const PATCH_ROWS = 20;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function samplePatch(frame: GrayFrame, bbox: PersonTrack["bbox"]): Uint8Array {
  const patch = new Uint8Array(PATCH_COLUMNS * PATCH_ROWS);
  for (let row = 0; row < PATCH_ROWS; row++) {
    const y = Math.max(
      0,
      Math.min(
        frame.height - 1,
        Math.floor(
          (bbox[1] + bbox[3] * (0.08 + ((row + 0.5) / PATCH_ROWS) * 0.84)) *
            frame.height,
        ),
      ),
    );
    for (let column = 0; column < PATCH_COLUMNS; column++) {
      const x = Math.max(
        0,
        Math.min(
          frame.width - 1,
          Math.floor(
            (bbox[0] +
              bbox[2] * (0.08 + ((column + 0.5) / PATCH_COLUMNS) * 0.84)) *
              frame.width,
          ),
        ),
      );
      patch[row * PATCH_COLUMNS + column] = frame.data[y * frame.width + x];
    }
  }
  return patch;
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values.length ? values[Math.floor(values.length / 2)] : 0;
}

// Use background samples to suppress exposure changes and obvious camera shifts.
// No background is inferred when a dense crowd fills the entire image.
function sceneDifference(
  frame: GrayFrame,
  previous: GrayFrame,
  tracks: PersonTrack[],
) {
  const points: number[] = [];
  const deltas: number[] = [];
  const globalDeltas: number[] = [];
  for (let row = 1; row < 12; row++) {
    for (let column = 1; column < 20; column++) {
      const x = column / 20;
      const y = row / 12;
      const index =
        Math.floor(y * frame.height) * frame.width +
        Math.floor(x * frame.width);
      globalDeltas.push(frame.data[index] - previous.data[index]);
      if (
        tracks.some(
          ({ bbox: [left, top, width, height] }) =>
            x >= left - 0.02 &&
            x <= left + width + 0.02 &&
            y >= top - 0.02 &&
            y <= top + height + 0.02,
        )
      )
        continue;
      if (
        Math.floor(x * frame.width) < 2 ||
        Math.floor(x * frame.width) >= frame.width - 2 ||
        Math.floor(y * frame.height) < 2 ||
        Math.floor(y * frame.height) >= frame.height - 2
      )
        continue;
      points.push(index);
      deltas.push(frame.data[index] - previous.data[index]);
    }
  }
  if (points.length < 16)
    return { brightnessDelta: median(globalDeltas), changed: false };
  const brightnessDelta = median(deltas);
  const error = (dx: number, dy: number) =>
    points.reduce((total, index) => {
      const shifted = index + dy * frame.width + dx;
      return (
        total +
        Math.min(
          60,
          Math.abs(
            frame.data[index] - previous.data[shifted] - brightnessDelta,
          ),
        )
      );
    }, 0) / points.length;
  const baseline = error(0, 0);
  let best = baseline;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      if (dx || dy) best = Math.min(best, error(dx, dy));
    }
  return {
    brightnessDelta,
    changed: baseline > 25 || (baseline > 5 && best < baseline * 0.65),
  };
}

export class DanceMotionAnalyzer {
  private states = new Map<number, MotionState>();
  private previousFrame: GrayFrame | null = null;
  private previousAt = 0;

  update(
    tracks: PersonTrack[],
    frame: GrayFrame,
    now: number,
    sensitivity = 1,
  ): DanceSnapshot {
    const previousFrame = this.previousFrame;
    const discontinuity =
      !previousFrame ||
      previousFrame.width !== frame.width ||
      previousFrame.height !== frame.height ||
      now - this.previousAt > 1_000;
    const scene = discontinuity
      ? { brightnessDelta: 0, changed: false }
      : sceneDifference(frame, previousFrame, tracks);
    if (discontinuity || scene.changed) this.states.clear();
    this.previousFrame = frame;
    this.previousAt = now;
    const currentIds = new Set(tracks.map((track) => track.id));
    for (const id of this.states.keys())
      if (!currentIds.has(id)) this.states.delete(id);
    const people = tracks.map((track): PersonMotion => {
      const previous = this.states.get(track.id);
      const patchBox =
        previous &&
        Math.hypot(
          (track.center[0] - previous.patchBox[0] - previous.patchBox[2] / 2) *
            frame.width,
          (track.center[1] - previous.patchBox[1] - previous.patchBox[3] / 2) *
            frame.height,
        ) < Math.max(1.5, track.bbox[3] * frame.height * 0.05) &&
        Math.abs(track.bbox[2] / previous.patchBox[2] - 1) < 0.06 &&
        Math.abs(track.bbox[3] / previous.patchBox[3] - 1) < 0.06
          ? previous.patchBox
          : track.bbox;
      const patch = samplePatch(frame, patchBox);
      let minimum = 255;
      let maximum = 0;
      let sum = 0;
      for (const value of patch) {
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
        sum += value;
      }
      const mean = sum / patch.length;
      const hasDetail =
        track.bbox[2] * frame.width >= 4 &&
        track.bbox[3] * frame.height >= 8 &&
        !(maximum - minimum < 6 && (mean < 8 || mean > 247));
      // A missed detection interrupts observation even if the tracker later reuses its ID.
      const continuous =
        previous &&
        now - previous.sampledAt <= 1_000 &&
        now - track.seenAt <= 6_000 &&
        !(track.direction === "new" && track.seenAt !== previous.detectionAt);
      if (!continuous || !hasDetail) {
        this.states.set(track.id, {
          patch,
          patchBox,
          bbox: track.bbox,
          detectionAt: track.seenAt,
          sampledAt: now,
          startedAt: now,
          samples: 1,
          smoothed: 0,
          boxActivity: 0,
          boxChangedAt: now,
          activeMs: 0,
          quietMs: 0,
          moving: null,
        });
        return {
          id: track.id,
          score: null,
          status: hasDetail ? "sampling" : "low-detail",
        };
      }
      const dt = Math.max(1, now - previous.sampledAt);
      let totalDifference = 0;
      let changedPixels = 0;
      for (let index = 0; index < patch.length; index++) {
        const difference = Math.abs(
          patch[index] - previous.patch[index] - scene.brightnessDelta,
        );
        totalDifference += Math.min(70, difference);
        if (difference > 12) changedPixels++;
      }
      const pixelActivity =
        clamp((totalDifference / patch.length - 3) / 20) * 0.5 +
        clamp((changedPixels / patch.length - 0.04) / 0.5) * 0.5;
      let boxActivity = previous.boxActivity;
      let boxChangedAt = previous.boxChangedAt;
      if (track.seenAt !== previous.detectionAt) {
        const seconds = Math.max(
          0.15,
          (track.seenAt - previous.detectionAt) / 1_000,
        );
        const bodyHeight = Math.max(
          0.02,
          (track.bbox[3] + previous.bbox[3]) / 2,
        );
        const dx =
          (track.bbox[0] +
            track.bbox[2] / 2 -
            previous.bbox[0] -
            previous.bbox[2] / 2) *
          frame.width;
        const dy =
          (track.bbox[1] +
            track.bbox[3] / 2 -
            previous.bbox[1] -
            previous.bbox[3] / 2) *
          frame.height;
        const speed =
          Math.max(
            0,
            Math.hypot(dx, dy) -
              Math.max(1.5, bodyHeight * frame.height * 0.025),
          ) /
          (bodyHeight * frame.height) /
          seconds;
        const shapeChange =
          (Math.max(
            0,
            Math.abs(Math.log(track.bbox[2] / previous.bbox[2])) - 0.08,
          ) +
            Math.max(
              0,
              Math.abs(Math.log(track.bbox[3] / previous.bbox[3])) - 0.08,
            )) /
          seconds;
        boxActivity = Math.max(
          clamp((speed - 0.05) / 0.6) * 0.85,
          clamp((shapeChange - 0.15) / 1.2) * 0.5,
        );
        boxChangedAt = now;
      }
      const raw = clamp(
        Math.max(
          pixelActivity,
          boxActivity * Math.exp(-(now - boxChangedAt) / 800),
        ) * Math.max(0.5, Math.min(2, sensitivity)),
      );
      const smoothed =
        previous.smoothed +
        (raw * 100 - previous.smoothed) * (1 - Math.exp(-dt / 650));
      const activeMs = smoothed >= 20 ? previous.activeMs + dt : 0;
      const quietMs = smoothed < 12 ? previous.quietMs + dt : 0;
      const moving =
        activeMs >= 400 ? true : quietMs >= 1_500 ? false : previous.moving;
      const state: MotionState = {
        patch,
        patchBox,
        bbox: track.bbox,
        detectionAt: track.seenAt,
        sampledAt: now,
        startedAt: previous.startedAt,
        samples: previous.samples + 1,
        smoothed,
        boxActivity,
        boxChangedAt,
        activeMs,
        quietMs,
        moving,
      };
      this.states.set(track.id, state);
      const ready =
        now - state.startedAt >= 2_000 && state.samples >= 8 && moving !== null;
      return {
        id: track.id,
        score: ready ? Math.round(smoothed) : null,
        status: ready ? (moving ? "moving" : "steady") : "sampling",
      };
    });
    return { people, sceneChanged: scene.changed };
  }
}

export function summarizeDancing(people: PersonMotion[]) {
  const moving = people.filter(
    (person) => person.status === "moving" && person.score !== null,
  );
  const steady = people.filter((person) => person.status === "steady");
  const measured = moving.length + steady.length;
  const sum = moving.reduce((total, person) => total + (person.score ?? 0), 0);
  return {
    index: measured ? Math.round(sum / measured) : null,
    movingIntensity: moving.length
      ? Math.round(sum / moving.length)
      : measured
        ? 0
        : null,
    moving: moving.length,
    steady: steady.length,
    measured,
    sampling: people.length - measured,
    participation: measured
      ? Math.round((moving.length / measured) * 100)
      : null,
  };
}
