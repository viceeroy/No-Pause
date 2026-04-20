import type { BlogPost } from './types';

export const whatDoesFlowScoreMeasurePost: BlogPost = {
  title: 'What does Flow Score measure?',
  slug: 'what-does-flow-score-measure',
  date: '2026-03-01',
  description: 'A clear explanation of what Flow Score tracks and what it says about your speaking fluency.',
  readingTime: '1–2 min read',
  shortAnswer:
    'Flow Score measures how consistently you speak in a completed session with minimal hesitation interruptions. It reflects speaking smoothness, not just speed. Higher scores usually mean cleaner delivery and stronger rhythm control. This approach works best when you review the data immediately and apply one correction in the next attempt.',
  sections: [
    {
      heading: 'What signals feed the score',
      content:
        'In No Pause, score behavior is tied to completion rules and hesitation count. The metric is designed to show whether your speech stayed continuous under the mode requirements. Keeping the same session conditions for a few runs gives cleaner feedback and helps you improve more predictably.',
      bullets: [
        'Completed session status',
        'Hesitation count',
        'Penalty after grace hesitations',
      ],
    },
    {
      heading: 'What it does not measure alone',
      content:
        'Flow Score is not a full communication grade. It does not measure content quality or persuasion style. You should read score together with duration and mode context in Stats. The most useful signal is steady improvement, not perfection in a single session, especially when difficulty rises.',
      bullets: [
        'Not a vocabulary test',
        'Not a grammar score',
        'Not only a speed metric',
      ],
    },
    {
      heading: 'How to use it effectively',
      content:
        'Treat Flow Score as a trend line. If score improves while session duration stays healthy, your fluency control is improving in a meaningful way. This pattern is easiest to confirm when you compare the same mode across multiple sessions instead of relying on one attempt.',
    },
  ],
  takeaway: 'Track your average Flow Score by mode each week and improve one mode at a time.',
};
