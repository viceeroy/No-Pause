import { action } from "./_generated/server";
import { v } from "convex/values";

export const transcribeAudio = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set");
    }

    const audioBytes = Buffer.from(args.audioBase64, "base64");
    const audioBlob = new Blob([audioBytes], { type: args.mimeType });

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
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
  },
});
