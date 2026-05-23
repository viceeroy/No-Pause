export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function getWordCount(transcript: string): number {
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}

export type TranscribedWord = {
  word: string;
  start: number;
  end: number;
};

export function parseTranscribedWords(words: unknown): TranscribedWord[] {
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
