"use client";

import { useState } from "react";

import {
  DIRECTION_ARROWS,
  formatDwell,
  type PersonTrack,
  type summarizeCrowd,
} from "@/lib/crowd-test/analytics";
import type { Co2Reading } from "@/lib/crowd-test/co2";

import styles from "./crowd-test.module.css";

interface Props {
  tracks: PersonTrack[];
  summary: ReturnType<typeof summarizeCrowd>;
  size: { width: number; height: number };
  co2: Co2Reading | null;
  co2Stale: boolean;
  onClose: () => void;
}

export default function CrowdInsights({
  tracks,
  summary,
  size,
  co2,
  co2Stale,
  onClose,
}: Props) {
  const [page, setPage] = useState(0);
  const [showPeople, setShowPeople] = useState(false);
  const pageCount = Math.max(1, Math.ceil(tracks.length / 20));
  const currentPage = Math.min(page, pageCount - 1);
  const centroid = summary.centroid;
  return (
    <aside
      id="crowd-insights"
      aria-label="Crowd data"
      className={`${styles.panel} ${styles.analyticsPanel}`}
    >
      <div className={styles.panelHeader}>
        <span>LIVE CROWD DATA</span>
        <button aria-label="Close crowd data" onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.controls}>
        <div className={styles.insightGrid}>
          <div>
            <span>CAMERA L / C / R</span>
            <strong>
              {summary.balance.left} / {summary.balance.center} /{" "}
              {summary.balance.right}
            </strong>
          </div>
          <div>
            <span>BUSIEST ZONE</span>
            <strong>{summary.busiestZones.join(" + ") || "—"}</strong>
          </div>
          <div>
            <span>CROWD CENTER · PX</span>
            <strong>
              {centroid
                ? `${Math.round(centroid[0] * size.width)}, ${Math.round(centroid[1] * size.height)}`
                : "—"}
            </strong>
          </div>
          <div>
            <span>CO₂ · PPM</span>
            <strong>{co2 ? co2.ppm.toLocaleString() : "—"}</strong>
            <small>
              {co2
                ? `${co2.source}${co2Stale ? " · stale" : ""} · ${co2.people} people at sample`
                : "Connect a sensor or enter a reading"}
            </small>
          </div>
        </div>
        <div className={styles.controlSection}>
          <p className={styles.fieldLabel}>ZONES & CONTINUOUS DWELL</p>
          <div className={styles.zoneStats}>
            {summary.zones.map((zone) => (
              <div key={zone.id} className={styles.zoneStat}>
                <span>{zone.name}</span>
                <strong>{zone.count}</strong>
                <small>
                  Avg {formatDwell(zone.averageDwellMs)} · Max{" "}
                  {formatDwell(zone.longestDwellMs)}
                </small>
              </div>
            ))}
          </div>
          <p className={styles.hint}>
            {summary.outsideZones} outside defined zones. A person belongs to
            the first zone containing their center.
          </p>
        </div>
        <div className={styles.controlSection}>
          <p className={styles.fieldLabel}>MOVEMENT DIRECTION</p>
          <div className={styles.directionStats}>
            {Object.entries(summary.directions).map(([direction, value]) => (
              <span key={direction} title={direction}>
                <b>
                  {DIRECTION_ARROWS[direction as keyof typeof DIRECTION_ARROWS]}
                </b>
                {direction === "new"
                  ? "new"
                  : direction === "still"
                    ? "still"
                    : direction}{" "}
                <strong>{value}</strong>
              </span>
            ))}
          </div>
          <p className={styles.hint}>
            Directions, coordinates, and zone positions use the original camera
            image. Mirroring changes the preview. Heatmap density is relative to
            this image.
          </p>
        </div>
        <div className={styles.controlSection}>
          <button
            className={styles.secondaryButton}
            onClick={() => setShowPeople(!showPeople)}
            aria-expanded={showPeople}
            aria-controls="crowd-person-data"
          >
            {showPeople ? "Hide" : "Show"} person positions · {tracks.length}
          </button>
          {showPeople && (
            <div id="crowd-person-data">
              <p className={styles.hint}>
                Box: x, y, width, height in pixels. Height is apparent image
                height.
              </p>
              <div
                className={styles.tableScroll}
                tabIndex={0}
                role="region"
                aria-label="Person coordinates table"
              >
                <table className={styles.personTable}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Box · px</th>
                      <th>Center · px</th>
                      <th>Height</th>
                      <th>Zone</th>
                      <th>Dwell</th>
                      <th>Direction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks
                      .slice(currentPage * 20, (currentPage + 1) * 20)
                      .map((track) => (
                        <tr key={track.id}>
                          <td>#{track.id}</td>
                          <td>
                            {track.bbox
                              .map((value, index) =>
                                Math.round(
                                  value *
                                    (index % 2 ? size.height : size.width),
                                ),
                              )
                              .join(", ")}
                          </td>
                          <td>
                            {Math.round(track.center[0] * size.width)},{" "}
                            {Math.round(track.center[1] * size.height)}
                          </td>
                          <td>{Math.round(track.bbox[3] * size.height)}px</td>
                          <td>
                            {summary.zones.find(
                              (zone) => zone.id === track.zoneId,
                            )?.name ?? "Outside"}
                          </td>
                          <td>{formatDwell(track.dwellMs)}</td>
                          <td>
                            {DIRECTION_ARROWS[track.direction]}{" "}
                            {track.direction}
                          </td>
                        </tr>
                      ))}
                    {!tracks.length && (
                      <tr>
                        <td colSpan={7}>
                          Start the camera to populate person data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className={styles.pagination}>
                <button
                  disabled={!currentPage}
                  onClick={() => setPage(currentPage - 1)}
                >
                  ← Previous
                </button>
                <span>
                  {currentPage + 1} / {pageCount}
                </span>
                <button
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.panelFooter}>
        <p>
          Tracking IDs, dwell, and direction are estimates. Overlap, missed
          detections, and slow scans can switch IDs. Showing up to 20 table rows
          at once.
        </p>
      </div>
    </aside>
  );
}
