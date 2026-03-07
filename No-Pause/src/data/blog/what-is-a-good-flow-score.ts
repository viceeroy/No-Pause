import type { BlogPost } from './types';

export const whatIsAGoodFlowScorePost: BlogPost = {
  title: 'What is a good Flow Score?',
  slug: 'what-is-a-good-flow-score',
  date: '2026-03-01',
  description: 'Learn how to judge Flow Score quality using mode difficulty, duration, and trend progression.',
  readingTime: '1–2 min read',
  shortAnswer:
    'A good Flow Score is one that improves consistently for your current mode and duration level. Many learners treat 80+ as strong control, but trend direction matters more than a single number. Stable improvement under harder conditions is the best sign. Real improvement is visible when smoother transitions appear without reducing speaking duration too much.',
  sections: [
    {
      heading: 'Context matters more than rank',
      content:
        'An 82 in a long, demanding session can be more valuable than a 92 in a short easy attempt. Always read score together with mode and speaking duration. The most useful signal is steady improvement, not perfection in a single session, especially when difficulty rises.',
      bullets: [
        'Compare same mode first',
        'Compare similar session length',
        'Check weekly average, not one run',
      ],
    },
    {
      heading: 'A practical range approach',
      content:
        'Instead of chasing perfect scores, set range goals. For example, maintain a target range for two weeks, then increase difficulty while protecting that range. This pattern is easiest to confirm when you compare the same mode across multiple sessions instead of relying on one attempt.',
      bullets: [
        '70–79: building control',
        '80–89: solid fluency rhythm',
        '90+: strong consistency',
      ],
    },
    {
      heading: 'Use Stats to validate growth',
      content:
        'If average score rises while hesitation count falls and duration holds, your speaking system is improving, not just your lucky-session outcome. In practice, the fastest gains come from one clear adjustment, then immediate retesting in your next speaking session.',
    },
  ],
  takeaway: 'Choose a target range for your current mode and maintain it for seven sessions before leveling up.',
};
