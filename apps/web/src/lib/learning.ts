export type WordbookWord = {
  id: string;
  lemma: string;
  meaningVi: string | null;
  partOfSpeech: string | null;
  imageKey: string | null;
  categories: string[];
  practiced: boolean;
  needsReview: boolean;
};

export type WordbookUnit = {
  id: string;
  title: string;
  sortOrder: number;
  words: WordbookWord[];
};

export type WordbookData = {
  reviewAvailable: boolean;
  units: WordbookUnit[];
};

export type ReviewQuestion = {
  id: string;
  meaningVi: string;
  choices: { id: string; lemma: string }[];
  selectedWordId: string | null;
  correct: boolean | null;
  correctWordId: string | null;
};

export type ReviewSession = {
  id: string;
  gradeId: string;
  startedAt: string;
  endedAt: string | null;
  activeMs: number;
  questions: ReviewQuestion[];
};

export function reviewSessionKey(studentId: string, gradeId: string) {
  return `review-session:${studentId}:${gradeId}`;
}
