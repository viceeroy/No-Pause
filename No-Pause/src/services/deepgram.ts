const DEEPGRAM_TRANSCRIPTION_URL = "https://api.deepgram.com/v1/listen";

export type DeepgramTranscribedWord = {
  word: string;
  start: number;
  end: number;
};

export type DeepgramTranscription = {
  text: string;
  words: DeepgramTranscribedWord[];
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
    const maybeWord = word as { word?: unknown; start?: unknown; end?: unknown };
    const start = Number(maybeWord.start);
    const end = Number(maybeWord.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return [];
    }

    return [{
      word: String(maybeWord.word ?? "").trim(),
      start,
      end,
    }];
  });
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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${getDeepgramApiKey()}`,
      "Content-Type": mimeType,
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram transcription failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const alternative = getDeepgramAlternative(data);

  return {
    text: String(alternative?.transcript ?? "").trim(),
    words: parseDeepgramWords(alternative?.words),
  };
}
