import { ActivityType } from '@prisma/client';

export function publicPrompt(
  activity: ActivityType,
  prompt: Record<string, unknown>,
): Record<string, unknown> {
  if (activity === ActivityType.group) {
    return { lemma: prompt.lemma, choices: prompt.choices };
  }
  if (activity === ActivityType.odd_letter) {
    return { lemma: prompt.lemma, letters: prompt.letters };
  }
  if (activity === ActivityType.scramble) {
    return {
      letters: prompt.letters,
      wordLengths: prompt.wordLengths,
      speechText: prompt.lemma,
    };
  }
  return {
    blanks: prompt.blanks,
    wordLengths: prompt.wordLengths,
    bank: prompt.bank,
    speechText: prompt.lemma,
  };
}
