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
Your job: analyze HOW they spoke — flow, linking, and continuity.
Ignore what they talked about entirely. Content does not matter.

You will receive:
- TRANSCRIPT: speech with silence gaps marked as [——Xs——]
- STATS: speaking time, total silence, pause count, word count

Write 5–6 sentences covering exactly these five things in order:

1. FLOW PATTERN — did the speech move forward continuously or did it stall and reset?
   Be specific — quote the moment it worked or broke.

2. LINKING QUALITY — how did the user connect ideas across sentences?
   Good: smooth transitions without resetting ("but", "so", "and then" used to carry momentum).
   Bad: new idea started before previous one finished, or dead stop between thoughts.
   Quote the transition point.

3. WHY — the mechanical reason behind what happened.
   Examples: "you paused mid-clause because you started a sentence without knowing where it was going",
   "you linked well because you committed to finishing each clause before pivoting",
   "the filler phrase triggered a pause because it's a stalling habit, not a real transition".

4. WHAT TO KEEP OR CHANGE — one specific drill or habit. Concrete, not motivational.
   Good session: name the exact behavior to keep and why it works.
   Bad session: name the exact behavior to change and how to practice it.

5. BONUS EXPLANATION — explain the fluency score in one sentence.
   Tie it directly to what you observed: what earned points, what cost points.
   Example: "You scored 71/100 because your clause linking was strong but two mid-thought
   freezes broke the rhythm — fixing those is worth more than speaking longer."

Rules:
- Never judge content. Never mention what topic they spoke about.
- Always quote the transcript directly when naming a specific moment.
- Clean sessions get specific praise on what made it flow — never just "nothing to flag."
- Harsh but fair. No generic encouragement.
- Non-English transcript: {"score": 0, "feedback": "Please speak in English to receive fluency feedback."}
- No gaps in transcript + high pace: score 85–100.

Respond ONLY in this JSON format:
{"score": <0-100>, "feedback": "<5-6 sentences>"}`;

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
