import assert from "node:assert/strict";
import test from "node:test";

import type { PersonTrack } from "./analytics";
import { DanceMotionAnalyzer, summarizeDancing, type GrayFrame } from "./dance";

const WIDTH = 160;
const HEIGHT = 120;

function person(
  id: number,
  x: number,
  now: number,
  direction: PersonTrack["direction"] = "still",
): PersonTrack {
  return {
    id,
    bbox: [x, 0.2, 0.18, 0.55],
    center: [x + 0.09, 0.475],
    score: 0.9,
    direction,
    zoneId: null,
    dwellMs: 0,
    seenAt: now,
    misses: 0,
  };
}

function frame(
  phase = 0,
  moving = false,
  brightness = 0,
  shift = 0,
  texturedBackground = false,
): GrayFrame {
  const data = new Uint8Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const sourceX = x - shift;
      const inFirst =
        sourceX >= WIDTH * 0.1 &&
        sourceX < WIDTH * 0.28 &&
        y >= HEIGHT * 0.2 &&
        y < HEIGHT * 0.75;
      const inSecond =
        sourceX >= WIDTH * 0.65 &&
        sourceX < WIDTH * 0.83 &&
        y >= HEIGHT * 0.2 &&
        y < HEIGHT * 0.75;
      const background = texturedBackground
        ? 70 + ((((sourceX * 37 + y * 19 + sourceX * y * 7) % 90) + 90) % 90)
        : 120;
      const value = inFirst
        ? moving
          ? (Math.floor(sourceX / 2) + Math.floor(y / 3) + phase) % 2
            ? 60
            : 180
          : 90
        : inSecond
          ? 100
          : background;
      data[y * WIDTH + x] = Math.max(0, Math.min(255, value + brightness));
    }
  return { data, width: WIDTH, height: HEIGHT };
}

test("new tracks warm up before stationary people are counted", () => {
  const analyzer = new DanceMotionAnalyzer();
  let result = analyzer.update([person(1, 0.1, 1_000)], frame(), 1_000);
  assert.equal(result.people[0].score, null);
  for (let step = 1; step <= 24; step++)
    result = analyzer.update(
      [person(1, 0.1, 1_000 + step * 125)],
      frame(),
      1_000 + step * 125,
    );
  assert.equal(result.people[0].status, "steady");
  assert.equal(result.people[0].score, 0);
  assert.equal(summarizeDancing(result.people).steady, 1);
});

test("movement inside a stationary box scores while its neighbor stays steady", () => {
  const analyzer = new DanceMotionAnalyzer();
  let result = analyzer.update([], frame(), 1_000);
  for (let step = 0; step <= 32; step++) {
    const now = 1_000 + step * 125;
    result = analyzer.update(
      [person(1, 0.1, now), person(2, 0.65, now)],
      frame(step, true),
      now,
    );
  }
  assert.equal(result.people[0].status, "moving");
  assert.ok((result.people[0].score ?? 0) > 70);
  assert.equal(result.people[1].status, "steady");
  const summary = summarizeDancing(result.people);
  assert.equal(summary.moving, 1);
  assert.equal(summary.steady, 1);
  assert.equal(summary.index, Math.round((result.people[0].score ?? 0) / 2));
  assert.equal(summary.participation, 50);
});

test("uniform exposure changes do not score as dancing", () => {
  const analyzer = new DanceMotionAnalyzer();
  let result = analyzer.update([], frame(), 1_000);
  for (let step = 0; step <= 32; step++) {
    const now = 1_000 + step * 125;
    result = analyzer.update(
      [person(1, 0.1, now)],
      frame(0, false, step % 2 ? 25 : 0),
      now,
    );
  }
  assert.equal(result.people[0].status, "steady");
  assert.equal(result.people[0].score, 0);
});

test("small detector box jitter does not create a moving person", () => {
  const analyzer = new DanceMotionAnalyzer();
  let result = analyzer.update([], frame(), 1_000);
  for (let step = 0; step <= 32; step++) {
    const now = 1_000 + step * 125;
    result = analyzer.update(
      [person(1, 0.1 + (step % 2 ? 1 / WIDTH : 0), now)],
      frame(),
      now,
    );
  }
  assert.equal(result.people[0].status, "steady");
  assert.ok((result.people[0].score ?? 100) < 12);
});

test("exposure compensation also works when people cover the background", () => {
  const analyzer = new DanceMotionAnalyzer();
  let result = analyzer.update([], frame(), 1_000);
  for (let step = 0; step <= 24; step++) {
    const now = 1_000 + step * 125;
    const full = {
      ...person(1, 0, now),
      bbox: [0, 0, 1, 1] as [number, number, number, number],
      center: [0.5, 0.5] as [number, number],
    };
    result = analyzer.update([full], frame(0, false, step % 2 ? 25 : 0), now);
  }
  assert.equal(result.people[0].status, "steady");
  assert.equal(result.people[0].score, 0);
});

test("camera translation resets measurements instead of moving the whole crowd", () => {
  const analyzer = new DanceMotionAnalyzer();
  for (let step = 0; step <= 24; step++)
    analyzer.update(
      [person(1, 0.1, 1_000 + step * 125)],
      frame(0, false, 0, 0, true),
      1_000 + step * 125,
    );
  const result = analyzer.update(
    [person(1, 0.1, 4_125)],
    frame(0, false, 0, 1, true),
    4_125,
  );
  assert.equal(result.sceneChanged, true);
  assert.equal(result.people[0].status, "sampling");
  assert.equal(result.people[0].score, null);
});

test("tiny and entirely dark detections remain unmeasured", () => {
  const analyzer = new DanceMotionAnalyzer();
  const dark = {
    data: new Uint8Array(WIDTH * HEIGHT),
    width: WIDTH,
    height: HEIGHT,
  };
  for (let step = 0; step <= 24; step++) {
    const now = 1_000 + step * 125;
    const tiny = {
      ...person(2, 0.65, now),
      bbox: [0.65, 0.2, 0.01, 0.03] as [number, number, number, number],
    };
    const result = analyzer.update([person(1, 0.1, now), tiny], dark, now);
    assert.ok(
      result.people.every(
        (item) => item.status === "low-detail" && item.score === null,
      ),
    );
    assert.equal(summarizeDancing(result.people).index, null);
  }
});

test("sampling gaps, lost tracks and reacquired IDs restart observation", () => {
  const analyzer = new DanceMotionAnalyzer();
  for (let step = 0; step <= 24; step++)
    analyzer.update(
      [person(1, 0.1, 1_000 + step * 125)],
      frame(step, true),
      1_000 + step * 125,
    );
  let result = analyzer.update([person(1, 0.1, 6_000)], frame(0, true), 6_000);
  assert.equal(result.people[0].score, null);
  analyzer.update([], frame(), 6_125);
  result = analyzer.update([person(1, 0.1, 6_250)], frame(0, true), 6_250);
  assert.equal(result.people[0].status, "sampling");
  result = analyzer.update(
    [person(1, 0.1, 6_375, "new")],
    frame(1, true),
    6_375,
  );
  assert.equal(result.people[0].score, null);
});

test("crowd index weights moving scores by measured participation", () => {
  assert.deepEqual(
    summarizeDancing([
      { id: 1, score: 80, status: "moving" },
      { id: 2, score: 0, status: "steady" },
      { id: 3, score: null, status: "sampling" },
    ]),
    {
      index: 40,
      movingIntensity: 80,
      moving: 1,
      steady: 1,
      measured: 2,
      sampling: 1,
      participation: 50,
    },
  );
  assert.equal(summarizeDancing([]).index, null);
  assert.equal(
    summarizeDancing([{ id: 1, score: 0, status: "steady" }]).index,
    0,
  );
});
