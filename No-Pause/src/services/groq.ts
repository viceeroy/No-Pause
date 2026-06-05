const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const CHAT_MODEL = "llama-3.3-70b-versatile";
const TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
const GROQ_TIMEOUT_MS = 20_000;

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

export type GroqTranscribedWord = {
  word: string;
  start: number;
  end: number;
  type?: string;
};

export type GroqTranscription = {
  text: string;
  words: GroqTranscribedWord[];
};

type GroqTranscriptionResponse = {
  text?: unknown;
  words?: unknown;
  segments?: unknown;
};

function getGroqApiKey(): string {
  const processEnv =
    typeof process !== "undefined"
      ? (process.env as Record<string, string | undefined>)
      : undefined;
  const apiKey = processEnv?.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  return apiKey;
}

function parseGroqWords(words: unknown): GroqTranscribedWord[] {
  if (!Array.isArray(words)) {
    return [];
  }

  return words.flatMap((word) => {
    const maybeWord = word as { word?: unknown; start?: unknown; end?: unknown; type?: unknown };
    const start = Number(maybeWord.start);
    const end = Number(maybeWord.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return [];
    }

    const tokenType = typeof maybeWord.type === "string" ? maybeWord.type.trim() : "";

    return [{
      word: String(maybeWord.word ?? "").trim(),
      start,
      end,
      ...(tokenType ? { type: tokenType } : {}),
    }];
  });
}

function parseGroqSegmentWords(segments: unknown): GroqTranscribedWord[] {
  if (!Array.isArray(segments)) {
    return [];
  }

  return segments.flatMap((segment) => {
    const maybeSegment = segment as { words?: unknown };
    return parseGroqWords(maybeSegment.words);
  });
}

function getAudioFilename(mimeType: string): string {
  if (mimeType.includes("webm")) return "audio.webm";
  if (mimeType.includes("wav")) return "audio.wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "audio.mp3";
  if (mimeType.includes("mp4")) return "audio.mp4";
  if (mimeType.includes("m4a")) return "audio.m4a";
  if (mimeType.includes("flac")) return "audio.flac";
  return "audio.ogg";
}

export async function transcribeAudioWithGroq(
  audioBuffer: ArrayBuffer,
  mimeType = "audio/ogg",
): Promise<GroqTranscription> {
  if (audioBuffer.byteLength === 0) {
    throw new Error("Audio payload is empty");
  }

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: mimeType }), getAudioFilename(mimeType));
  formData.append("model", TRANSCRIPTION_MODEL);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  formData.append("temperature", "0");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGroqApiKey()}`,
      },
      body: formData,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq transcription failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json() as GroqTranscriptionResponse;

  const topLevelWords = parseGroqWords(data?.words);
  const words = topLevelWords.length > 0
    ? topLevelWords
    : parseGroqSegmentWords(data?.segments);

  return {
    text: String(data?.text ?? "").trim(),
    words,
  };
}

export async function getAIFeedback(transcript: string, systemPrompt?: string): Promise<string> {
  try {
    const trimmed = transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
    let response: Response;

    try {
      response = await fetch(GROQ_CHAT_URL, {
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
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq feedback failed: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const data = await response.json() as GroqChatCompletionResponse;
    return String(data?.choices?.[0]?.message?.content ?? "").trim() || "I could not generate feedback right now.";
  } catch (error) {
    console.error("Groq feedback failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: transcript.length,
    });
    throw error;
  }
}

export type GenerateCategoryPromptsInput = {
  label: string;
  description: string;
  existing: string[];
  count: number;
};

function parseGeneratedPrompts(content: unknown, existing: string[], count: number): string[] {
  const raw = String(content ?? "").trim();
  if (!raw) {
    throw new Error("Groq returned empty prompt content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Model sometimes wraps JSON in prose/code fences; extract the first object.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Groq prompt response was not valid JSON");
    }
    parsed = JSON.parse(match[0]);
  }

  const list = (parsed as { prompts?: unknown })?.prompts;
  if (!Array.isArray(list)) {
    throw new Error("Groq prompt response missing prompts array");
  }

  const seen = new Set(existing.map((prompt) => prompt.trim().toLowerCase()));
  const result: string[] = [];
  for (const item of list) {
    const prompt = typeof item === "string" ? item.trim() : "";
    if (!prompt) continue;
    const key = prompt.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(prompt);
    if (result.length >= count) break;
  }

  if (result.length === 0) {
    throw new Error("Groq produced no usable prompts");
  }

  return result;
}

export async function generateCategoryPrompts(input: GenerateCategoryPromptsInput): Promise<string[]> {
  const { label, description, existing, count } = input;

  const systemPrompt = [
    "You generate speaking-practice prompts for a speech fluency app.",
    `The current category is "${label}": ${description}`,
    "Study the existing prompts the user provides as style examples, then write brand-new prompts that match their tone, length, structure, and difficulty.",
    "Each prompt must be a single self-contained sentence suitable for a 1 to 3 minute spoken response.",
    "Do not repeat or lightly reword the existing prompts. Do not number them or add commentary.",
    'Respond with strict JSON only, in the exact shape {"prompts": ["...", "..."]}.',
  ].join(" ");

  const userMessage = [
    `Generate ${count} new "${label}" prompts.`,
    "Existing prompts (match this style, do not duplicate):",
    ...existing.map((prompt) => `- ${prompt}`),
  ].join("\n");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getGroqApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq prompt generation failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as GroqChatCompletionResponse;
  return parseGeneratedPrompts(data?.choices?.[0]?.message?.content, existing, count);
}
