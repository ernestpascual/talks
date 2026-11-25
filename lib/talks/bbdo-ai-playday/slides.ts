export const TALK_SLUG = "bbdo-ai-playday";
export const TALK_BASE_PATH = `/talks/${TALK_SLUG}`;

export type Slide =
  | { number: 1; kind: "hero-image" }
  | { number: 2; kind: "artwork" }
  | { number: 3; kind: "liquid-orbs" }
  | { number: 4; kind: "creative-substrate" }
  | { number: 5; kind: "artwork" }
  | { number: 6; kind: "artwork" }
  | { number: 7; kind: "creative-substrate" }
  | { number: 8; kind: "creative-substrate" }
  | { number: 9; kind: "creative-substrate" }
  | { number: 10; kind: "creative-substrate" }
  | { number: 11; kind: "creative-substrate" }
  | { number: 12; kind: "artwork-video" }
  | { number: 13; kind: "artwork-video" }
  | { number: 14; kind: "processing" }
  | { number: 15; kind: "processing" }
  | { number: 16; kind: "processing" }
  | { number: 17; kind: "processing" }
  | { number: 18; kind: "video-grid" }
  | { number: 19; kind: "dmap-battle" }
  | { number: 20; kind: "ice-breakers" }
  | { number: 21; kind: "processing" }
  | { number: 22; kind: "artwork-video" };

export const slides: Slide[] = [
  { number: 1, kind: "hero-image" },
  { number: 2, kind: "artwork" },
  { number: 3, kind: "liquid-orbs" },
  { number: 4, kind: "creative-substrate" },
  { number: 5, kind: "artwork" },
  { number: 6, kind: "artwork" },
  { number: 7, kind: "creative-substrate" },
  { number: 8, kind: "creative-substrate" },
  { number: 9, kind: "creative-substrate" },
  { number: 10, kind: "creative-substrate" },
  { number: 11, kind: "creative-substrate" },
  { number: 12, kind: "artwork-video" },
  { number: 13, kind: "artwork-video" },
  { number: 14, kind: "processing" },
  { number: 15, kind: "processing" },
  { number: 16, kind: "processing" },
  { number: 17, kind: "processing" },
  { number: 18, kind: "video-grid" },
  { number: 19, kind: "dmap-battle" },
  { number: 20, kind: "ice-breakers" },
  { number: 21, kind: "processing" },
  { number: 22, kind: "artwork-video" },
];

export function getSlide(number: number): Slide | undefined {
  return slides.find((s) => s.number === number);
}

export function parseSlideParam(param: string): number | null {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}
