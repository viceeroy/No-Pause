"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

const SYSTEM_PROMPT =
  "You are a speech analysis expert. Analyze the given speech transcript and provide concise feedback on clarity, structure, vocabulary, and overall impression. Keep it friendly, constructive, and under 200 words.";

export const analyzeSpeech = action({
  args: {
    transcript: v.string(),
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

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: trimmed },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter analysis failed: ${response.status} ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      return String(content).trim();
    } catch (error) {
      console.error("OpenRouter analyzeSpeech failed", {
        message: error instanceof Error ? error.message : String(error),
        transcriptLength: args.transcript.length,
      });
      throw error;
    }
  },
});
