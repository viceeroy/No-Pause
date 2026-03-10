export const readingSentences = [
  "The morning sun cast long shadows across the quiet street.",
  "Technology has changed the way we communicate with each other.",
  "A good book can take you to places you have never been before.",
  "The smell of fresh coffee filled the entire room.",
  "She walked slowly through the forest listening to the birds.",
  "A sudden breeze rustled the leaves on the old oak tree.",
  "Learning a new language opens doors to different cultures.",
  "The train arrived exactly on time despite the heavy rain.",
  "He wrote a short note and left it on the kitchen table.",
  "The city lights shimmered on the river at night.",
  "Practice makes progress, even when results feel slow.",
  "A clear plan turns a difficult task into small steps.",
  "The museum’s quiet halls echoed with soft footsteps.",
  "She saved the last piece of cake for her friend.",
  "The market was busy with voices and colorful stalls.",
  "Fresh air and sunlight can change your entire mood.",
  "He paused to tie his shoe before crossing the street.",
  "A thoughtful question can start a meaningful conversation.",
  "The bell rang, and the classroom fell silent.",
  "They watched the waves roll in and out of the shore.",
];

export const shuffleSentences = (input: string[]) => {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};
