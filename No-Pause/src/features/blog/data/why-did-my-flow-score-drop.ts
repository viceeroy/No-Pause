import type { BlogPost } from './types';

export const whyDidMyFlowScoreDropPost: BlogPost = {
  title: 'Why did my Flow Score drop?',
  slug: 'why-did-my-flow-score-drop',
  date: '2026-03-01',
  description: 'Find the common reasons scores drop and how to recover using session data.',
  readingTime: '1–2 min read',
  shortAnswer:
    'Flow Score usually drops when hesitation count rises or when session conditions change. Harder topics, rushed pace, fatigue, and poor structure are common causes. A single drop is normal; repeated drops need a training adjustment. You can verify progress by watching whether your hesitation trend improves across comparable sessions in Stats.',
  sections: [
    {
      heading: 'Most likely causes',
      content:
        'Score drops are often behavioral, not random. If transitions became less clear or pace increased beyond comfort, hesitation penalties can climb quickly. This pattern is easiest to confirm when you compare the same mode across multiple sessions instead of relying on one attempt.',
      bullets: [
        'Speaking too fast',
        'Complex topic without structure',
        'Low energy or stress',
        'Switching to harder mode too early',
      ],
    },
    {
      heading: 'How to diagnose quickly',
      content:
        'Check Stats for hesitation count, mode, and duration. Compare the dropped session with your previous three sessions in the same mode to isolate what changed. In practice, the fastest gains come from one clear adjustment, then immediate retesting in your next speaking session.',
      bullets: [
        'Same mode?',
        'Same session length?',
        'Higher hesitation count?',
      ],
    },
    {
      heading: 'How to recover',
      content:
        'Return to a manageable pace for two sessions, then ramp difficulty gradually. Recovery is faster when you focus on rhythm first, not score pressure. Use the Stats page to validate whether the change helped by checking hesitation count together with session duration.',
    },
  ],
  takeaway: 'After a score drop, run two stabilization sessions in the same mode before increasing difficulty again.',
};
