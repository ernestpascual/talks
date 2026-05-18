export const TALK_SLUG = "raw-school-2026";
export const SLIDE_COUNT = 16;
export const TALK_BASE_PATH = `/talks/${TALK_SLUG}`;

export type Slide =
  | { number: 1; kind: "title"; text: string }
  | { number: 2; kind: "heading"; text: string }
  | { number: 3; kind: "venn"; title: string }
  | { number: 4; kind: "ipo"; title: string }
  | { number: 5; kind: "ipo-ai"; title: string }
  | { number: 6; kind: "statement-eye"; text: string }
  | { number: 7; kind: "poll"; title: string; subtitle: string }
  | { number: 8; kind: "compare"; left: string; right: string }
  | { number: 9; kind: "questions"; items: string[] }
  | { number: 10; kind: "metaphor"; lines: string[] }
  | { number: 11; kind: "statement"; text: string }
  | { number: 12; kind: "camera-demo"; title: string; flow: string[] }
  | { number: 13; kind: "heading"; text: string }
  | { number: 14; kind: "heading"; text: string }
  | { number: 15; kind: "list"; items: string[] }
  | { number: 16; kind: "heading"; text: string };

export const slides: Slide[] = [
  {
    number: 1,
    kind: "title",
    text: "AI as the New Creative Substrate: Ideas Made Of AI, Not Just Made By AI",
  },
  { number: 2, kind: "heading", text: "Who am i" },
  { number: 3, kind: "venn", title: "Creative Technologist" },
  {
    number: 4,
    kind: "ipo",
    title: "Systems thinking: Input, process, output",
  },
  { number: 5, kind: "ipo-ai", title: "role of AI in each" },
  {
    number: 6,
    kind: "statement-eye",
    text: "the input becomes output if i process",
  },
  {
    number: 7,
    kind: "poll",
    title: "how do you use AI",
    subtitle:
      "poll the canvas → results processed by LLM → weight IPO",
  },
  {
    number: 8,
    kind: "compare",
    left: "Thinking deterministic",
    right: "probabilistic",
  },
  {
    number: 9,
    kind: "questions",
    items: ["What exists?", "What is true?", "What matters?"],
  },
  {
    number: 10,
    kind: "metaphor",
    lines: [
      "pottery — AI as the wheel",
      "what if AI as the clay?",
    ],
  },
  {
    number: 11,
    kind: "statement",
    text: "the input becomes output if i process but with AI",
  },
  {
    number: 12,
    kind: "camera-demo",
    title: "input (detect camera) → process → output",
    flow: [
      "lower prices when they smile",
      "go up when they don't do anything",
    ],
  },
  { number: 13, kind: "heading", text: "hyperpersonalization" },
  { number: 14, kind: "heading", text: "Polymathism" },
  {
    number: 15,
    kind: "list",
    items: ["Collect", "Curate", "Break"],
  },
  { number: 16, kind: "heading", text: "Thank you" },
];

export function getSlide(number: number): Slide | undefined {
  return slides.find((s) => s.number === number);
}

export function parseSlideParam(param: string): number | null {
  const n = Number(param);
  if (!Number.isInteger(n) || n < 1 || n > SLIDE_COUNT) return null;
  return n;
}
