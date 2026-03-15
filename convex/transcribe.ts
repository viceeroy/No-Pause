"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const transcribeAudio = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
    language: v.optional(v.string()),
    durationSec: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("GROQ_API_KEY is not set");
      }

      const safeMimeType = args.mimeType.split(";")[0] || "audio/webm";
      const audioBytes = Buffer.from(args.audioBase64, "base64");
      const MAX_BYTES = 15 * 1024 * 1024;
      const MIN_BYTES = 5 * 1024;
      if (audioBytes.length === 0) {
        throw new Error("Audio payload is empty");
      }
      if (args.durationSec !== undefined && args.durationSec < 1) {
        return "";
      }
      if (audioBytes.length < MIN_BYTES) {
        return "";
      }
      if (audioBytes.length > MAX_BYTES) {
        throw new Error(`Audio payload too large: ${audioBytes.length} bytes`);
      }

      const audioBlob = new Blob([audioBytes], { type: safeMimeType });

      const extensionByMime: Record<string, string> = {
        "audio/webm": "webm",
        "audio/wav": "wav",
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/mp4": "mp4",
        "audio/m4a": "m4a",
        "audio/ogg": "ogg",
      };
      const fileExt = extensionByMime[safeMimeType] || "webm";

      const formData = new FormData();
      formData.append("file", audioBlob, `recording.${fileExt}`);
      formData.append("model", "whisper-large-v3-turbo");
      if (args.language) {
        formData.append("language", args.language);
      }

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq transcription failed: ${response.status} ${errorText.slice(0, 200)}`);
      }

      const data = await response.json();
      const transcript = String(data?.text ?? "").trim();
      if (!transcript) return "";
      const normalized = transcript.toLowerCase().trim();
      // If transcript is 3 words or fewer, it's almost certainly a hallucination — discard it
      const wordCount = normalized.split(/\s+/).filter(Boolean).length;
      if (wordCount <= 3) return "";
      return transcript;
    } catch (error) {
      console.error("Groq transcription action failed", {
        message: error instanceof Error ? error.message : String(error),
        mimeType: args.mimeType,
        language: args.language ?? null,
        durationSec: args.durationSec ?? null,
        base64Length: args.audioBase64.length,
      });
      throw error;
    }
  },
});
