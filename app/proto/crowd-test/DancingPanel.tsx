"use client";

import {
  MOTION_LABELS,
  type PersonMotion,
  type summarizeDancing,
} from "@/lib/crowd-test/dance";

import styles from "./crowd-test.module.css";

interface Props {
  people: PersonMotion[];
  summary: ReturnType<typeof summarizeDancing>;
  hiddenIds: Set<number>;
  onToggle: (id: number) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  onClose: () => void;
}

export default function DancingPanel({
  people,
  summary,
  hiddenIds,
  onToggle,
  onShowAll,
  onHideAll,
  onClose,
}: Props) {
  return (
    <aside
      id="crowd-people"
      aria-label="People dancing monitor"
      className={`${styles.panel} ${styles.peoplePanel}`}
    >
      <div className={styles.panelHeader}>
        <span>DANCING / PEOPLE</span>
        <button aria-label="Close people monitor" onClick={onClose}>
          ×
        </button>
      </div>
      <div className={styles.controls}>
        <div className={styles.insightGrid}>
          <div>
            <span>MOVING INTENSITY</span>
            <strong>
              {summary.movingIntensity === null
                ? "—"
                : `${summary.movingIntensity}/100`}
            </strong>
          </div>
          <div>
            <span>PARTICIPATION</span>
            <strong>
              {summary.participation === null
                ? "—"
                : `${summary.participation}%`}
            </strong>
            <small>
              {summary.measured} measured · {summary.sampling} sampling / low
              detail
            </small>
          </div>
        </div>
        <div className={styles.peopleListHeader}>
          <span>SHOW PERSON OVERLAYS · {people.length}</span>
          <div>
            <button onClick={onShowAll}>Show all</button>
            <button onClick={onHideAll}>Hide all</button>
          </div>
        </div>
        <div className={styles.peopleList}>
          {[...people]
            .sort((a, b) => a.id - b.id)
            .map((person) => (
              <label
                key={person.id}
                className={styles.personRow}
                data-motion={person.status}
              >
                <input
                  type="checkbox"
                  checked={!hiddenIds.has(person.id)}
                  aria-label={`Show person ${person.id}`}
                  onChange={() => onToggle(person.id)}
                />
                <span>
                  <b>Person #{String(person.id).padStart(2, "0")}</b>
                  <small>
                    {MOTION_LABELS[person.status]}
                    {hiddenIds.has(person.id) ? " · overlay hidden" : ""}
                  </small>
                </span>
                <strong>
                  {person.score === null ? "…" : person.score}
                  <small>/100</small>
                </strong>
                <span className={styles.motionBar} aria-hidden="true">
                  <i style={{ width: `${person.score ?? 0}%` }} />
                </span>
              </label>
            ))}
          {!people.length && (
            <p className={styles.hint}>
              Start the camera. Each detected person appears here automatically.
            </p>
          )}
        </div>
      </div>
      <div className={styles.panelFooter}>
        <p>Uncheck to hide overlays. All people remain in the metrics.</p>
        <details className={styles.scoreHelp}>
          <summary>About scores & tracking</summary>
          <p>
            Dancing index = moving scores added together ÷ measured people.
            Steady people contribute zero. This is a movement estimate; walking
            and other motion can also score. IDs can change after overlap or
            tracking loss.
          </p>
        </details>
      </div>
    </aside>
  );
}
