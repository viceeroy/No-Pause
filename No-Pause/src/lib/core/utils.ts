export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function getWordCount(transcript: string): number {
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}
