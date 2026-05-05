import { getAIFeedback } from "./groq.js";

export type AnalyzePracticeSpeechInput = {
  transcript: string;
  flowScore?: number;
  hesitationCount?: number;
  speakingTime?: number;
  wordCount?: number;
};

function getWordCount(transcript: string): number {
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}

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

export async function generateFillerCount(transcript: string): Promise<string> {
  return generateTextFromTranscript(
    transcript,
    'You count only spoken filler hesitations in transcript text. Count words/sounds like "um", "uh", "er", and "ah". Do not infer silent pauses. Return ONLY valid JSON: { "hesitation_count": <number> }',
  );
}

const buildPracticeFeedbackPrompt = (input: {
  transcript: string;
  flowScore: number;
  hesitationCount: number;
  speakingTime: number;
  wordCount: number;
}) =>
  `Analyze this speaking practice session. Evaluate fluency, filler words, pacing, clarity, confidence, and specific areas for improvement. Flow Score is open-ended and grows with sustained speaking time, so do not describe it as a percentage or fixed 100-point score.
- Flow Score: ${input.flowScore}
- Pauses: ${input.hesitationCount}
- Speaking Time: ${input.speakingTime} seconds
- Word Count: ${input.wordCount}
- Transcript: ${input.transcript}`;

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
