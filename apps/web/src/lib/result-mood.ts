export type ResultMood = 'great' | 'good' | 'tryAgain';

export function getResultMood(correct: number, total: number): ResultMood {
  if (total <= 0) return 'tryAgain';
  const ratio = correct / total;
  if (ratio >= 0.8) return 'great';
  if (ratio >= 0.5) return 'good';
  return 'tryAgain';
}
