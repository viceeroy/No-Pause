"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const buildPrompt = (input: {
  transcript: string;
  flowScore: number;
  hesitationCount: number;
  speakingTime: number;
  wordCount: number;
}) =>
  `You are a speech analysis expert. The user just completed a speaking session with these stats:
- Flow Score: ${input.flowScore}/100
- Hesitations: ${input.hesitationCount}
- Speaking Time: ${input.speakingTime} seconds
- Word Count: ${input.wordCount}
- Transcript: ${input.transcript}

Return feedback in markdown with:
- A short punchy header (e.g. ## 🎯 Your Session Breakdown)
- Bold the key stats when mentioned (flow score, hesitation count)
- 2-3 short sections with emoji headers like ### 💪 What You Did Well and ### 🎯 Focus On This
- End with a single motivational sentence under ### 🚀 Next Time
Keep it under 200 words, punchy and energetic in tone — not corporate or boring.`;

const buildVoiceActingPrompt = (transcript: string) =>
  `You are a drama coach and voice acting director. The user just read a dramatic passage aloud. Analyze their transcript for emotional expression, clarity, pacing, and dramatic delivery. Give energetic, encouraging feedback like a real acting coach. Reference specific words or phrases from their reading. Keep it under 200 words and use markdown formatting with emoji headers.

Transcript: ${transcript}`;

export const analyzeSpeech = action({
  args: {
    transcript: v.string(),
    flowScore: v.optional(v.number()),
    hesitationCount: v.optional(v.number()),
    speakingTime: v.optional(v.number()),
    wordCount: v.optional(v.number()),
    mode: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is not set");
      }

      const trimmed = args.transcript.trim();
      if (!trimmed) {
        throw new Error("Transcript is empty");
      }

      const flowScore = args.flowScore ?? 0;
      const hesitationCount = args.hesitationCount ?? 0;
      const speakingTime = args.speakingTime ?? 0;
      const wordCount = args.wordCount ?? 0;
      const mode = args.mode ?? 'default';

      console.log("analyzeSpeech request", {
        transcriptLength: trimmed.length,
        flowScore,
        hesitationCount,
        speakingTime,
        wordCount,
        mode,
      });

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemma-2-9b-it",
          messages: [
            {
              role: "system",
              content: mode === 'voiceacting'
                ? buildVoiceActingPrompt(trimmed)
                : buildPrompt({
                  transcript: trimmed,
                  flowScore,
                  hesitationCount,
                  speakingTime,
                  wordCount,
                }),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter analysis failed: ${response.status} ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      const output = String(content).trim();
      console.log("analyzeSpeech response", {
        responseLength: output.length,
      });
      return output;
    } catch (error) {
      console.error("OpenRouter analyzeSpeech failed", {
        message: error instanceof Error ? error.message : String(error),
        transcriptLength: args.transcript.length,
      });
      throw error;
    }
  },
});
