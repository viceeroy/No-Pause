import type { BlogPost } from './types';

export const howDoesNoPauseScoreYourSpeakingSessionsPost: BlogPost = {
  title: 'How does No Pause score your speaking sessions?',
  slug: 'how-does-no-pause-score-your-speaking-sessions',
  date: '2026-03-09',
  description: 'A user-friendly guide to Flow Score, speaking time, averages, streaks, and better practice habits.',
  readingTime: '1–2 min read',
  shortAnswer:
    'No Pause gives completed Lemon and Topic sessions a Flow Score from 0 to 100 based on how smoothly you spoke, how often you hesitated, and how much of the session was real speaking. Your average score gives more weight to longer completed sessions, and streaks follow your local calendar day so late-night practice counts when it should.',
  sections: [
    {
      heading: 'What Flow Score means',
      content:
        'Flow Score is a simple 0 to 100 number that shows how smooth and steady your speaking felt during a completed session. Higher scores usually mean you kept talking with fewer interruptions and stronger rhythm. It is not a grade for ideas, vocabulary, or personality. It is a practice signal for fluency.',
      bullets: [
        '0 means the session did not earn a useful score',
        '100 means very smooth speaking',
        'Best used to track progress over time',
      ],
    },
    {
      heading: 'How hesitations change your score',
      content:
        'Hesitations lower your score when they start happening too often during the time you were actually speaking. One or two brief breaks will not ruin a session, but repeated stops make the score fall fast because they break your rhythm. The goal is not to sound robotic. The goal is to keep your message moving.',
      bullets: [
        'Fewer hesitations usually means a higher score',
        'Repeated interruptions pull the score down quickly',
        'Smooth rhythm matters more than speaking fast',
      ],
    },
    {
      heading: 'Why speaking ratio matters',
      content:
        'No Pause also checks how much of the full session was real speaking. If you only speak for a small slice of the session, the app cannot tell much about your flow, so very short speaking time cannot earn a strong score. When you speak for more of the session, you unlock the full score range because the result reflects a fuller sample of your real fluency.',
      bullets: [
        'Too little speaking means the session may not count',
        'Speaking more of the session unlocks higher possible scores',
        'Long quiet gaps make high scores harder to reach',
      ],
    },
    {
      heading: 'How your overall average works',
      content:
        'Your overall average looks at completed scored sessions, not just one lucky run. Longer sessions count more than very short ones because they show your real speaking pattern more clearly. That makes the average harder to game and more useful as a progress marker. In other words, a strong longer session says more than a perfect tiny sample.',
      bullets: [
        'Completed scored sessions shape the average',
        'Longer sessions carry more weight',
        'The average is meant to reflect consistent ability',
      ],
    },
    {
      heading: 'How streaks work',
      content:
        'A streak grows when you practice on consecutive calendar days. No Pause uses your local timezone for that day check, so a late-night session counts for your day, not for some other timezone. That matters if you practice around midnight or travel. Your streak should follow your real routine, not the server clock.',
      bullets: [
        'One practice day keeps the streak alive',
        'Consecutive local days grow the streak',
        'Local timezone prevents late-night streak mistakes',
      ],
    },
    {
      heading: 'Practical ways to improve your score',
      content:
        'The fastest gains usually come from cleaner structure, calmer pace, and more continuous speaking time. Pick one small fix per session, then test it again right away. Improvement is easier to spot when you keep the mode and session length similar for a few runs.',
      bullets: [
        'Start with a simple outline before you speak',
        'Slow down slightly when you feel rushed',
        'Keep talking through ideas instead of stopping to restart',
        'Aim to speak for more of the session, not just for longer sessions',
      ],
    },
  ],
  takeaway: 'To raise your score, focus on fewer hesitations and more continuous speaking in completed sessions.',
};
