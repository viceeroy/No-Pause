const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const WHISPER_MODEL = "whisper-large-v3-turbo";
const CHAT_MODEL = "llama-3.3-70b-versatile";

type HesitationAnalysis = {
  hesitation_count: number;
};

export type TranscribedWord = {
  word: string;
  start: number;
  end: number;
};

export type VerboseTranscription = {
  text: string;
  words: TranscribedWord[];
};

export type Base64TranscriptionInput = {
  audioBase64: string;
  mimeType: string;
  language?: string;
  durationSec?: number;
};

function getGroqApiKey(): string {
  const processEnv =
    typeof process !== "undefined"
      ? (process.env as Record<string, string | undefined>)
      : undefined;
  const viteEnv =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      : undefined;
  const apiKey = processEnv?.GROQ_API_KEY ?? viteEnv?.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  return apiKey;
}

function getAudioFilename(audio: File | Blob): string {
  if ("name" in audio && typeof audio.name === "string" && audio.name.trim()) {
    return audio.name;
  }

  const extensionByMime: Record<string, string> = {
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/ogg": "ogg",
  };
  const mimeType = audio.type.split(";")[0] || "audio/webm";
  return `recording.${extensionByMime[mimeType] || "webm"}`;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  if (typeof atob !== "function") {
    throw new Error("Base64 decoding is not available in this runtime");
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

function parseHesitationAnalysis(content: string): HesitationAnalysis {
  const jsonText = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(jsonText) as {
    hesitation_count?: unknown;
  };
  const numberValue = Number(parsed.hesitation_count);

  return {
    hesitation_count: Number.isFinite(numberValue)
      ? Math.max(0, Math.min(9999, Math.round(numberValue)))
      : 0,
  };
}

function parseTranscribedWords(words: unknown): TranscribedWord[] {
  if (!Array.isArray(words)) {
    return [];
  }

  return words.flatMap((word) => {
    const maybeWord = word as { word?: unknown; start?: unknown; end?: unknown };
    const start = Number(maybeWord.start);
    const end = Number(maybeWord.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return [];
    }

    return [
      {
        word: String(maybeWord.word ?? "").trim(),
        start,
        end,
      },
    ];
  });
}

export async function transcribeAudio(audio: File | Blob): Promise<string> {
  try {
    if (audio.size === 0) {
      throw new Error("Audio payload is empty");
    }

    const formData = new FormData();
    formData.append("file", audio, getAudioFilename(audio));
    formData.append("model", WHISPER_MODEL);

    const response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGroqApiKey()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq transcription failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    return String(data?.text ?? "").trim();
  } catch (error) {
    console.error("Groq transcription failed", {
      message: error instanceof Error ? error.message : String(error),
      mimeType: audio.type,
      size: audio.size,
    });
    throw error;
  }
}

export async function transcribeBase64Audio(input: Base64TranscriptionInput): Promise<string> {
  try {
    const safeMimeType = input.mimeType.split(";")[0] || "audio/webm";
    const audioByteLength = Math.floor((input.audioBase64.length * 3) / 4);
    const MAX_BYTES = 15 * 1024 * 1024;
    const MIN_BYTES = 5 * 1024;
    if (audioByteLength === 0) {
      throw new Error("Audio payload is empty");
    }
    if (input.durationSec !== undefined && input.durationSec < 1) {
      return "";
    }
    if (audioByteLength < MIN_BYTES) {
      return "";
    }
    if (audioByteLength > MAX_BYTES) {
      throw new Error(`Audio payload too large: ${audioByteLength} bytes`);
    }

    const audioBlob = base64ToBlob(input.audioBase64, safeMimeType);
    const transcript = await transcribeAudio(audioBlob);
    if (!transcript) return "";

    const normalized = transcript.toLowerCase().trim();
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 3) return "";

    return transcript;
  } catch (error) {
    console.error("Groq base64 transcription failed", {
      message: error instanceof Error ? error.message : String(error),
      mimeType: input.mimeType,
      language: input.language ?? null,
      durationSec: input.durationSec ?? null,
      base64Length: input.audioBase64.length,
    });
    throw error;
  }
}

export async function transcribeAudioVerbose(audio: File | Blob): Promise<VerboseTranscription> {
  try {
    if (audio.size === 0) {
      throw new Error("Audio payload is empty");
    }

    const formData = new FormData();
    formData.append("file", audio, getAudioFilename(audio));
    formData.append("model", WHISPER_MODEL);
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");

    const response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGroqApiKey()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq verbose transcription failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    return {
      text: String(data?.text ?? "").trim(),
      words: parseTranscribedWords(data?.words),
    };
  } catch (error) {
    console.error("Groq verbose transcription failed", {
      message: error instanceof Error ? error.message : String(error),
      mimeType: audio.type,
      size: audio.size,
    });
    throw error;
  }
}

export async function analyzeSpeech(transcript: string): Promise<HesitationAnalysis> {
  try {
    const trimmed = transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGroqApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You count only spoken filler hesitations in transcript text. Count words/sounds like "um", "uh", "er", and "ah". Do not infer silent pauses. Return ONLY valid JSON: { "hesitation_count": <number> }',
          },
          {
            role: "user",
            content: trimmed,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq speech analysis failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
    return parseHesitationAnalysis(content);
  } catch (error) {
    console.error("Groq speech analysis failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: transcript.length,
    });
    throw error;
  }
}

export async function getAIFeedback(transcript: string, systemPrompt?: string): Promise<string> {
  try {
    const trimmed = transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGroqApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          {
            role: "system",
            content:
              systemPrompt ??
              "You are a speech fluency coach. Give specific, actionable feedback on this speech transcript in 3-4 sentences. Focus on clarity, confidence, and areas to improve.",
          },
          {
            role: "user",
            content: trimmed,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq feedback failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    return String(data?.choices?.[0]?.message?.content ?? "").trim() || "I could not generate feedback right now.";
  } catch (error) {
    console.error("Groq feedback failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: transcript.length,
    });
    throw error;
  }
}
