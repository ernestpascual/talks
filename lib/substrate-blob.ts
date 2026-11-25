export const SUBSTRATE_COLLECTION = "bbdoSubstrateResponses";
export const SUBSTRATE_EXPERIENCE_PATH = "/experience/substrate-blob";
export const SUBSTRATE_REDIRECT_PATH = "/r/substrate";
export const SUBSTRATE_TUNING_PATH = "talks/bbdo-ai-playday/slide-3/tuning";

export const SUBSTRATE_QUESTIONS = [
  "How do you feel about creating things using AI?",
  "How do you feel about creating your own personalized AI that works for you?",
  "How do you feel about co-creating with AI?",
] as const;

export type SubstrateSubmission = {
  id: string;
  name: string;
  redScore: number;
  blueScore: number;
  yellowScore: number;
  submittedAt: number;
};

export function clampLikert(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

export function normalizeSubstrateSubmission(
  id: string,
  data: Record<string, unknown>,
): SubstrateSubmission {
  return {
    id,
    name:
      typeof data.name === "string" && data.name.trim()
        ? data.name.trim().slice(0, 48)
        : "Anonymous",
    redScore: clampLikert(data.redScore),
    blueScore: clampLikert(data.blueScore),
    yellowScore: clampLikert(data.yellowScore),
    submittedAt:
      typeof data.submittedAt === "number" ? data.submittedAt : 0,
  };
}
