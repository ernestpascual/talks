import styles from "./RawSchoolMarquee.module.css";

const LABEL = "RAW SCHOOL 2026";
/** Duplicated nodes for a seamless snap loop */
const ITEMS = [LABEL, LABEL] as const;

type RawSchoolMarqueeProps = {
  className?: string;
};

export default function RawSchoolMarquee({ className }: RawSchoolMarqueeProps) {
  return (
    <div className={className} aria-hidden>
      <div className={styles.viewport}>
        <ul className={styles.track}>
          {ITEMS.map((text, i) => (
            <li key={i} className={styles.item}>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
