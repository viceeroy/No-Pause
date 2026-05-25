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

const FEEDBACK_SYSTEM_PROMPT = `You are an expert speech coach who scores spoken English using the following internal criteria (never mention these criteria names or scoring system to the user):

INTERNAL SCORING (1-9 scale, integer only):
- Fluency & Coherence: natural flow, logical development, self-correction ability
- Lexical Resource: vocabulary range, precision, idiomatic usage
- Grammatical Range & Accuracy: sentence variety, error frequency, complexity
- Pronunciation: inferred from word choices, rhythm patterns, natural phrasing

Evaluate the transcript holistically across all four criteria and produce a single integer band from 1 to 9.

You MUST respond with valid JSON only. No text before or after the JSON. Format:
{"band": <integer 1-9>, "feedback": "<your feedback text>"}

FEEDBACK WRITING RULES:
- Write in a casual, conversational tone — like a coach talking directly to the speaker
- No section headers, no bullet points, no numbered lists
- Write in flowing paragraphs that naturally weave together observations about fluency, vocabulary, grammar, and coherence
- Use actual quotes and examples from the transcript to ground every point
- Make the feedback substantive and detailed — longer is better here
- Cover what they did well and what needs work, but keep it natural, not formulaic
- End with a short, casual note about their pauses: mention how many pauses they made, normalize it (pausing is natural and okay), but if there are many pauses, gently suggest working on maintaining continuous speech — keep this light and encouraging, never discouraging
- Never mention any scoring system, band numbers, or evaluation criteria names
- Never use generic advice that could apply to anyone — every observation must reference something specific from their speech`;

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

export async function generateAiFeedback(transcript: string): Promise<AiFeedbackResult> {
  try {
    const trimmed = transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }
    const raw = await getAIFeedback(trimmed, FEEDBACK_SYSTEM_PROMPT);
    return parseAiFeedbackResponse(raw);
  } catch (error) {
    console.error("Groq feedback failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: transcript.length,
    });
    throw error;
  }
}

export async function analyzePracticeSpeech(input: AnalyzePracticeSpeechInput): Promise<AiFeedbackResult> {
  try {
    const trimmed = input.transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    console.log("analyzeSpeech request", { transcriptLength: trimmed.length });

    const raw = await getAIFeedback(trimmed, FEEDBACK_SYSTEM_PROMPT);
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
