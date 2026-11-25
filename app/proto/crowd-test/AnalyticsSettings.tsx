"use client";

import { useState } from "react";

import { DEFAULT_ZONES, type CrowdZone } from "@/lib/crowd-test/analytics";

import type { useCo2 } from "./useCo2";
import styles from "./crowd-test.module.css";

interface ZoneProps {
  zones: CrowdZone[];
  onChange: (zones: CrowdZone[]) => void;
  onDraw: () => void;
}

export function ZoneSettings({ zones, onChange, onDraw }: ZoneProps) {
  function changeBounds(
    id: string,
    key: "x" | "y" | "width" | "height",
    input: string,
  ) {
    const value = Number(input) / 100;
    if (!Number.isFinite(value)) return;
    onChange(
      zones.map((zone) => {
        if (zone.id !== id) return zone;
        const next = {
          ...zone,
          [key]: Math.max(
            key === "width" || key === "height" ? 0.03 : 0,
            Math.min(1, value),
          ),
        };
        next.x = Math.min(next.x, 0.97);
        next.y = Math.min(next.y, 0.97);
        next.width = Math.min(next.width, 1 - next.x);
        next.height = Math.min(next.height, 1 - next.y);
        return next;
      }),
    );
  }
  return (
    <div className={styles.controlSection}>
      <p className={styles.fieldLabel}>
        04 <span>Counting zones</span>
      </p>
      <p className={styles.hint}>
        Draw on the preview or enter rectangle percentages. Coordinates use the
        original camera image. Editing bounds restarts dwell estimates.
      </p>
      <div className={styles.inlineActions}>
        <button
          className={styles.secondaryButton}
          disabled={zones.length >= 8}
          onClick={onDraw}
        >
          Draw zone
        </button>
        <button
          className={styles.secondaryButton}
          onClick={() => onChange(DEFAULT_ZONES.map((zone) => ({ ...zone })))}
        >
          Reset zones
        </button>
      </div>
      <button
        className={styles.secondaryButton}
        disabled={zones.length >= 8}
        onClick={() =>
          onChange([
            ...zones,
            {
              id: `zone-${Date.now()}`,
              name: `Zone ${zones.length + 1}`,
              x: 0.25,
              y: 0.25,
              width: 0.5,
              height: 0.5,
            },
          ])
        }
      >
        Add rectangle with fields
      </button>
      {zones.map((zone, index) => (
        <div className={styles.zoneEditor} key={zone.id}>
          <div className={styles.zoneNameRow}>
            <input
              aria-label={`Zone ${index + 1} name`}
              maxLength={24}
              value={zone.name}
              onChange={(event) =>
                onChange(
                  zones.map((item) =>
                    item.id === zone.id
                      ? { ...item, name: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <button
              aria-label={`Delete ${zone.name || "zone"}`}
              onClick={() =>
                onChange(zones.filter((item) => item.id !== zone.id))
              }
            >
              ×
            </button>
          </div>
          <div className={styles.zoneFields}>
            {(["x", "y", "width", "height"] as const).map((key) => (
              <label key={key}>
                {key} %
                <input
                  aria-label={`Zone ${index + 1} ${key} percent`}
                  type="number"
                  inputMode="decimal"
                  min={key === "x" || key === "y" ? 0 : 3}
                  max="100"
                  step="1"
                  value={Math.round(zone[key] * 100)}
                  onChange={(event) =>
                    changeBounds(zone.id, key, event.target.value)
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <p className={styles.hint}>
        Up to 8 zones. Overlap is assigned to the first matching zone.
      </p>
    </div>
  );
}

export function Co2Settings({ co2 }: { co2: ReturnType<typeof useCo2> }) {
  const [url, setUrl] = useState("");
  const [ppm, setPpm] = useState("");
  return (
    <div className={styles.controlSection}>
      <p className={styles.fieldLabel}>
        05 <span>CO₂ + crowd count</span>
      </p>
      <p className={styles.hint}>
        CO₂ cannot be measured by this camera. Connect a real sensor endpoint or
        enter a reading from a meter.
      </p>
      <label className={styles.inputLabel} htmlFor="co2-url">
        Sensor JSON URL
      </label>
      <input
        id="co2-url"
        type="url"
        inputMode="url"
        placeholder="https://sensor.example/co2"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
      />
      <p className={styles.hint}>
        JSON: <code>{'{"co2":800}'}</code>. Optional <code>timestamp</code>: ISO
        date or Unix milliseconds. Polls every 5 seconds; HTTPS and browser CORS
        access are required on an HTTPS page.
      </p>
      <div className={styles.inlineActions}>
        <button
          className={styles.secondaryButton}
          onClick={() => co2.connect(url)}
        >
          Connect sensor
        </button>
        <button
          className={styles.secondaryButton}
          disabled={co2.status === "idle"}
          onClick={co2.disconnect}
        >
          Disconnect / clear
        </button>
      </div>
      <label className={styles.inputLabel} htmlFor="co2-manual">
        Manual meter reading · ppm
      </label>
      <input
        id="co2-manual"
        type="number"
        inputMode="numeric"
        min="1"
        max="1000000"
        placeholder="e.g. 800"
        value={ppm}
        onChange={(event) => setPpm(event.target.value)}
      />
      <button
        className={styles.secondaryButton}
        onClick={() => co2.manual(ppm)}
      >
        Use manual reading
      </button>
      <p className={styles.hint} role="status">
        {co2.status === "idle"
          ? "No CO₂ source connected."
          : co2.status === "connecting"
            ? "Connecting to sensor…"
            : co2.reading
              ? `${co2.reading.ppm.toLocaleString()} ppm · ${co2.reading.source}${co2.stale ? " · stale reading" : ""} · ${co2.reading.people} people at sample`
              : "Waiting for a valid reading."}
      </p>
      {co2.error && (
        <p className={styles.darkWarning} role="alert">
          {co2.error}
        </p>
      )}
    </div>
  );
}
