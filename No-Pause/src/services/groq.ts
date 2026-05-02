const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const WHISPER_MODEL = "whisper-large-v3-turbo";
const CHAT_MODEL = "llama-3.3-70b-versatile";

export type TranscribedWord = {
  word: string;
  start: number;
  end: number;
  no_speech_prob?: number;
};

export type VerboseTranscription = {
  text: string;
  words: TranscribedWord[];
};

export type AnalyzePracticeSpeechInput = {
  transcript: string;
  flowScore?: number;
  hesitationCount?: number;
  speakingTime?: number;
  wordCount?: number;
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

function parseTranscribedWords(words: unknown): TranscribedWord[] {
  if (!Array.isArray(words)) {
    return [];
  }

  return words.flatMap((word) => {
    const maybeWord = word as { word?: unknown; start?: unknown; end?: unknown; no_speech_prob?: unknown };
    const start = Number(maybeWord.start);
    const end = Number(maybeWord.end);
    const noSpeechProb = Number(maybeWord.no_speech_prob);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return [];
    }

    return [{
      word: String(maybeWord.word ?? "").trim(),
      start,
      end,
      ...(Number.isFinite(noSpeechProb) ? { no_speech_prob: noSpeechProb } : {}),
    }];
  });
}

function getNoSpeechProb(data: unknown, words: TranscribedWord[]): number | undefined {
  const maybeData = data as { no_speech_prob?: unknown; segments?: unknown } | null;
  const wordProb = words[0]?.no_speech_prob;
  if (typeof wordProb === "number") {
    return wordProb;
  }

  const segments = maybeData?.segments;
  if (Array.isArray(segments)) {
    const segmentProb = Number((segments[0] as { no_speech_prob?: unknown } | undefined)?.no_speech_prob);
    if (Number.isFinite(segmentProb)) {
      return segmentProb;
    }
  }

  const topLevelProb = Number(maybeData?.no_speech_prob);
  return Number.isFinite(topLevelProb) ? topLevelProb : undefined;
}

function getWordCount(transcript: string): number {
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}

export function isUsableTranscript(transcript: string): boolean {
  return getWordCount(transcript) >= 3;
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
    const words = parseTranscribedWords(data?.words);
    const noSpeechProb = getNoSpeechProb(data, words);
    const wordsWithNoSpeechProb =
      typeof noSpeechProb === "number" && words[0] && words[0].no_speech_prob === undefined
        ? [{ ...words[0], no_speech_prob: noSpeechProb }, ...words.slice(1)]
        : words;
    console.log("no_speech_prob:", wordsWithNoSpeechProb?.[0]?.no_speech_prob);
    const text = String(data?.text ?? "").trim();
    const isHighNoSpeechProb = typeof noSpeechProb === "number" && noSpeechProb > 0.8;

    return {
      text: isHighNoSpeechProb || !isUsableTranscript(text) ? "" : text,
      words: wordsWithNoSpeechProb,
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

const buildPracticeFeedbackPrompt = (input: {
  transcript: string;
  flowScore: number;
  hesitationCount: number;
  speakingTime: number;
  wordCount: number;
}) =>
  `You are a speech analysis expert. The user just completed a speaking session. Flow Score is open-ended and grows with sustained speaking time, so do not describe it as a percentage or fixed 100-point score.
- Flow Score: ${input.flowScore}
- Pauses: ${input.hesitationCount}
- Speaking Time: ${input.speakingTime} seconds
- Word Count: ${input.wordCount}
- Transcript: ${input.transcript}

Return feedback in markdown with:
- A short punchy header (e.g. ## 🎯 Your Session Breakdown)
- Bold the key stats when mentioned (flow score, pause count)
- 2-3 short sections with emoji headers like ### 💪 What You Did Well and ### 🎯 Focus On This
- End with a single motivational sentence under ### 🚀 Next Time
Keep it under 200 words, punchy and energetic in tone — not corporate or boring.`;

export async function analyzePracticeSpeech(input: AnalyzePracticeSpeechInput): Promise<string> {
  try {
    const trimmed = input.transcript.trim();
    if (!trimmed) {
      throw new Error("Transcript is empty");
    }

    const flowScore = input.flowScore ?? 0;
    const hesitationCount = input.hesitationCount ?? 0;
    const speakingTime = input.speakingTime ?? 0;
    const wordCount = input.wordCount ?? 0;

    console.log("analyzeSpeech request", {
      transcriptLength: trimmed.length,
      flowScore,
      hesitationCount,
      speakingTime,
      wordCount,
    });

    const output = await getAIFeedback(
      trimmed,
      buildPracticeFeedbackPrompt({
        transcript: trimmed,
        flowScore,
        hesitationCount,
        speakingTime,
        wordCount,
      }),
    );
    console.log("analyzeSpeech response", {
      responseLength: output.length,
    });
    return output;
  } catch (error) {
    console.error("Groq analyzeSpeech failed", {
      message: error instanceof Error ? error.message : String(error),
      transcriptLength: input.transcript.length,
    });
    throw error;
  }
}
