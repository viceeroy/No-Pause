export type TopicDifficulty = 'easy' | 'medium';

export type TopicCategory =
  | 'PEOPLE'
  | 'PLACE'
  | 'EXPERIENCE'
  | 'MEMORY'
  | 'EVENT';

export type LemonCategory =
  | 'Object'
  | 'Emotion'
  | 'Action'
  | 'Situation'
  | 'Place'
  | 'People';

export interface TopicPrompt {
  id: string;
  topicTitle: string;
  cueCard: string[];
  difficulty: TopicDifficulty;
  category: TopicCategory;
}

export interface LemonPrompt {
  id: string;
  word: string;
  category: LemonCategory;
  speakingHints: string[];
}

export const TOPIC_CATEGORIES: TopicCategory[] = [
  'PEOPLE',
  'PLACE',
  'EXPERIENCE',
  'MEMORY',
  'EVENT',
];

export const LEMON_CATEGORIES: LemonCategory[] = [
  'Object',
  'Emotion',
  'Action',
  'Situation',
  'Place',
  'People',
];

let topicCache: TopicPrompt[] | null = null;
let lemonCache: LemonPrompt[] | null = null;
let topicLoadPromise: Promise<TopicPrompt[]> | null = null;
let lemonLoadPromise: Promise<LemonPrompt[]> | null = null;

const topicUrl = new URL('../data/topicPrompts.json', import.meta.url).href;
const lemonUrl = new URL('../data/lemonPrompts.json', import.meta.url).href;

function topicFallbackPrompts(): TopicPrompt[] {
  const fallbackTopicTitles = [
    'Describe a person you admire and explain why.',
    'Describe a place you want to visit and what you would do there.',
    'Describe a memorable challenge you overcame.',
    'Describe a conversation that changed your perspective.',
    'Describe an event that made you feel proud.',
    'Describe a skill you recently improved and how.',
    'Describe a time you helped someone.',
    'Describe a decision you made under pressure.',
  ];

  return fallbackTopicTitles.map((title, index) => ({
    id: `fallback-topic-${index}`,
    topicTitle: title,
    cueCard: [
      'when it happened',
      'where it happened',
      'who was involved',
      'what happened',
      'how you felt',
    ],
    difficulty: index % 2 === 0 ? 'easy' : 'medium',
    category: TOPIC_CATEGORIES[index % TOPIC_CATEGORIES.length],
  }));
}

function lemonFallbackPrompts(): LemonPrompt[] {
  const fallbackWords = [
    'Friendship',
    'Innovation',
    'Balance',
    'Ambition',
    'Routine',
    'Adventure',
    'Kindness',
    'Perspective',
    'Leadership',
    'Creativity',
  ];

  return fallbackWords.map((word, index) => ({
    id: `fallback-lemon-${index}`,
    word,
    category: 'Object',
    speakingHints: ['describe it', 'tell a story', 'explain when you use it', 'why it matters', 'personal memory'],
  }));
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load prompts from ${url}`);
  }
  return response.json();
}

export async function getTopicPrompts(): Promise<TopicPrompt[]> {
  if (topicCache) return topicCache;
  if (!topicLoadPromise) {
    topicLoadPromise = fetchJson<TopicPrompt[]>(topicUrl)
      .then((data) => {
        topicCache = data;
        return data;
      })
      .catch((error) => {
        console.error('[PromptService] Failed to load topic prompts, using fallback list.', error);
        const fallback = topicFallbackPrompts();
        topicCache = fallback;
        return fallback;
      })
      .finally(() => {
        topicLoadPromise = null;
      });
  }
  return topicLoadPromise;
}

export async function getLemonPrompts(): Promise<LemonPrompt[]> {
  if (lemonCache) return lemonCache;
  if (!lemonLoadPromise) {
    lemonLoadPromise = fetchJson<LemonPrompt[]>(lemonUrl)
      .then((data) => {
        lemonCache = data;
        return data;
      })
      .catch((error) => {
        console.error('[PromptService] Failed to load lemon prompts, using fallback list.', error);
        const fallback = lemonFallbackPrompts();
        lemonCache = fallback;
        return fallback;
      })
      .finally(() => {
        lemonLoadPromise = null;
      });
  }
  return lemonLoadPromise;
}

export async function getTopicPromptById(id: string): Promise<TopicPrompt | null> {
  const prompts = await getTopicPrompts();
  return prompts.find((p) => p.id === id) || null;
}

export async function getRandomTopicPrompt(options?: { difficulty?: TopicDifficulty }): Promise<TopicPrompt> {
  const prompts = await getTopicPrompts();
  const byDifficulty = options?.difficulty
    ? prompts.filter((prompt) => prompt.difficulty === options.difficulty)
    : prompts;
  const pool = byDifficulty.length > 0 ? byDifficulty : prompts;
  if (pool.length === 0) {
    throw new Error('No topic prompts available');
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function getRandomLemonPrompt(): Promise<LemonPrompt> {
  const prompts = await getLemonPrompts();
  if (prompts.length === 0) {
    throw new Error('No lemon prompts available');
  }
  return prompts[Math.floor(Math.random() * prompts.length)];
}
