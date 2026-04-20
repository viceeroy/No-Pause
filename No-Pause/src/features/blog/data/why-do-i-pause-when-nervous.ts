import type { BlogPost } from './types';

export const whyDoIPauseWhenNervousPost: BlogPost = {
  title: 'Why do I pause more when I feel nervous?',
  slug: 'why-do-i-pause-when-nervous',
  date: '2026-03-01',
  description: 'Understand why nervousness increases pauses and how to regain flow during stressful speaking.',
  readingTime: '1–2 min read',
  shortAnswer:
    'Nervousness increases pauses because stress raises cognitive load and disrupts speech planning. Your mind monitors mistakes more and prepares ideas less, so flow breaks more often. With structured drills, nervous-pause spikes can be reduced quickly. In No Pause, this becomes measurable when you compare sessions with similar duration and mode difficulty.',
  sections: [
    {
      heading: 'What stress changes in speech',
      content:
        'Under stress, attention shifts toward self-evaluation. That means less bandwidth for organizing your next phrase, which creates hesitation and stop-start delivery. Use the Stats page to validate whether the change helped by checking hesitation count together with session duration.',
      bullets: [
        'Faster heartbeat, less pacing control',
        'Overthinking wording choices',
        'Delayed transition planning',
      ],
    },
    {
      heading: 'How to stabilize quickly',
      content:
        'Use a fixed speaking frame before starting. In Topic Mode, define opening, middle, and close in one sentence each. This reduces planning load during the session. Keeping the same session conditions for a few runs gives cleaner feedback and helps you improve more predictably.',
      bullets: [
        'Pre-plan three anchors',
        'Start slower than normal',
        'Use short intentional pauses',
      ],
    },
    {
      heading: 'Use No Pause data',
      content:
        'Track hesitation trend across similar stress levels. If pauses drop while duration stays stable, your pressure handling is improving, not just your confidence in easy sessions. The most useful signal is steady improvement, not perfection in a single session, especially when difficulty rises.',
    },
  ],
  takeaway: 'Before stressful speaking, do one 2-minute warm-up session with a simple three-point structure.',
};
