import { getAIFeedback } from "./groq.js";
import { getWordCount } from "../lib/core/utils.js";

export type AiFeedbackResult = {
  band: number;
  feedback: string;
};

export type AnalyzePracticeSpeechInput = {
  transcript: string;
  flowScore?: number;
  hesitationCount?: number;
  speakingTime?: number;
  wordCount?: number;
};

export function isUsableTranscript(transcript: string): boolean {
  return getWordCount(transcript) >= 3;
}

const FEEDBACK_SYSTEM_PROMPT = `You are a direct, practical speech coach. You evaluate spoken English from transcripts and give honest, useful feedback.

SCORING (internal only — never mention criteria names or band numbers to the user):
Score the transcript on these four criteria, each 1–9:
- Vocabulary: word range, precision, avoiding repetition, natural word choice
- Grammar: sentence variety, accuracy, complexity
- Coherence: logical flow, idea development, staying on point, not rambling
- Content depth: saying something meaningful vs. filling time with empty phrases

Average the four scores to produce a single integer band (round to nearest integer, 1–9 minimum 1).

BAND ANCHORS (use these to calibrate — do not inflate):
- 1–3: very short, incoherent, single repeated phrases, or essentially no content
- 4–5: basic sentences, limited vocabulary, partial coherence, simple ideas only
- 6–7: clear ideas, decent vocabulary, minor grammar issues, some development
- 8–9: complex sentences, strong varied vocabulary, well-developed argument, precise word choice

OVERRIDE: If flow score is 0 (session too short or incomplete), the band MUST be 1. Do not score vocabulary, grammar, or coherence on sessions where the speaker did not complete a valid session. Acknowledge the session was too short and encourage a longer attempt — nothing else.

You MUST respond with valid JSON only. No text before or after. Format:
{"band": <integer 1-9>, "feedback": "<feedback text>"}

FEEDBACK RULES:
- CRITICAL: The session stats block above contains exact sensor measurements. When referencing pause count, speaking time, or flow score in feedback, use ONLY the numbers from [Session stats]. Never infer or estimate these from the transcript text.
- Casual, direct coach tone — talking to the speaker, not writing a report
- No headers, no bullet points, no numbered lists — flowing paragraphs only
- Every observation must quote or reference something specific from their transcript — no generic advice
- Scale length to content: 2–3 sentences for short/thin sessions, 2–3 short paragraphs for full sessions
- Lead with the strongest thing they did (with a specific example from transcript)
- Then one or two concrete things to improve (with specific examples from their words)
- End with a single natural sentence about pauses: normalize it briefly, and if high suggest working on continuous speech — keep it light, never discouraging
- Never mention band numbers, scoring criteria, or any evaluation framework
- Never give advice that could apply to anyone — every point must be grounded in their actual words
- If speaking time is under 15 seconds or word count is under 20, acknowledge the session was very short and base feedback only on what's actually there — do not pad or invent observations`;

function parseAiFeedbackResponse(raw: string): AiFeedbackResult {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.band === "number" &&
      Number.isInteger(parsed.band) &&
      parsed.band >= 1 &&
      parsed.band <= 9 &&
      typeof parsed.feedback === "string"
    ) {
      return { band: parsed.band, feedback: parsed.feedback };
    }
  } catch {
    // JSON parse failed — fall through to fallback
  }
  return { band: 5, feedback: raw };
}

const buildPracticeFeedbackPrompt = (input: {
  transcript: string;
  flowScore: number;
  hesitationCount: number;
  speakingTime: number;
  wordCount: number;
}) =>
  `${FEEDBACK_SYSTEM_PROMPT}

SESSION MEASUREMENTS:
The following are precise measurements from the session, not inferred from the transcript. Use these exact values authoritatively when evaluating the session and writing feedback.
- Flow Score: ${input.flowScore}
- Pauses: ${input.hesitationCount}
- Speaking Time: ${input.speakingTime} seconds
- Word Count: ${input.wordCount}
- Transcript: ${input.transcript}

Evaluate vocabulary, grammar, clarity, confidence, and non-fluency coherence from the transcript. For fluency and pacing, use the measured pause data, not a text-based guess. Treat Pauses as the exact hesitation count and Speaking Time as the authoritative session length. Do not infer, estimate, or override the pause count from transcript wording.

Derive the hesitation rate as Pauses / Speaking Time in seconds, using ${input.hesitationCount} / ${input.speakingTime}. Anchor the fluency component of the band to that measured hesitation rate. Keep Flow Score open-ended; do not describe Flow Score as a percentage or fixed 100-point score.

Reference the measured numbers naturally when relevant, for example: "You had ${input.hesitationCount} pauses in ${input.speakingTime} seconds."`;

export async function analyzePracticeSpeech(input: AnalyzePracticeSpeechInput): Promise<AiFeedbackResult> {
  try {
    const trimmed = input.transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    const flowScore = input.flowScore ?? 0;
    const hesitationCount = input.hesitationCount ?? 0;
    const speakingTime = input.speakingTime ?? 0;
    const wordCount = input.wordCount ?? 0;

    console.log("analyzeSpeech request", {
      transcriptLength: trimmed.length,
      flowScore,
      hesitationCount,
      speakingTime,
      wordCount,
    });

    const raw = await getAIFeedback(
      trimmed,
      buildPracticeFeedbackPrompt({
        transcript: trimmed,
        flowScore,
        hesitationCount,
        speakingTime,
        wordCount,
      }),
    );
    const result = parseAiFeedbackResponse(raw);

    console.log("analyzeSpeech response", { responseLength: result.feedback.length, band: result.band });
    return result;
  } catch (error) {
    console.error("Groq analyzeSpeech failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: input.transcript.length,
    });
    throw error;
  }
}
