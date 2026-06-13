export type ScoreExampleCard = {
  label: string;
  flowScore: number;
  speakingTime: string;
  silenceSec: number;
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
          'A session is short and simple. You start by choosing a prompt from the topic list — categories like Argue, Opinion, or Story — or you can speak freely about anything on your mind. There is no setup beyond that.',
      },
      {
        type: 'text',
        content:
          'Tap the record button and start talking. Speak naturally, the way you would in a real conversation. You do not need to plan every sentence — the goal is to keep moving, not to be perfect.',
      },
      {
        type: 'pause-visual',
        content: {
          caption:
            'Your voice as a timeline — green bars are speaking, gaps are silence. NoPause tracks this the whole time you record.',
        },
      },
      {
        type: 'text',
        content:
          'When you are done, tap finish. NoPause sends your audio through transcription, scores it, and shows you a results screen in a few seconds.',
      },
      {
        type: 'text',
        content:
          'Your results page has three numbers worth understanding. Flow Score captures how continuously you spoke — higher means less dead air broke your momentum. Speaking time is how long your voice was actually active. Silence is the total time your voice went quiet during the session — the gaps add up and pull the score down.',
      },
      {
        type: 'score-example',
        content: [
          {
            label: 'A typical first session',
            flowScore: 65,
            speakingTime: '1:15',
            silenceSec: 50,
          },
          {
            label: 'After a week of practice',
            flowScore: 130,
            speakingTime: '1:50',
            silenceSec: 20,
          },
        ],
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
    summary: 'The longer you speak with less dead air, the higher your score.',
    sections: [
      {
        type: 'text',
        content:
          'Flow Score is a single number that captures how smoothly your session moved. The more time you spend actually speaking, the higher it climbs. The more silence piles up between your words, the lower it ends up.',
      },
      {
        type: 'callout',
        content: [
          { label: 'Speaking more than pausing', value: 'Raises your score' },
          { label: 'Longer speaking time', value: 'Bonus points' },
          { label: 'Silence during the session', value: 'Lowers your score' },
          { label: 'Minimum score', value: '0' },
        ],
      },
      {
        type: 'text',
        content:
          'You can think of it this way — the more of your session is real speaking rather than silence, the higher the base score climbs, and speaking for longer adds a bonus on top. Long quiet stretches drag it down because they break that continuity. Short, natural breaths between words barely register — it is the longer quiet stretches that add up against you.',
      },
      {
        type: 'text',
        content:
          'There is also a bonus on top. When you record against a topic prompt, you can request AI feedback on what you said — and a strong, well-developed answer adds extra points to your Flow Score. Speaking smoothly gets you the base score; speaking with substance pushes it higher.',
      },
      {
        type: 'score-example',
        content: [
          {
            label: 'A confident session',
            flowScore: 186,
            speakingTime: '2:06',
            silenceSec: 20,
          },
          {
            label: 'A hesitant session',
            flowScore: 42,
            speakingTime: '1:32',
            silenceSec: 90,
          },
        ],
      },
      {
        type: 'text',
        content:
          'Notice how the confident session has a much higher Flow Score even though the speaking time is only a little longer. The difference is the silence — far less dead air means a much higher share of the session was real speaking, and the longer duration earns a bigger bonus on top.',
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
    title: 'What Counts as Silence',
    summary: 'Small natural gaps barely matter — it is the longer quiet stretches that add up.',
    sections: [
      {
        type: 'text',
        content:
          'NoPause measures the silence in your session — the time your voice is not active. The tiny gaps that happen in normal speech, like the breath between words or the half-beat before a new sentence, are so short they barely move your score.',
      },
      {
        type: 'callout',
        content: [
          { label: 'Natural breath between words', value: 'Barely counts' },
          { label: 'Filled sound (um, uh)', value: 'Counts as speaking' },
          { label: 'Long quiet stretch', value: 'Adds up against you' },
          { label: 'What lowers your score', value: 'Total silence' },
        ],
      },
      {
        type: 'text',
        content:
          'The longer you go quiet, the more it adds up. These are the moments when you lose your train of thought, get stuck searching for a word, or trail off without finishing the sentence. The total time spent silent is what pulls your score down — a few short gaps cost almost nothing, but long freezes add up fast.',
      },
      {
        type: 'pause-visual',
        content: {
          caption:
            'The green bars are speaking. The white gaps between them are silence — short ones cost almost nothing, long ones add up against your score.',
        },
      },
      {
        type: 'text',
        content:
          'Short stumbles between words do not hurt your score. If you say something twice, restart a sentence, or trip over a phrase while still making sound, that is counted as speaking — not silence.',
      },
      {
        type: 'tip',
        content:
          'Do not try to eliminate every gap. Just work on cutting the long, quiet stretches that break your momentum.',
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
          'The biggest gains come from one habit — keep talking through imperfect sentences instead of stopping to self-correct. Self-correction feels productive in the moment, but it is the main thing that breaks your flow. Finish the thought, then move on.',
      },
      {
        type: 'score-example',
        content: [
          {
            label: 'A hesitant first session',
            flowScore: 20,
            speakingTime: '1:00',
            silenceSec: 80,
          },
          {
            label: 'Two weeks later',
            flowScore: 115,
            speakingTime: '1:45',
            silenceSec: 30,
          },
        ],
      },
      {
        type: 'text',
        content:
          'When you are not sure what to say, use a prompt. Prompts give your brain a starting point so you do not waste the first ten seconds searching for an opening idea. The Argue and Opinion categories are especially good for this — they force you to take a position immediately.',
      },
      {
        type: 'text',
        content:
          'Short sessions practiced regularly build fluency faster than one long session every few days. Five minutes a day for a week beats thirty minutes once a week.',
      },
      {
        type: 'text',
        content:
          'After each session, look at your silence alongside the score. The score tells you the final result — the silence tells you where the friction was. If your score dropped but your speaking time held steady, you spent more time quiet, not less time talking.',
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
          'Your streak counts the days in a row you practiced. Complete at least one session a day to keep it alive. Miss a day and the streak resets — that is the point, since it keeps the habit visible and makes skipping feel costly.',
      },
      {
        type: 'callout',
        content: [
          { label: 'Sessions needed per day', value: '1' },
          { label: 'Streak resets when', value: 'You miss a day' },
          { label: 'What to watch', value: 'Trend, not peaks' },
          { label: 'Minimum speaking time', value: '5 seconds' },
        ],
      },
      {
        type: 'text',
        content:
          'The dashboard shows your recent session history so you can see the pattern over time. Over a few weeks, look for a trend toward higher Flow Scores and less silence rather than judging any individual session. One bad day surrounded by good ones is noise — a week of declining scores is a signal.',
      },
      {
        type: 'text',
        content:
          'Progress in speaking fluency is almost never linear. Some days will be worse than the day before — that is normal. What matters is the direction over many sessions, not the bounce between any two.',
      },
      {
        type: 'tip',
        content:
          'A short session still counts toward your streak as long as you speak for at least 5 seconds. Consistency matters more than duration.',
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
          'You can practice from Telegram by connecting your account once. Open the NoPause bot (@NoPauseAI_bot), send /start, and follow the link it gives you to sign in and link your account. After that, the bot is ready whenever you want a quick session — no need to open the app.',
      },
      {
        type: 'callout',
        content: [
          { label: 'Start a session', value: 'Send a voice note' },
          { label: 'Get your score', value: 'Automatic reply' },
          { label: 'Join a challenge', value: 'Accept a link from a friend' },
          { label: 'Switch account', value: 'Send /register' },
        ],
      },
      {
        type: 'text',
        content:
          'To run a session, just send any voice note to the bot. NoPause processes the audio and replies with a scored result — the same Flow Score, speaking time, and silence you get from a web session.',
      },
      {
        type: 'text',
        content:
          'Your Telegram sessions show up in your history alongside your web sessions. There is no separate tab or feed — everything lands in the same place, and your streak counts Telegram sessions the same as web sessions.',
      },
      {
        type: 'text',
        content:
          'You can also run challenges through Telegram. A friend sends you a deep link with a shared prompt — you both speak separately, then see each other\'s scores. It is a low-pressure way to practice with someone else.',
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
        type: 'callout',
        content: [
          { label: 'Mic access', value: 'Recording only' },
          { label: 'Background listening', value: 'Never' },
          { label: 'Session data saved', value: 'Your account' },
          { label: 'Telegram link', value: 'Optional' },
        ],
      },
      {
        type: 'text',
        content:
          'Your transcripts and scores are saved to your account so you can review your history any time. That way you can look back at past sessions, compare results, and see how you are improving. Nothing is shared or visible to other users.',
      },
      {
        type: 'text',
        content:
          'If you connect Telegram, your bot account is linked to your NoPause account so those sessions appear together. Linking is optional — you only connect if you want to practice from the bot, and you can re-link or switch to a different account at any time by sending /register to the bot.',
      },
      {
        type: 'tip',
        content:
          'You can review your full session history any time from the Stats page.',
      },
    ],
  },
  {
    slug: 'why-speaking-feels-hard',
    icon: '🧠',
    title: 'Why Speaking Feels Hard (And What to Do About It)',
    summary: 'Most people feel nervous speaking out loud — here\'s why, and why practice actually fixes it.',
    sections: [
      {
        type: 'text',
        content:
          'Roughly 3 in 4 people feel some anxiety about speaking in front of others. This is not a personal weakness — it is one of the most common fears in the world, more common than fear of heights or flying. The point is not to feel less alone. It is to understand that this is a solvable problem.',
      },
      {
        type: 'text',
        content:
          'When you speak to someone who matters — a manager, an interviewer, a room full of people — your brain treats it as a social threat. It triggers the same stress response as a physical danger. Your heart rate rises, your thoughts speed up, and your ability to retrieve words smoothly drops. This is why nervousness is the single biggest cause of long pauses and hesitations — not lack of intelligence or knowledge.',
      },
      {
        type: 'callout',
        content: [
          { label: 'People with some speaking fear', value: '3 in 4' },
          { label: 'Career impact', value: 'Real' },
          { label: 'Who seek help', value: 'Very few' },
          { label: 'Fixable with practice', value: 'Yes' },
        ],
      },
      {
        type: 'text',
        content:
          'The good news is that anxiety in speaking responds directly to practice. The more familiar the act of speaking feels, the less your brain flags it as a threat. You do not need to eliminate nervousness — you need to lower the threshold at which it kicks in. That is exactly what repeated short sessions do.',
      },
      {
        type: 'tip',
        content:
          'The goal is not to feel fearless. It is to keep speaking even when you feel nervous. That is what NoPause sessions train.',
      },
    ],
  },
  {
    slug: 'why-practice-works',
    icon: '🔁',
    title: 'Why Repeating Yourself Actually Works',
    summary: 'The science behind why short, consistent sessions beat occasional long ones.',
    sections: [
      {
        type: 'text',
        content:
          'Most people think fluency comes from knowing more words or preparing longer. Research says otherwise — what actually improves speech fluency is repeating the act of speaking with fast feedback. Focused practice with immediate feedback, even brief, is what lets your brain stop repeating the same patterns and start building new ones.',
      },
      {
        type: 'text',
        content:
          'There is a difference between practicing and just doing something repeatedly. Deliberate practice means you speak, get specific feedback on what happened — how long you spoke, how many times you stopped — and adjust next session. Without that feedback loop, you can practice for years and ingrain the same habits. NoPause closes that loop automatically. Every session gives you numbers to react to.',
      },
      {
        type: 'callout',
        content: [
          { label: 'Recall improvement with spaced practice vs cramming', value: '~50% more' },
          { label: 'Anxiety reduced by', value: 'Preparation' },
          { label: 'Best session length', value: 'Short + often' },
          { label: 'Feedback needed', value: 'Every session' },
        ],
      },
      {
        type: 'text',
        content:
          'On spacing: practicing the same topic immediately again improves your speed, while spacing sessions out by days reduces filled pauses and hesitations more. Both matter. That is why NoPause tracks streaks — daily sessions give you the repetition rate where real reduction in hesitation happens, not just speed.',
      },
      {
        type: 'tip',
        content:
          'Five minutes every day beats thirty minutes once a week. Your brain needs repetition across days, not just within one session.',
      },
    ],
  },
  {
    slug: 'before-your-interview-or-presentation',
    icon: '🎯',
    title: 'Getting Ready for a Big Moment',
    summary: 'A practical NoPause warm-up routine for interviews, presentations, or any high-stakes conversation.',
    sections: [
      {
        type: 'text',
        content:
          'Speaking anxiety is highest when the stakes feel high and your mouth has not warmed up. The majority of pre-presentation anxiety comes from feeling under-prepared — not from a fixed personality trait. The fix is simple: get your voice moving before the moment arrives.',
      },
      {
        type: 'text',
        content:
          'A practical routine the day before: open NoPause, pick a prompt from the Argue or Opinion category, and do two sessions back to back. Do not aim for a high score — aim to get comfortable hearing your own voice under mild pressure. Review your silence after each one. The goal is to notice where you go quiet, not to be perfect.',
      },
      {
        type: 'score-example',
        content: [
          {
            label: 'A warm-up session',
            flowScore: 60,
            speakingTime: '1:20',
            silenceSec: 60,
          },
          {
            label: 'After two sessions',
            flowScore: 120,
            speakingTime: '1:50',
            silenceSec: 30,
          },
        ],
      },
      {
        type: 'text',
        content:
          'The morning of: do one short session, 60 to 90 seconds, on any topic. This is not about score — it is about activating your voice and proving to yourself that you can speak clearly before the real moment. Think of it like a musician playing scales before a performance.',
      },
      {
        type: 'tip',
        content:
          'Your voice needs reps before it feels natural. Three NoPause sessions the day before a presentation is worth more than an hour of re-reading your notes.',
      },
    ],
  },
];

export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}
