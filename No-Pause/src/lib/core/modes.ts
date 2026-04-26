export type PracticeMode = "free" | "lemon" | "topic";

export const VALID_MODES: PracticeMode[] = ["free", "lemon", "topic"];

export const MODE_LABELS: Record<PracticeMode, string> = {
  free: "Free Speaking",
  lemon: "Lemon",
  topic: "Topic",
};

export function normalizeMode(mode: string): PracticeMode {
  const normalizedMode = mode.toLowerCase();
  if (normalizedMode === "lemon") {
    return "lemon";
  }
  if (normalizedMode === "topic") {
    return "topic";
  }
  return "free";
}
