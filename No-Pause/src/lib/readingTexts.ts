export type VoiceActingPassage = {
  id: string;
  category: 'Motivational speeches' | 'Movie monologue style' | 'Storytelling passages' | 'Famous quotes expanded';
  text: string;
};

export const voiceActingPassages: VoiceActingPassage[] = [
  {
    id: 'motivation-stand-up',
    category: 'Motivational speeches',
    text:
      'Stand up, not because it is easy, but because you are done shrinking. The room does not need another whisper; it needs your full voice. Every doubt you carried in is a weight you can drop right now. Take the breath, lift your chin, and let the courage hit the walls.',
  },
  {
    id: 'motivation-spark',
    category: 'Motivational speeches',
    text:
      'This is the moment you decide who you are when it matters. Not later, not when the lights feel kinder, but now. Your effort is a signal, and the world is listening for it. Speak like a spark and watch the room ignite.',
  },
  {
    id: 'motivation-storm',
    category: 'Motivational speeches',
    text:
      'You have walked through the storm, and it did not break you. It carved you into something sharper, something ready. Let your voice be the thunder that proves you are still standing. We are not waiting for permission; we are taking the next step.',
  },
  {
    id: 'monologue-clock',
    category: 'Movie monologue style',
    text:
      'The clock stares at me like it knows my secrets, ticking louder the longer I pretend I am fine. I smile, I nod, and the mask holds—until it doesn’t. There is a crack in it tonight, a bright, dangerous crack. If I speak, everything changes.',
  },
  {
    id: 'monologue-echo',
    category: 'Movie monologue style',
    text:
      'I keep hearing my name like an echo down an empty hallway. It sounds familiar and foreign at the same time. I thought I could outrun the past, but it has a better memory than I do. Maybe the truth isn’t chasing me—maybe it’s waiting for me to turn around.',
  },
  {
    id: 'monologue-fog',
    category: 'Movie monologue style',
    text:
      'The city is wrapped in fog, and it feels like my thoughts are too. I can see the outline of the decision, but not its shape. My hands are steady, my voice is not. One word from me could open the door, or lock it forever.',
  },
  {
    id: 'story-forest',
    category: 'Storytelling passages',
    text:
      'The forest was quiet in the way a stage is quiet before the curtain rises. Every leaf seemed to hold its breath, every shadow leaning closer. She stepped forward and the path appeared, narrow and glowing like a thread. Behind her, something old and unseen began to move.',
  },
  {
    id: 'story-train',
    category: 'Storytelling passages',
    text:
      'The train arrived without a sound, as if it was afraid of being noticed. Its doors opened and a warm light spilled onto the empty platform. He hesitated, feeling the moment stretch like a wire. Then he stepped in, and the door closed on the life he knew.',
  },
  {
    id: 'story-attic',
    category: 'Storytelling passages',
    text:
      'In the attic, dust floated like slow snow beneath the single bulb. The box was smaller than she remembered, but heavier. She lifted the lid and a cold, metallic scent rose up. The letter inside was addressed to her in handwriting she had never seen.',
  },
  {
    id: 'quote-courage',
    category: 'Famous quotes expanded',
    text:
      'They say, “Fortune favors the bold,” but boldness is not loud—it is decisive. It is the quiet step forward when you could step back. It is the breath you take before you speak your truth. Today, be the kind of bold that fortune can find.',
  },
  {
    id: 'quote-fear',
    category: 'Famous quotes expanded',
    text:
      '“The only thing we have to fear is fear itself,” and still it crouches at the edge of the room. It whispers, it watches, it waits for you to look away. But fear is only strong when you make it a storyteller. Take its script, and rewrite the ending.',
  },
  {
    id: 'quote-journey',
    category: 'Famous quotes expanded',
    text:
      '“The journey of a thousand miles begins with a single step,” but that step is never small inside your chest. It is a decision, a shift, a promise to move. Make it with intention. Then take another, and another, until the road knows your name.',
  },
];

export const shufflePassages = (input: VoiceActingPassage[]) => {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};
