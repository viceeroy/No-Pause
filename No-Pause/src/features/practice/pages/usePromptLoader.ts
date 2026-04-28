import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PracticeStateStore } from './types';

interface PromptLoaderResult {
  mode: 'free';
  getModeTitle: () => string;
  getModeDescription: () => string;
}

export function usePromptLoader(state: PracticeStateStore): PromptLoaderResult {
  const [searchParams] = useSearchParams();
  const mode = 'free' as const;
  const promptText = searchParams.get('prompt_text');

  const {
    setTimeLeft,
    setTopicPrompt,
  } = state;

  useEffect(() => {
    let active = true;

    if (active) {
      setTimeLeft(0);
      setTopicPrompt(promptText ? {
        id: 'free-speaking-topic',
        topicTitle: decodeURIComponent(promptText),
        category: 'EXPERIENCE',
        difficulty: 'medium',
        cueCard: [],
      } : null);
    }

    return () => {
      active = false;
    };
  }, [
    promptText,
    setTimeLeft,
    setTopicPrompt,
  ]);

  const getModeTitle = useCallback(() => 'Free Speaking', []);

  const getModeDescription = useCallback(() => 'Talk about anything, no time limit', []);

  return useMemo(() => ({
    mode,
    getModeTitle,
    getModeDescription,
  }), [mode, getModeTitle, getModeDescription]);
}
