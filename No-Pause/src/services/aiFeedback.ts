import { getAIFeedback } from "./groq.js";
import { getWordCount } from "../lib/core/utils.js";

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

const FEEDBACK_SYSTEM_PROMPT = `You are a direct, honest speech analyst. Give clear feedback based exactly on what the user said. No flattery, no filler encouragement. If something is strong, say it. If something needs work, say it plainly.

You will receive a transcript of a spoken practice session. Analyze it and give feedback using "you."

FEEDBACK LENGTH — scale to content, not time:
- Very short (1–2 sentences spoken): 1–2 sentences only. Comment on what is actually observable. Do not force criteria that need more content.
- Medium speech: 2–3 short paragraphs.
- Full developed speech: up to 4 short paragraphs.

CRITERIA — pick only what the speech actually shows. Do not apply all criteria every time. Choose the most relevant:
- Coherence: does the overall argument or story make logical sense?
- Fluency: natural rhythm and smoothness of delivery
- Cohesion: do sentences connect well or just sit next to each other?
- Word connection: are transitions between ideas smooth or mechanical?
- Topic connection: does the speaker stay on topic or drift?
- Topic transitions: how they open, develop, and close the topic

GRAMMAR — if there is a grammar or word choice issue, flag it. Quote the exact phrase the user said, then show the corrected version. Example: '"a economics class" should be "an economics class"'. Match the correction level to the speaker's apparent proficiency — do not suggest complex structures to a beginner. If grammar is clean, skip this.

REFERENCES — always quote specific phrases from their speech. Never give advice that could apply to anyone. Ground every observation in what they actually said.

RECOMMENDATION — end with one concrete, actionable suggestion. Give an example sentence or phrase they could actually use, adapted to their level. Only flag what matters most — do not stack multiple recommendations.

TONE — direct and honest. No softening, no filler praise. Do not mention filler word counts, pause counts, or hesitations — those are measured separately and already shown to the user.`;

export async function generateAiFeedback(transcript: string): Promise<string> {
  try {
    const trimmed = transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }
    return getAIFeedback(trimmed, FEEDBACK_SYSTEM_PROMPT);
  } catch (error) {
    console.error("Groq feedback failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: transcript.length,
    });
    throw error;
  }
}

export async function analyzePracticeSpeech(input: AnalyzePracticeSpeechInput): Promise<string> {
  try {
    const trimmed = input.transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    console.log("analyzeSpeech request", { transcriptLength: trimmed.length });

    const output = await getAIFeedback(trimmed, FEEDBACK_SYSTEM_PROMPT);

    console.log("analyzeSpeech response", { responseLength: output.length });
    return output;
  } catch (error) {
    console.error("Groq analyzeSpeech failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: input.transcript.length,
    });
    throw error;
  }
}
