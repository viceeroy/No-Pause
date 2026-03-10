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

Give concise, personalized feedback referencing these specific numbers. Comment on their flow score, hesitation count, and suggest one concrete improvement. Keep it friendly, constructive, and under 200 words.`;

export const analyzeSpeech = action({
  args: {
    transcript: v.string(),
    flowScore: v.number(),
    hesitationCount: v.number(),
    speakingTime: v.number(),
    wordCount: v.number(),
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

      console.log("analyzeSpeech request", {
        transcriptLength: trimmed.length,
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
              content: buildPrompt({
                transcript: trimmed,
                flowScore: args.flowScore,
                hesitationCount: args.hesitationCount,
                speakingTime: args.speakingTime,
                wordCount: args.wordCount,
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
