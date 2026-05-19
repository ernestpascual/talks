export const TALK_SLUG = "raw-school-2026";
export const SLIDE_COUNT = 14;
export const TALK_BASE_PATH = `/talks/${TALK_SLUG}`;

export type Slide =
  | { number: 1; kind: "hero-image" }
  | { number: 2; kind: "artwork-video" }
  | { number: 3; kind: "venn" }
  | { number: 4; kind: "artwork" }
  | { number: 5; kind: "artwork" }
  | { number: 6; kind: "statement-eye"; text: string }
  | { number: 7; kind: "poll"; title: string; subtitle: string }
  | { number: 8; kind: "artwork-video" }
  | { number: 9; kind: "fruit-ninja" }
  | { number: 10; kind: "artwork" }
  | { number: 11; kind: "statement"; text: string }
  | { number: 12; kind: "heading"; text: string }
  | { number: 13; kind: "artwork-video" }
  | { number: 14; kind: "artwork-video" };

export const slides: Slide[] = [
  { number: 1, kind: "hero-image" },
  { number: 2, kind: "artwork-video" },
  { number: 3, kind: "venn" },
  { number: 4, kind: "artwork" },
  { number: 5, kind: "artwork" },
  {
    number: 6,
    kind: "statement-eye",
    text: "the input becomes output if i process",
  },
  {
    number: 7,
    kind: "poll",
    title: "how do you use AI",
    subtitle: "poll the canvas → results processed by LLM → weight IPO",
  },
  { number: 8, kind: "artwork-video" },
  { number: 9, kind: "fruit-ninja" },
  { number: 10, kind: "artwork" },
  {
    number: 11,
    kind: "statement",
    text: "Applying the DNA and creating your IPO",
  },
  { number: 12, kind: "heading", text: "hyperpersonalization" },
  { number: 13, kind: "artwork-video" },
  { number: 14, kind: "artwork-video" },
];

export function getSlide(number: number): Slide | undefined {
  return slides.find((s) => s.number === number);
}

export function parseSlideParam(param: string): number | null {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1 || n > SLIDE_COUNT) return null;
  return n;
}
