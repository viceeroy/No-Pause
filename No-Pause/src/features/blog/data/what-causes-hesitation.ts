import type { BlogPost } from './types';

export const whatCausesHesitationPost: BlogPost = {
  title: 'What causes hesitation while speaking?',
  slug: 'what-causes-hesitation',
  date: '2026-03-01',
  description: 'Understand the main causes of hesitation and how to train smoother transitions in speaking sessions.',
  readingTime: '1–2 min read',
  shortAnswer:
    'Hesitation usually comes from planning and speaking at the same time. Common triggers are unclear structure, stress, topic difficulty, and rushing. When you simplify thought flow and pace, hesitation drops quickly. In No Pause, this becomes measurable when you compare sessions with similar duration and mode difficulty.',
  sections: [
    {
      heading: 'Most common triggers',
      content:
        'Hesitation is often a load problem, not a talent problem. Your brain is choosing words, organizing ideas, and monitoring delivery at once, so pauses appear when one layer gets overloaded. Use the Stats page to validate whether the change helped by checking hesitation count together with session duration.',
      bullets: [
        'No clear next point',
        'Complex sentence planning',
        'Pressure to sound perfect',
        'Speaking faster than thinking',
      ],
    },
    {
      heading: 'How to reduce load',
      content:
        'Use shorter sentence blocks and predictable transitions. In Topic Mode, decide your three points before speaking. In Free Speaking, prioritize rhythm over perfect wording so momentum stays intact. Keeping the same session conditions for a few runs gives cleaner feedback and helps you improve more predictably.',
      bullets: [
        'Point 1 -> Point 2 -> Point 3',
        'One idea per sentence',
        'Pause intentionally, not reactively',
      ],
    },
    {
      heading: 'Measure the change',
      content:
        'Track hesitation count, duration, and Flow Score trend in Stats. Improvement is real when pauses decrease without cutting session time too short. The most useful signal is steady improvement, not perfection in a single session, especially when difficulty rises.',
    },
  ],
  takeaway: 'Before your next session, write three bullet points and speak only from that structure.',
};
