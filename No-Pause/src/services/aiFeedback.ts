import { generateGeminiText } from "./gemini.js";

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

    const prompt = `${systemPrompt ?? "You are a speech fluency coach. Give specific, actionable feedback on this speech transcript in 3-4 sentences. Focus on clarity, confidence, and areas to improve."}\n\nTranscript:\n${trimmed}`;
    return generateGeminiText(prompt);
  } catch (error) {
    console.error("Gemini feedback failed", {
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
  `You are a speech analysis expert. The user just completed a speaking session. Flow Score is open-ended and grows with sustained speaking time, so do not describe it as a percentage or fixed 100-point score.
- Flow Score: ${input.flowScore}
- Pauses: ${input.hesitationCount}
- Speaking Time: ${input.speakingTime} seconds
- Word Count: ${input.wordCount}
- Transcript: ${input.transcript}

Return feedback in markdown with:
- A short punchy header (e.g. ## 🎯 Your Session Breakdown)
- Bold the key stats when mentioned (flow score, pause count)
- 2-3 short sections with emoji headers like ### 💪 What You Did Well and ### 🎯 Focus On This
- End with a single motivational sentence under ### 🚀 Next Time
Keep it under 200 words, punchy and energetic in tone — not corporate or boring.`;

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
    console.error("Gemini analyzeSpeech failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: input.transcript.length,
    });
    throw error;
  }
}
