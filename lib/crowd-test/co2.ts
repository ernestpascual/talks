export interface Co2Reading {
  ppm: number;
  measuredAt: number;
  receivedAt: number;
  source: "sensor" | "manual";
  people: number;
}

export function validCo2(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 1_000_000
  );
}

export function parseCo2(
  payload: unknown,
  now: number,
  people: number,
): Co2Reading {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("co2" in payload) ||
    !validCo2(payload.co2)
  ) {
    throw new Error(
      'The sensor must return JSON with a numeric "co2" value in ppm.',
    );
  }
  const timestamp = "timestamp" in payload ? payload.timestamp : undefined;
  const measuredAt =
    timestamp === undefined
      ? now
      : typeof timestamp === "number"
        ? timestamp
        : typeof timestamp === "string"
          ? Date.parse(timestamp)
          : NaN;
  if (
    !Number.isFinite(measuredAt) ||
    measuredAt < 0 ||
    measuredAt > now + 60_000
  )
    throw new Error(
      "The sensor timestamp must be an ISO date or Unix milliseconds, without a future date.",
    );
  return {
    ppm: Math.round(payload.co2),
    measuredAt,
    receivedAt: now,
    source: "sensor",
    people,
  };
}
