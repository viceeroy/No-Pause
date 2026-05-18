const DEEPGRAM_TRANSCRIPTION_URL = "https://api.deepgram.com/v1/listen";
const DEEPGRAM_TIMEOUT_MS = 20_000;
const SPOKEN_FILLER_WORDS = new Set(["uh", "um", "hmm", "uh-huh", "mhm", "hm", "uhh", "umm"]);

export type DeepgramTranscribedWord = {
  word: string;
  start: number;
  end: number;
  type?: string;
};

export type DeepgramTranscription = {
  text: string;
  words: DeepgramTranscribedWord[];
  fillerCount: number;
};

function getDeepgramApiKey(): string {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not set");
  }

  return apiKey;
}

function parseDeepgramWords(words: unknown): DeepgramTranscribedWord[] {
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

function countFillerWords(words: DeepgramTranscribedWord[]): number {
  const normalizeWord = (word: string) => word
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, "");

  return words.reduce((count, word) => (
    SPOKEN_FILLER_WORDS.has(normalizeWord(word.word)) ? count + 1 : count
  ), 0);
}

function getDeepgramAlternative(data: unknown) {
  const maybeData = data as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          transcript?: unknown;
          words?: unknown;
        }>;
      }>;
    };
  } | null;

  return maybeData?.results?.channels?.[0]?.alternatives?.[0];
}

export async function transcribeAudioWithDeepgram(
  audioBuffer: ArrayBuffer,
  mimeType = "audio/ogg",
): Promise<DeepgramTranscription> {
  if (audioBuffer.byteLength === 0) {
    throw new Error("Audio payload is empty");
  }

  const url = new URL(DEEPGRAM_TRANSCRIPTION_URL);
  url.searchParams.set("model", "nova-3");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("punctuate", "true");
  url.searchParams.set("words", "true");
  url.searchParams.set("filler_words", "true");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEPGRAM_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${getDeepgramApiKey()}`,
        "Content-Type": mimeType,
      },
      body: audioBuffer,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram transcription failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const alternative = getDeepgramAlternative(data);
  const words = parseDeepgramWords(alternative?.words);

  return {
    text: String(alternative?.transcript ?? "").trim(),
    words,
    fillerCount: countFillerWords(words),
  };
}
