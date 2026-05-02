export type PracticeMode = "speaking";

export const VALID_MODES: PracticeMode[] = ["speaking"];

export const MODE_LABELS: Record<PracticeMode, string> = {
  speaking: "Speaking Mode",
};

export function normalizeMode(mode: string): PracticeMode {
  void mode;
  return "speaking";
}
