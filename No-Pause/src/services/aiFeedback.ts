import { getAIFeedback } from "./groq.js";
import { getWordCount, type TranscribedWord } from "../lib/core/utils.js";
import type { SilenceGap } from "../lib/core/silence.js";

export type AiFeedbackResult = {
  score: number;
  feedback: string;
};

export type AnalyzePracticeSpeechInput = {
  transcript: string;
  words: TranscribedWord[];
  gaps: SilenceGap[];
  speakingTimeSec: number;
  totalSilenceSec: number;
  pauseCount: number;
  wordCount: number;
};

export function isUsableTranscript(transcript: string): boolean {
  return getWordCount(transcript) >= 3;
}

const PARSE_FAILURE_FEEDBACK = "Feedback unavailable — please try again.";

const FEEDBACK_SYSTEM_PROMPT = `You are a fluency coach. The user is practicing speaking without stopping.
Your only job: identify WHERE and WHY they hesitated.
Ignore content entirely — what they talked about does not matter.

You will receive:
- TRANSCRIPT: speech with silence gaps marked as [——Xs——]
- STATS: speaking time, total silence, pause count

Identify the dominant pattern:
- Mid-thought freeze: pause mid-sentence (word retrieval problem)
- Transition hesitation: pause at clause/sentence boundary (linking problem)
- Filler trigger: phrase like "I think", "so", "um" appears just before pause
- Trailing off: pauses grow longer toward end (stamina/confidence problem)
- Front-loaded: most pauses in first 30s, cleaner after (warm-up pattern)

Score 0–100 based on fluency pattern quality:
- 0–20: severe frequent freezes, no recovery, trails off
- 21–40: multiple mid-thought freezes, growing pause length
- 41–60: some hesitation but pushes through, pattern identifiable
- 61–80: minor pauses, mostly at boundaries, recovers quickly
- 81–100: no significant pauses or single brief pause with immediate recovery

Rules:
- Name the specific pattern. Quote exactly where it happened.
- Give one concrete thing to practice. No motivational filler.
- 2–3 sentences maximum.
- No content judgment. No topic evaluation.
- If no gap markers in transcript: score 85–100, say "Clean session, no hesitation patterns to flag."
- If transcript is not predominantly English: {"score": 0, "feedback": "Please speak in English to receive fluency feedback."}

Respond ONLY in this JSON format:
{"score": <0-100>, "feedback": "<2-3 sentences>"}`;

const EPSILON = 0.05;

export function buildMarkedTranscript(
  transcript: string,
  words: TranscribedWord[],
  gaps: SilenceGap[],
): string {
  if (!words || words.length === 0) {
    return transcript;
  }

  const ordered = [...words]
    .filter((w) => Number.isFinite(w.start) && typeof w.word === "string")
    .sort((a, b) => a.start - b.start);
  if (ordered.length === 0) {
    return transcript;
  }

  const formatGap = (durationSec: number) =>
    `[——${Math.round(durationSec * 10) / 10}s——]`;

  const remainingGaps = [...gaps].sort((a, b) => a.startSec - b.startSec);
  const consumed = new Array(remainingGaps.length).fill(false);
  const parts: string[] = [];

  // Leading gap: anything that resolves before/at the first word.
  remainingGaps.forEach((gap, gapIndex) => {
    if (consumed[gapIndex]) return;
    if (gap.startSec + gap.durationSec <= ordered[0].start + EPSILON) {
      parts.push(formatGap(gap.durationSec));
      consumed[gapIndex] = true;
    }
  });

  ordered.forEach((word, index) => {
    parts.push(word.word);
    const next = ordered[index + 1];
    remainingGaps.forEach((gap, gapIndex) => {
      if (consumed[gapIndex]) return;
      const resumeAt = gap.startSec + gap.durationSec;
      const afterThisWord = resumeAt >= word.start + EPSILON;
      const beforeNextWord = !next || resumeAt <= next.start + EPSILON;
      if (afterThisWord && beforeNextWord) {
        parts.push(formatGap(gap.durationSec));
        consumed[gapIndex] = true;
      }
    });
  });

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function parseAiFeedbackResponse(raw: string): AiFeedbackResult {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.score === "number" &&
      Number.isInteger(parsed.score) &&
      parsed.score >= 0 &&
      parsed.score <= 100 &&
      typeof parsed.feedback === "string"
    ) {
      return { score: parsed.score, feedback: parsed.feedback };
    }
  } catch {
    // JSON parse failed — fall through to fallback
  }
  // Parse failure means no score earned — never inject a phantom bonus.
  return { score: 0, feedback: PARSE_FAILURE_FEEDBACK };
}

const buildPracticeFeedbackUserMessage = (input: {
  markedTranscript: string;
  speakingTimeSec: number;
  totalSilenceSec: number;
  pauseCount: number;
}) =>
  `TRANSCRIPT: ${input.markedTranscript}
STATS: speaking time ${input.speakingTimeSec}s, total silence ${input.totalSilenceSec}s, pause count ${input.pauseCount}`;

export async function analyzePracticeSpeech(input: AnalyzePracticeSpeechInput): Promise<AiFeedbackResult> {
  try {
    const trimmed = input.transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    const speakingTimeSec = input.speakingTimeSec ?? 0;
    const totalSilenceSec = input.totalSilenceSec ?? 0;
    const pauseCount = input.pauseCount ?? 0;
    const markedTranscript = buildMarkedTranscript(trimmed, input.words ?? [], input.gaps ?? []);

    console.log("analyzeSpeech request", {
      transcriptLength: trimmed.length,
      pauseCount,
      speakingTimeSec,
      totalSilenceSec,
      gapCount: (input.gaps ?? []).length,
    });

    const raw = await getAIFeedback(
      buildPracticeFeedbackUserMessage({
        markedTranscript,
        speakingTimeSec,
        totalSilenceSec,
        pauseCount,
      }),
      FEEDBACK_SYSTEM_PROMPT,
      0,
    );
    const result = parseAiFeedbackResponse(raw);

    console.log("analyzeSpeech response", { responseLength: result.feedback.length, score: result.score });
    return result;
  } catch (error) {
    console.error("Groq analyzeSpeech failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: input.transcript.length,
    });
    throw error;
  }
}
