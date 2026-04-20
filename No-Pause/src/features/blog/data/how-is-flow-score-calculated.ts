import type { BlogPost } from './types';

export const howIsFlowScoreCalculatedPost: BlogPost = {
  title: 'How is Flow Score calculated?',
  slug: 'how-is-flow-score-calculated',
  date: '2026-03-01',
  description: 'See the simple scoring logic behind No Pause Flow Score and how hesitations affect final score.',
  readingTime: '1–2 min read',
  shortAnswer:
    'Flow Score is calculated based on your hesitations per minute of speaking time. It starts at 100, with a grace period for the first 1.0 hesitations per minute. Each additional hesitation per minute beyond this grace period subtracts 15 points. The final score is also capped based on your speaking ratio (speaking time / total session time) to ensure a meaningful score reflects actual speech duration.',
  sections: [
    {
      heading: 'Rate-Based Scoring Formula',
      content:
        'The Flow Score rewards continuous speech by penalizing hesitations relative to your speaking duration. This approach provides a more nuanced assessment of fluency, accounting for session length and speaking volume. The formula is designed to encourage consistent speaking without excessive pauses.',
      bullets: [
        'Base score: 100',
        'Hesitations are measured as "hesitations per minute" (HPM) of speaking time.',
        'Grace zone: Up to 1.0 HPM scores a perfect 100 (no penalty).',
        'Penalty: Each additional HPM above the grace zone subtracts 15 points.',
        'Speaking Fluency Cap: The maximum achievable score is scaled by your speaking ratio (speaking time / total session time). A 25% speaking ratio caps the score at 70, while a 65%+ ratio allows for an uncapped score of 100. This prevents high scores for sessions with minimal speaking.',
      ],
    },
    {
      heading: 'When scoring applies',
      content:
        'Modes with completion requirements must meet duration and speaking-time thresholds to receive a valid score. If requirements are not met, score remains zero for that attempt. The most useful signal is steady improvement, not perfection in a single session, especially when difficulty rises.',
      bullets: [
        'Lemon: completion required',
        'Topic: completion required',
        'Free Speaking: tracks stats, not scored the same way',
      ],
    },
    {
      heading: 'How to interpret score changes',
      content:
        'If score drops, check hesitation count first, then review whether session conditions changed. Compare like-for-like sessions before drawing conclusions. This pattern is easiest to confirm when you compare the same mode across multiple sessions instead of relying on one attempt.',
    },
  ],
  takeaway: 'Use the formula to set a concrete goal: one fewer penalized hesitation per session.',
};
