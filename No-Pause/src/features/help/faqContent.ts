export type FaqItem = {
  q: string;
  a: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: 'Why is my Flow Score 0?',
    a: 'This usually means your session was under 5 seconds of actual speaking time. NoPause needs at least 5 seconds of detected voice to calculate a score — anything shorter returns 0. It can also happen if your microphone didn\'t pick up your voice properly. Try speaking a little louder or closer to your mic, and check that the right input device is selected in your browser settings.',
  },
  {
    q: 'Why is my transcript wrong or empty?',
    a: 'Transcription is done automatically after each session. On most browsers it uses your device\'s built-in speech recognition, with a fallback to a server-side system when that fails. Accuracy depends on your microphone quality, background noise, and accent. If your transcript is consistently wrong, try recording in a quieter environment or using a headset. Android devices skip the browser speech recognition step entirely and go straight to the server fallback, which is generally more accurate.',
  },
  {
    q: 'My microphone isn\'t working — what do I do?',
    a: 'First, check that your browser has permission to access your microphone. In Chrome, click the lock icon in the address bar and make sure microphone is set to Allow. In Safari, go to Settings → Websites → Microphone. If you have multiple input devices (like a headset and a built-in mic), your browser may be using the wrong one — you can change this in your system sound settings. After updating permissions, refresh the page and try again.',
  },
  {
    q: 'Why did my streak reset?',
    a: 'Streaks require at least one completed session per calendar day. If you miss a day — even by a few minutes past midnight — the streak resets to 0. Telegram sessions count the same as web sessions, so a quick voice note to the bot on a busy day is enough to keep it alive. There\'s no way to restore a broken streak, but your full session history stays saved regardless.',
  },
  {
    q: 'What\'s a good Flow Score?',
    a: 'Most people score between 40 and 80 in their first few sessions. A score of 100 or above means you spoke for a solid amount of time with relatively few long pauses — that\'s real progress. The labels you\'ll see in the app: under 50 is Needs Practice, 50–99 is Getting There, 100–199 is Good Flow, 200–299 is Great Flow, and 300+ is Perfect Flow. Don\'t judge a single session — look at whether your scores are trending upward over a week or two.',
  },
  {
    q: 'Does NoPause save my voice recording?',
    a: 'No. Your audio is processed to produce a transcript and detect pauses, then discarded. NoPause does not store your voice recordings. What gets saved to your account is the transcript text, your Flow Score, speaking time, silence time, and pause count. That\'s everything you see on the results screen — nothing more.',
  },
  {
    q: 'Can I delete a session from my history?',
    a: 'Session deletion isn\'t available in the app right now. Your full history is visible on the Stats page, and every session is saved automatically after it completes. If you have a specific request about your data, reach out via the support channel and we can help manually.',
  },
  {
    q: 'Why is my pause count high even though I spoke for a long time?',
    a: 'Pause count and speaking time are separate measurements. You can speak for 3 minutes and still have a high pause count if you stopped frequently throughout. One thing that surprises people: a single very long silence counts as more than one pause. If you stop for several seconds, NoPause counts multiple pause units from that one gap. So one long freeze mid-sentence can add 2 or 3 to your pause count at once. Check your transcript to find where the long stops happened.',
  },
  {
    q: 'Can I use NoPause without signing up?',
    a: 'No — an account is required. NoPause saves your session history, streak, and progress over time, and all of that is tied to your account. Sign up takes under a minute with Google or email. If you\'d prefer not to create an account, there\'s no guest or trial mode currently.',
  },
  {
    q: 'Does NoPause work on my phone?',
    a: 'Yes. NoPause works in mobile browsers on both iOS and Android. It\'s also installable as a PWA — on iOS, tap the share icon in Safari and choose Add to Home Screen. On Android, your browser will prompt you to install it. The full experience including recording, scoring, and history is available on mobile. Telegram practice is a good option if you prefer not to use the browser on your phone.',
  },
  {
    q: 'How is NoPause different from just recording myself on my phone?',
    a: 'Recording yourself manually gives you a file you have to listen back to yourself — which most people avoid. NoPause automatically measures how long you spoke, how many times you paused, and gives you a score without requiring you to review anything. Over time it builds a history so you can see whether you\'re improving without keeping track yourself. The feedback loop is automatic, which makes it easier to practice consistently.',
  },
  {
    q: 'Can I speak in a language other than English?',
    a: 'Yes. The transcription system supports many languages — it detects the language you\'re speaking automatically. The scoring is based purely on timing and pauses, not on the words themselves, so it works the same regardless of language. The prompts in the app are in English, but you can ignore them and speak in any language you want.',
  },
  {
    q: 'Why does the app keep asking for microphone permission?',
    a: 'This is browser behavior, not NoPause. If you chose Allow Once instead of Allow, your browser will ask again next visit. To fix it permanently: in Chrome, click the lock icon in the address bar on nopause.org, set Microphone to Allow. In Safari, go to Settings → Websites → Microphone and set nopause.org to Allow. After saving, you won\'t be asked again.',
  },
  {
    q: 'What does the AI feedback do?',
    a: 'After a session, you can request AI feedback on your transcript. It reads what you said and gives you a short coaching note — things like where your argument was strong, where you lost structure, or patterns it noticed in how you speak. It\'s optional and generated on demand, not automatically. It appears below your transcript on the results screen. It\'s useful for getting a qualitative read on top of the quantitative score.',
  },
  {
    q: 'How do Telegram challenges work?',
    a: 'A challenge gives you and one or more friends the same speaking prompt. Each person records their answer separately as a voice note to the NoPause bot — no one hears anyone else\'s recording. The bot scores each response and posts the results so everyone can compare Flow Scores. Challenges work in private Telegram chats and in groups. It\'s a way to make practice social without needing to be in the same place or speak at the same time.',
  },
];
