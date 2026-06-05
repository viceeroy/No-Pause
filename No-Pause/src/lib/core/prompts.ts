export type PromptCategory = {
  id: 'argue' | 'inform' | 'describe' | 'opinion';
  label: string;
  description: string;
  prompts: string[];
};

export const promptCategories: PromptCategory[] = [
  {
    id: 'argue',
    label: 'Argue',
    description: 'Practice taking a stance and backing it up.',
    prompts: [
      'Defend or oppose the idea that every city should have more public gathering spaces than shopping areas.',
      'Argue whether competitions bring out the best in people or make them too focused on winning.',
      'Take a position on whether old buildings should be preserved even when replacing them would be cheaper.',
      'Defend or oppose the statement that rules are more useful when they are simple than when they are perfectly fair.',
      'Argue whether people learn more from being challenged or from being encouraged.',
      'Take a side on whether museums should be free for everyone.',
      'Defend or oppose the idea that quiet people are often underestimated.',
      'Argue whether a small team with trust can outperform a large team with more resources.',
      'Take a position on whether traditions should be protected or regularly questioned.',
      'Defend or oppose the statement that the best leaders are the best listeners.',
    ],
  },
  {
    id: 'inform',
    label: 'Inform',
    description: 'Practice organizing and delivering information.',
    prompts: [
      'Explain how a debate works to someone who has never watched one before.',
      'Explain the difference between a habit, a routine, and a tradition.',
      'Describe how a public library serves a community beyond lending books.',
      'Explain how to compare two choices when neither one is obviously better.',
      'Explain why examples make an explanation easier to understand.',
      'Describe the steps for planning a simple community event.',
      'Explain how a person can tell whether a source of information is trustworthy.',
      'Explain why timing matters when telling a story or giving an announcement.',
      'Describe how teamwork changes when a group has a clear shared goal.',
      'Explain what makes instructions easy or difficult to follow.',
    ],
  },
  {
    id: 'describe',
    label: 'Describe',
    description: 'Practice using vivid and specific language.',
    prompts: [
      'Describe a marketplace just before it becomes busy for the day.',
      'Describe the feeling of walking into a quiet room after a loud event.',
      'Describe an object that looks ordinary at first but becomes interesting when you look closely.',
      'Describe a person waiting for important news without saying what the news is.',
      'Describe a place where time seems to move more slowly.',
      'Describe the first minute after rain stops in a crowded street.',
      'Describe a table set for a conversation that has not started yet.',
      'Describe a doorway, path, or entrance that makes someone curious to continue.',
      'Describe the sound and movement of a place waking up in the morning.',
      'Describe a memory of a shared celebration without naming the celebration directly.',
    ],
  },
  {
    id: 'opinion',
    label: 'Opinion',
    description: 'Practice speaking your mind clearly and directly.',
    prompts: [
      'What makes a conversation memorable?',
      'Is it better to be direct or gentle when giving honest feedback?',
      'What makes a place feel welcoming?',
      'Should people spend more time learning from older generations?',
      'Is silence in conversation awkward or useful?',
      'What is more impressive: consistency or originality?',
      'Should public speaking be judged more on clarity or charisma?',
      'Is it better to ask many questions or offer strong opinions?',
      'What makes a story worth retelling?',
      'Should people practice disagreeing more respectfully?',
    ],
  },
];

export const opinionPrompts = promptCategories.flatMap((category) => category.prompts);

export function getShuffledPrompts(n: number): string[] {
  const arr = [...opinionPrompts];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

export function getRandomPrompt(excludeLast?: string): string {
  if (opinionPrompts.length <= 1) {
    return opinionPrompts[0] ?? 'Talk about something you care about.';
  }

  let prompt = opinionPrompts[Math.floor(Math.random() * opinionPrompts.length)];
  while (prompt === excludeLast) {
    prompt = opinionPrompts[Math.floor(Math.random() * opinionPrompts.length)];
  }

  return prompt;
}
