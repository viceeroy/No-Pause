import { getAIFeedback } from "./groq.js";
import { getWordCount } from "../lib/core/utils.js";

export type AiScoreResult = {
  score: number;
  feedback: string;
};

const AI_SCORING_PROMPT = `You are a friendly English speaking coach.
Score the speech out of 100 based on coherence, cohesion, grammar, word choice, and topic relevance.
Be warm and encouraging — lead with a positive, then one gentle suggestion.
Return only JSON: { "score": number, "feedback": "string" }.
Feedback should be 1-2 natural sentences, no criteria names.`;

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

async function generateTextFromTranscript(transcript: string, systemPrompt?: string): Promise<string> {
  try {
    const trimmed = transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    return getAIFeedback(trimmed, systemPrompt);
  } catch (error) {
    console.error("Groq feedback failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: transcript.length,
    });
    throw error;
  }
}

export async function generateAiFeedback(transcript: string): Promise<string> {
  return generateTextFromTranscript(transcript);
}

const buildPracticeFeedbackPrompt = (input: {
  transcript: string;
  flowScore: number;
  hesitationCount: number;
  speakingTime: number;
  wordCount: number;
}) =>
  `Analyze this speaking practice session. Evaluate fluency, pacing, clarity, confidence, and specific areas for improvement. Flow Score is open-ended and grows with sustained speaking time, so do not describe it as a percentage or fixed 100-point score.
- Flow Score: ${input.flowScore}
- Pauses: ${input.hesitationCount}
- Speaking Time: ${input.speakingTime} seconds
- Word Count: ${input.wordCount}
- Transcript: ${input.transcript}`;

export async function scoreSpeechQuality(transcript: string): Promise<AiScoreResult> {
  const trimmed = transcript.trim();
  if (!trimmed) {
    throw new Error("Transcript is empty");
  }

  const raw = await getAIFeedback(trimmed, AI_SCORING_PROMPT);

  try {
    const cleaned = raw.replace(/```json\s*|```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as { score?: unknown; feedback?: unknown };
    const score = Number(parsed.score);
    const feedback = String(parsed.feedback ?? "");

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`Invalid score: ${parsed.score}`);
    }

    return { score: Math.round(score), feedback };
  } catch (parseError) {
    console.error("Failed to parse AI score response", { raw, parseError });
    return { score: 50, feedback: raw.slice(0, 200) };
  }
}

export async function analyzePracticeSpeech(input: AnalyzePracticeSpeechInput): Promise<string> {
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

    const output = await generateTextFromTranscript(
      trimmed,
      buildPracticeFeedbackPrompt({
        transcript: trimmed,
        flowScore,
        hesitationCount,
        speakingTime,
        wordCount,
      }),
    );
    console.log("analyzeSpeech response", {
      responseLength: output.length,
    });
    return output;
  } catch (error) {
    console.error("Groq analyzeSpeech failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: input.transcript.length,
    });
    throw error;
  }
}
