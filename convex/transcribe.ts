"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const transcribeAudio = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (_ctx, args) => {
    try {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("GROQ_API_KEY is not set");
      }

      const safeMimeType = args.mimeType.split(";")[0] || "audio/webm";
      const audioBytes = Buffer.from(args.audioBase64, "base64");
      if (audioBytes.length === 0) {
        throw new Error("Audio payload is empty");
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

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq transcription failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return (data?.text ?? "") as string;
    } catch (error) {
      console.error("Groq transcription action failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});
