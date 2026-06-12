export const TALK_SLUG = "aerocano";
export const SLIDE_COUNT = 8;
export const TALK_BASE_PATH = `/talks/${TALK_SLUG}`;

export type Slide =
  | { number: 1; kind: "title"; text: string }
  | { number: 2; kind: "text"; text: string }
  | { number: 3; kind: "text"; text: string }
  | { number: 4; kind: "interactive-pour" }
  | { number: 5; kind: "interactive-make" }
  | { number: 6; kind: "qr-code"; text: string }
  | { number: 7; kind: "shake-it"; text: string }
  | { number: 8; kind: "ending" };

export const slides: Slide[] = [
  { number: 1, kind: "title", text: "BAKIT MASARAP ANG AEROCANO?" },
  { number: 2, kind: "text", text: "i love black coffee" },
  { number: 3, kind: "text", text: "Why am i talking about this?" },
  { number: 4, kind: "interactive-pour" },
  { number: 5, kind: "interactive-make" },
  { number: 6, kind: "qr-code", text: "Ano gusto mo sa kape?" },
  { number: 7, kind: "shake-it", text: "shake it" },
  { number: 8, kind: "ending" },
];

export function getSlide(number: number): Slide | undefined {
  return slides.find((s) => s.number === number);
}

export function parseSlideParam(param: string): number | null {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1 || n > SLIDE_COUNT) return null;
  return n;
}
