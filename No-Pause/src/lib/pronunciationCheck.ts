type MatchStatus = 'exact' | 'close' | 'missed';

export type PronunciationWord = {
  word: string;
  status: MatchStatus;
};

export type PronunciationResult = {
  words: PronunciationWord[];
  accuracy: number;
};

const normalizeToken = (token: string) =>
  token
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

const tokenize = (text: string) =>
  text
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

const levenshtein = (a: string, b: string) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[a.length][b.length];
};

const similarity = (a: string, b: string) => {
  if (!a.length && !b.length) return 1;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
};

export const runPronunciationCheck = (passage: string, transcript: string): PronunciationResult => {
  const passageTokens = tokenize(passage);
  const transcriptTokens = tokenize(transcript);

  let transcriptIndex = 0;
  const words: PronunciationWord[] = [];
  let points = 0;

  for (let i = 0; i < passageTokens.length; i += 1) {
    const expected = passageTokens[i];
    let matched = false;

    while (transcriptIndex < transcriptTokens.length) {
      const spoken = transcriptTokens[transcriptIndex];
      const exact = spoken === expected;
      const close = !exact && similarity(spoken, expected) >= 0.8;

      if (exact || close) {
        matched = true;
        transcriptIndex += 1;
        if (exact) {
          points += 1;
          words.push({ word: expected, status: 'exact' });
        } else {
          points += 0.5;
          words.push({ word: expected, status: 'close' });
        }
        break;
      }

      transcriptIndex += 1;
    }

    if (!matched) {
      words.push({ word: expected, status: 'missed' });
    }
  }

  const accuracy = passageTokens.length > 0 ? (points / passageTokens.length) * 100 : 0;
  return { words, accuracy: Math.round(accuracy) };
};
