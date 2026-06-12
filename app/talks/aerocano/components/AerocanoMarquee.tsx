import styles from "./AerocanoMarquee.module.css";

const LABEL = "AEROCANO";
const ITEMS = [LABEL, LABEL] as const;

type AerocanoMarqueeProps = {
  className?: string;
};

export default function AerocanoMarquee({ className }: AerocanoMarqueeProps) {
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
