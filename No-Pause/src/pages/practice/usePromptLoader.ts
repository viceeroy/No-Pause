import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  LEMON_MIN_TOTAL_SECONDS,
  TOPIC_MIN_TOTAL_SECONDS,
} from '@/lib/scoringConstants';
import {
  getRandomLemonPrompt,
  getRandomTopicPrompt,
  getTopicPromptById,
  type LemonPrompt,
  type TopicPrompt,
} from '@/lib/promptService';
import type { PracticeStateStore, TopicDifficultyMode } from './types';
import { toMMSS } from './time';

interface PromptLoaderResult {
  mode: string;
  handleRandomPrompt: () => Promise<void>;
  handleTopicDifficultySelect: (difficultyMode: TopicDifficultyMode) => Promise<void>;
  getModeTitle: () => string;
  getModeDescription: () => string;
}

const fallbackLemonPrompt: LemonPrompt = {
  id: 'fallback',
  word: 'Friendship',
  category: 'Object',
  speakingHints: ['describe it', 'tell a story', 'explain when you use it', 'why it matters', 'personal memory'],
};

const fallbackTopicPrompt: TopicPrompt = {
  id: 'fallback',
  topicTitle: 'Describe a memorable conversation you had recently.',
  category: 'EXPERIENCE',
  difficulty: 'medium',
  cueCard: ['when it happened', 'where you were', 'who it was with', 'what was discussed', 'how you felt'],
};

export function usePromptLoader(state: PracticeStateStore): PromptLoaderResult {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const isFreeSpeakingRoute = location.pathname === '/practice/free-speaking';
  const frozenModeRef = useRef<string | null>(null);
  if (!frozenModeRef.current) {
    const rawMode = isFreeSpeakingRoute ? 'free' : (searchParams.get('mode') || 'free');
    frozenModeRef.current = rawMode === 'reading' ? 'voiceacting' : rawMode;
  }
  const mode = frozenModeRef.current ?? 'free';
  const word = searchParams.get('word');
  const promptId = searchParams.get('prompt');
  const promptText = searchParams.get('prompt_text');

  const {
    topicDifficultyMode,
    lemonPrompt,
    setTimeLeft,
    setPromptLoading,
    setLemonPrompt,
    setTopicPrompt,
    setTopicDifficultyMode,
  } = state;

  const pickTopicByDifficultyMode = useCallback(async (difficultyMode: TopicDifficultyMode) => {
    if (difficultyMode === 'random') return getRandomTopicPrompt();
    return getRandomTopicPrompt({ difficulty: difficultyMode });
  }, []);

  useEffect(() => {
    let active = true;

    const initializePrompt = async () => {
      if (mode === 'free') {
        if (active) setTimeLeft(0);
        return;
      }

      setPromptLoading(true);
      try {
        if (mode === 'lemon') {
          if (word) {
            setLemonPrompt({
              id: 'manual',
              word: decodeURIComponent(word),
              category: 'Situation',
              speakingHints: ['describe it', 'tell a story', 'explain when you use it', 'why it matters', 'personal memory'],
            });
          } else {
            const picked = await getRandomLemonPrompt();
            if (active) setLemonPrompt(picked);
          }
          if (active) setTimeLeft(LEMON_MIN_TOTAL_SECONDS);
          return;
        }

        if (mode === 'topic') {
          if (promptText) {
            setTopicDifficultyMode('medium');
            setTopicPrompt({
              id: 'manual',
              topicTitle: decodeURIComponent(promptText),
              category: 'EXPERIENCE',
              difficulty: 'medium',
              cueCard: [
                'when it happened',
                'where you were',
                'who was involved',
                'what happened',
                'how you felt',
              ],
            });
          } else if (promptId) {
            const selected = await getTopicPromptById(promptId);
            if (active) {
              const prompt = selected || await pickTopicByDifficultyMode(topicDifficultyMode);
              setTopicPrompt(prompt);
              setTopicDifficultyMode(prompt.difficulty);
            }
          } else {
            const picked = await pickTopicByDifficultyMode(topicDifficultyMode);
            if (active) setTopicPrompt(picked);
          }
          if (active) setTimeLeft(TOPIC_MIN_TOTAL_SECONDS);
        }
      } catch (error) {
        console.error('[PracticePage] Failed to initialize prompts, using fallback prompt.', error);
        if (active) {
          if (mode === 'lemon') setLemonPrompt(fallbackLemonPrompt);
          if (mode === 'topic') setTopicPrompt(fallbackTopicPrompt);
          if (mode === 'lemon') setTimeLeft(LEMON_MIN_TOTAL_SECONDS);
          if (mode === 'topic') setTimeLeft(TOPIC_MIN_TOTAL_SECONDS);
        }
      } finally {
        if (active) setPromptLoading(false);
      }
    };

    initializePrompt();

    return () => {
      active = false;
    };
  }, [
    mode,
    word,
    promptId,
    promptText,
    pickTopicByDifficultyMode,
    setTimeLeft,
    setPromptLoading,
    setLemonPrompt,
    setTopicPrompt,
    setTopicDifficultyMode,
  ]);

  const handleRandomPrompt = useCallback(async () => {
    setPromptLoading(true);
    if (mode === 'lemon') {
      try {
        const picked = await getRandomLemonPrompt();
        setLemonPrompt(picked);
      } finally {
        setPromptLoading(false);
      }
    } else if (mode === 'topic') {
      try {
        const picked = await pickTopicByDifficultyMode(topicDifficultyMode);
        setTopicPrompt(picked);
      } finally {
        setPromptLoading(false);
      }
    } else {
      setPromptLoading(false);
    }
  }, [mode, pickTopicByDifficultyMode, topicDifficultyMode, setPromptLoading, setLemonPrompt, setTopicPrompt]);

  const handleTopicDifficultySelect = useCallback(async (difficultyMode: TopicDifficultyMode) => {
    setTopicDifficultyMode(difficultyMode);
    if (mode !== 'topic') return;
    setPromptLoading(true);
    try {
      const picked = await pickTopicByDifficultyMode(difficultyMode);
      setTopicPrompt(picked);
    } finally {
      setPromptLoading(false);
    }
  }, [mode, pickTopicByDifficultyMode, setTopicDifficultyMode, setPromptLoading, setTopicPrompt]);

  const getModeTitle = useCallback(() => {
    switch (mode) {
      case 'free': return 'Free Speaking';
      case 'lemon': return 'Lemon Technique';
      case 'topic': return 'Topic Score';
      case 'voiceacting': return 'Voice Acting';
      default: return 'Practice';
    }
  }, [mode]);

  const getModeDescription = useCallback(() => {
    switch (mode) {
      case 'free':
        return 'Talk about anything, no time limit';
      case 'lemon':
        return `Speak about "${lemonPrompt?.word || ''}" for a ${toMMSS(LEMON_MIN_TOTAL_SECONDS)} total session`;
      case 'topic':
        return `Respond to the topic for a ${toMMSS(TOPIC_MIN_TOTAL_SECONDS)} total session`;
      case 'voiceacting':
        return 'Perform a dramatic passage with emotion and clarity';
      default:
        return 'Speaking practice';
    }
  }, [mode, lemonPrompt?.word]);

  return useMemo(() => ({
    mode,
    handleRandomPrompt,
    handleTopicDifficultySelect,
    getModeTitle,
    getModeDescription,
  }), [mode, handleRandomPrompt, handleTopicDifficultySelect, getModeTitle, getModeDescription]);
}
