const opinionPrompts = [
  "Should schools teach public speaking as a core skill?",
  "Is remote work better for creativity or focus?",
  "Should people read more books or listen to more podcasts?",
  "Is confidence something you build or something you choose?",
  "Should social media platforms hide public like counts?",
  "Is it better to be highly specialized or broadly skilled?",
  "Should cities prioritize walking and cycling over cars?",
  "Is failure overrated as a teacher?",
  "Should AI tools be allowed in classrooms?",
  "Is a busy schedule a sign of ambition or poor boundaries?",
  "Should everyone learn how to tell a good story?",
  "Is it better to plan your life carefully or leave room for surprise?",
  "Should companies shorten meetings by default?",
  "Is silence in conversation awkward or useful?",
  "Should people practice disagreeing more respectfully?",
  "Is curiosity more important than discipline?",
  "Should public speaking be judged more on clarity or charisma?",
  "Is it better to speak slowly and precisely or quickly and energetically?",
  "Should adults keep learning new hobbies even when they are busy?",
  "Is confidence built more through preparation or repeated exposure?",
];

export function getRandomPrompt(excludeLast?: string): string {
  if (opinionPrompts.length <= 1) {
    return opinionPrompts[0] ?? "Talk about something you care about.";
  }

  let prompt = opinionPrompts[Math.floor(Math.random() * opinionPrompts.length)];
  while (prompt === excludeLast) {
    prompt = opinionPrompts[Math.floor(Math.random() * opinionPrompts.length)];
  }

  return prompt;
}
