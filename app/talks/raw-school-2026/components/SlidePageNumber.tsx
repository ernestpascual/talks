import { SLIDE_COUNT } from "@/lib/talks/raw-school-2026/slides";

type SlidePageNumberProps = {
  current: number;
};

export default function SlidePageNumber({ current }: SlidePageNumberProps) {
  return (
    <p
      className="pointer-events-none fixed right-6 top-6 z-50 text-sm font-medium tabular-nums tracking-wide text-white/80"
      aria-label={`Slide ${current} of ${SLIDE_COUNT}`}
    >
      {current}
    </p>
  );
}
