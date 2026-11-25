import type { PersonDetection } from "./detection";

export interface CrowdZone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_ZONES: CrowdZone[] = [
  { id: "zone-a", name: "Zone A", x: 0, y: 0, width: 1 / 3, height: 1 },
  { id: "zone-b", name: "Zone B", x: 1 / 3, y: 0, width: 1 / 3, height: 1 },
  { id: "zone-c", name: "Zone C", x: 2 / 3, y: 0, width: 1 / 3, height: 1 },
];

export type Direction =
  "new" | "still" | "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export const DIRECTION_ARROWS: Record<Direction, string> = {
  new: "·",
  still: "•",
  N: "↑",
  NE: "↗",
  E: "→",
  SE: "↘",
  S: "↓",
  SW: "↙",
  W: "←",
  NW: "↖",
};

export interface PersonTrack extends PersonDetection {
  id: number;
  center: [number, number];
  direction: Direction;
  zoneId: string | null;
  dwellMs: number;
  seenAt: number;
  misses: number;
}

export function zoneAt(
  center: [number, number],
  zones: CrowdZone[],
): CrowdZone | undefined {
  // First zone wins where custom regions overlap, keeping zone totals additive.
  return zones.find(
    (zone) =>
      center[0] >= zone.x &&
      center[1] >= zone.y &&
      (center[0] < zone.x + zone.width ||
        (zone.x + zone.width >= 1 && center[0] <= 1)) &&
      (center[1] < zone.y + zone.height ||
        (zone.y + zone.height >= 1 && center[1] <= 1)),
  );
}

function overlap(
  a: PersonDetection["bbox"],
  b: PersonDetection["bbox"],
): number {
  const intersection =
    Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])) *
    Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  return (
    intersection / Math.max(1e-9, a[2] * a[3] + b[2] * b[3] - intersection)
  );
}

function movement(
  dx: number,
  dy: number,
  frameWidth: number,
  frameHeight: number,
): Direction {
  const distance = Math.hypot(dx * frameWidth, dy * frameHeight);
  if (distance < Math.max(4, Math.min(frameWidth, frameHeight) * 0.008))
    return "still";
  const compass: Direction[] = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  return compass[
    (Math.round(Math.atan2(dy * frameHeight, dx * frameWidth) / (Math.PI / 4)) +
      8) %
      8
  ];
}

export class CrowdTracker {
  private previous: PersonTrack[] = [];
  private nextId = 1;
  private zoneSignature = "";

  update(
    detections: PersonDetection[],
    now: number,
    zones: CrowdZone[],
    width: number,
    height: number,
  ): PersonTrack[] {
    const signature = JSON.stringify(
      zones.map(({ id, x, y, width, height }) => [id, x, y, width, height]),
    );
    const changedZones = signature !== this.zoneSignature;
    this.zoneSignature = signature;
    const previous = this.previous.filter(
      (track) => now - track.seenAt <= 6_000 && track.misses < 2,
    );
    const centers = detections.map(
      ({ bbox: [x, y, w, h] }) => [x + w / 2, y + h / 2] as [number, number],
    );
    const candidates: Array<{
      track: number;
      detection: number;
      score: number;
    }> = [];
    previous.forEach((track, trackIndex) => {
      const radius = Math.max(
        0.035,
        Math.min(0.16, Math.hypot(track.bbox[2], track.bbox[3]) * 0.55),
      );
      const trackArea = Math.max(1e-9, track.bbox[2] * track.bbox[3]);
      detections.forEach((detection, detectionIndex) => {
        const center = centers[detectionIndex];
        const distanceSquared =
          (center[0] - track.center[0]) ** 2 +
          (center[1] - track.center[1]) ** 2;
        if (distanceSquared > radius * radius) return;
        const sizeRatio = (detection.bbox[2] * detection.bbox[3]) / trackArea;
        if (sizeRatio < 0.35 || sizeRatio > 2.85) return;
        candidates.push({
          track: trackIndex,
          detection: detectionIndex,
          score:
            overlap(track.bbox, detection.bbox) * 2 +
            1 -
            Math.sqrt(distanceSquared) / radius,
        });
      });
    });
    candidates.sort((a, b) => b.score - a.score);
    const matched = new Map<number, PersonTrack>();
    const usedTracks = new Set<number>();
    for (const candidate of candidates) {
      if (matched.has(candidate.detection) || usedTracks.has(candidate.track))
        continue;
      matched.set(candidate.detection, previous[candidate.track]);
      usedTracks.add(candidate.track);
    }
    const visible = detections.map((detection, index): PersonTrack => {
      const prior = matched.get(index);
      const center = centers[index];
      const zone = zoneAt(center, zones);
      const continuous = Boolean(
        prior && !prior.misses && !changedZones && now - prior.seenAt <= 6_000,
      );
      return {
        ...detection,
        id: prior?.id ?? this.nextId++,
        center,
        direction:
          prior && !prior.misses
            ? movement(
                center[0] - prior.center[0],
                center[1] - prior.center[1],
                width,
                height,
              )
            : "new",
        zoneId: zone?.id ?? null,
        dwellMs:
          prior && continuous && prior.zoneId === zone?.id && zone
            ? prior.dwellMs + Math.max(0, now - prior.seenAt)
            : 0,
        seenAt: now,
        misses: 0,
      };
    });
    this.previous = [
      ...visible,
      ...previous
        .filter((_, index) => !usedTracks.has(index))
        .map((track) => ({ ...track, misses: track.misses + 1 })),
    ];
    return visible;
  }
}

export function summarizeCrowd(tracks: PersonTrack[], zones: CrowdZone[]) {
  const columns = 8;
  const rows = 6;
  const heatmap = Array.from({ length: columns * rows }, () => 0);
  const directions = Object.fromEntries(
    Object.keys(DIRECTION_ARROWS).map((key) => [key, 0]),
  ) as Record<Direction, number>;
  const zoneStats = zones.map((zone) => ({
    ...zone,
    count: 0,
    averageDwellMs: 0,
    longestDwellMs: 0,
  }));
  const balance = { left: 0, center: 0, right: 0 };
  let xSum = 0;
  let ySum = 0;
  for (const track of tracks) {
    const [x, y] = track.center;
    xSum += x;
    ySum += y;
    balance[x < 1 / 3 ? "left" : x < 2 / 3 ? "center" : "right"]++;
    heatmap[
      Math.max(0, Math.min(rows - 1, Math.floor(y * rows))) * columns +
        Math.max(0, Math.min(columns - 1, Math.floor(x * columns)))
    ]++;
    directions[track.direction]++;
    const zone = zoneStats.find((item) => item.id === track.zoneId);
    if (zone) {
      zone.count++;
      zone.averageDwellMs += track.dwellMs;
      zone.longestDwellMs = Math.max(zone.longestDwellMs, track.dwellMs);
    }
  }
  for (const zone of zoneStats)
    if (zone.count) zone.averageDwellMs /= zone.count;
  const maxCount = Math.max(0, ...zoneStats.map((zone) => zone.count));
  return {
    balance,
    zones: zoneStats,
    directions,
    heatmap,
    columns,
    rows,
    heatmapMax: Math.max(1, ...heatmap),
    centroid: tracks.length
      ? ([xSum / tracks.length, ySum / tracks.length] as [number, number])
      : null,
    busiestZones: maxCount
      ? zoneStats
          .filter((zone) => zone.count === maxCount)
          .map((zone) => zone.name)
      : [],
    outsideZones:
      tracks.length - zoneStats.reduce((total, zone) => total + zone.count, 0),
  };
}

export function formatDwell(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
