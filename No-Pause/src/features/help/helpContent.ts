export type ScoreExampleCard = {
  label: string;
  flowScore: number;
  speakingTime: string;
  pauseCount: number;
};

export type HelpSection =
  | { type: 'text'; content: string }
  | { type: 'callout'; content: { label: string; value: string }[] }
  | { type: 'score-example'; content: ScoreExampleCard[] }
  | { type: 'pause-visual'; content: { caption?: string } }
  | { type: 'tip'; content: string };

export type HelpArticle = {
  slug: string;
  icon: string;
  title: string;
  summary: string;
  sections: HelpSection[];
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'how-a-session-works',
    icon: '🎙️',
    title: 'How a Session Works',
    summary: 'Pick a topic, speak, and get your score — here\'s what happens at each step.',
    sections: [
      {
        type: 'text',
        content:
          'A session is short and simple. You start by choosing a prompt from the topic list, or you can speak freely about anything on your mind. There is no setup beyond that — pick what feels easiest to get going.',
      },
      {
        type: 'text',
        content:
          'Tap the record button and start talking. Speak naturally, the way you would in a real conversation. You do not need to plan every sentence — the goal is to keep moving, not to be perfect.',
      },
      {
        type: 'text',
        content:
          'When you are done, tap finish. NoPause processes your audio and shows you a results screen with everything that happened during the session.',
      },
      {
        type: 'text',
        content:
          'Your results page has four numbers worth understanding. Flow Score tells you how continuously you spoke — a higher number means fewer long stops broke your momentum. Speaking time is how long your voice was actually active during the session. Silence time is the total of the gaps between words. Pause count is how many times you stopped for longer than a natural breath.',
      },
      {
        type: 'tip',
        content:
          'The goal is to keep improving across many sessions, not to land a perfect score in any single one.',
      },
    ],
  },
  {
    slug: 'understanding-flow-score',
    icon: '📈',
    title: 'Understanding Your Flow Score',
    summary: 'The longer you speak without long stops, the higher your score.',
    sections: [
      {
        type: 'text',
        content:
          'Flow Score is a single number that captures how smoothly your session moved. The more time you spend actually speaking, the higher it climbs. The more long stops you have, the lower it ends up.',
      },
      {
        type: 'text',
        content:
          'You can think of it this way — every second you spend speaking adds to your score, and every long pause subtracts from it. Short, natural breaths between words do not count against you. Only the longer stops do.',
      },
      {
        type: 'score-example',
        content: [
          {
            label: 'A confident session',
            flowScore: 186,
            speakingTime: '2:06',
            pauseCount: 2,
          },
          {
            label: 'A hesitant session',
            flowScore: 42,
            speakingTime: '1:32',
            pauseCount: 9,
          },
        ],
      },
      {
        type: 'text',
        content:
          'Notice how the confident session has a much higher Flow Score even though the speaking time is only a little longer. The difference is in the pause count — fewer interruptions means more momentum.',
      },
      {
        type: 'tip',
        content:
          'Use Flow Score as a trend over many sessions, not as a grade on any one session. A rising line over a few weeks matters more than a single high number.',
      },
    ],
  },
  {
    slug: 'what-counts-as-a-pause',
    icon: '⏸️',
    title: 'What Counts as a Pause',
    summary: 'Small natural gaps are fine — only longer stops affect your score.',
    sections: [
      {
        type: 'text',
        content:
          'NoPause is designed to ignore the tiny gaps that happen in normal speech. The little breath between words, the half-beat before a new sentence — none of those count against you.',
      },
      {
        type: 'text',
        content:
          'Only longer stops register as pauses. These are the moments when you lose your train of thought, get stuck searching for a word, or trail off without finishing the sentence. Those are the ones that affect your score.',
      },
      {
        type: 'pause-visual',
        content: {
          caption:
            'A typical session — short gaps are normal, long stops are the ones that count.',
        },
      },
      {
        type: 'text',
        content:
          'Short stumbles between words also do not hurt your score. If you say something twice, restart a sentence, or trip over a phrase, that is normal speech — not a pause.',
      },
      {
        type: 'tip',
        content:
          'Do not try to eliminate every pause. Just work on avoiding the long, unplanned ones that break your momentum.',
      },
    ],
  },
  {
    slug: 'how-to-improve',
    icon: '🚀',
    title: 'How to Improve Your Flow Score',
    summary: 'Consistent short sessions beat occasional long ones.',
    sections: [
      {
        type: 'text',
        content:
          'The biggest gains come from one habit — keep talking through imperfect sentences instead of stopping to self-correct. Self-correction feels productive in the moment, but it is the main thing that breaks your flow.',
      },
      {
        type: 'text',
        content:
          'When you are not sure what to say, use a prompt. Prompts give your brain a starting point so you do not waste the first ten seconds searching for an opening idea.',
      },
      {
        type: 'text',
        content:
          'Short sessions practiced regularly build fluency faster than one long session every few days. Five minutes a day for a week beats thirty minutes once a week.',
      },
      {
        type: 'text',
        content:
          'After each session, review your pause count and silence time alongside the score. Those two numbers tell you where the friction was, while the score alone only tells you the final result.',
      },
      {
        type: 'tip',
        content:
          'Pick a prompt that feels slightly uncomfortable — that is where the growth happens. Easy prompts feel good but build slowly.',
      },
    ],
  },
  {
    slug: 'streaks-and-progress',
    icon: '🔥',
    title: 'Streaks & Progress',
    summary: 'Daily practice compounds — your streak keeps the habit visible.',
    sections: [
      {
        type: 'text',
        content:
          'Your streak counts the days in a row you practiced. Complete at least one session a day to keep it alive. Miss a day and the streak resets — that is the point, since it keeps the habit visible.',
      },
      {
        type: 'text',
        content:
          'The dashboard shows your recent session history so you can see the pattern over time. Over a few weeks, look for a trend toward higher Flow Scores and lower pause counts rather than judging any individual session.',
      },
      {
        type: 'text',
        content:
          'Progress in speaking fluency is almost never linear. Some days will be worse than the day before — that is normal. What matters is the direction over many sessions, not the bounce between any two.',
      },
      {
        type: 'tip',
        content:
          'A short 60-second session still counts toward your streak. Consistency matters more than duration.',
      },
    ],
  },
  {
    slug: 'telegram-practice',
    icon: '💬',
    title: 'Telegram Practice',
    summary: 'Send a voice note from Telegram and get your score without opening the app.',
    sections: [
      {
        type: 'text',
        content:
          'You can practice from Telegram by connecting your account once from the settings page. After that, the NoPause bot is ready whenever you want a quick session.',
      },
      {
        type: 'text',
        content:
          'To run a session, just send any voice note to the bot. NoPause processes the audio and replies with a scored result — the same Flow Score, speaking time, and pause count you get from a web session.',
      },
      {
        type: 'text',
        content:
          'Your Telegram sessions show up in your history alongside your web sessions. There is no separate tab or feed — everything lands in the same place.',
      },
      {
        type: 'text',
        content:
          'You can also run challenges through Telegram. You and a friend get the same prompt, speak separately, and then see each other\'s scores. It is a low-pressure way to practice with someone else.',
      },
      {
        type: 'tip',
        content:
          'Use Telegram sessions for quick practice when you are away from your desk. They keep your streak going without needing the full app.',
      },
    ],
  },
  {
    slug: 'privacy-and-data',
    icon: '🔒',
    title: 'Privacy & Data',
    summary: 'Your mic is only active while you\'re recording.',
    sections: [
      {
        type: 'text',
        content:
          'Your microphone is used only while a session is in progress. NoPause does not listen in the background, does not run between sessions, and does not access the mic outside of recording.',
      },
      {
        type: 'text',
        content:
          'Your transcripts and scores are saved to your account so you can review your history any time. That way you can look back at past sessions, compare results, and see how you are improving.',
      },
      {
        type: 'text',
        content:
          'If you connect Telegram, your bot account is linked to your NoPause account so those sessions appear together. The link is one-time and you can disconnect it from settings whenever you want.',
      },
      {
        type: 'tip',
        content:
          'You can review your full session history any time from the Stats page.',
      },
    ],
  },
];

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}
