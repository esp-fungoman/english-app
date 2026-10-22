export type Activity = 'group' | 'odd_letter' | 'scramble' | 'listen_spell';

export const GAME_DETAILS: Record<
  Activity,
  { label: string; instruction: string }
> = {
  group: { label: 'Ghép từ theo nhóm', instruction: 'Từ này thuộc nhóm nào?' },
  odd_letter: {
    label: 'Tìm chữ cái thừa',
    instruction: 'Chữ nào không thuộc từ này?',
  },
  scramble: {
    label: 'Sắp xếp chữ cái',
    instruction: 'Nghe rồi xếp các chữ thành từ.',
  },
  listen_spell: {
    label: 'Nghe và chọn chữ cái',
    instruction: 'Nghe thật kỹ rồi điền từ nhé.',
  },
};

export function letterChoices(
  activity: Activity,
  prompt: Record<string, unknown>,
) {
  const isScramble = activity === 'scramble';
  return {
    bank: isScramble
      ? 'abcdefghijklmnopqrstuvwxyz'.split('')
      : ((prompt.bank as string[]) ?? []),
    slots: isScramble
      ? ((prompt.letters as string[]) ?? []).length
      : Number(prompt.blanks ?? 0),
  };
}

export type Correction = {
  categoryId?: string;
  label?: string;
  letterIndex?: number;
  letter?: string;
  word?: string;
};

export type GameItem = {
  attemptId: string;
  wordId: string;
  sortOrder: number;
  correct: boolean | null;
  correction: Correction | null;
  selectedCategoryId: string | null;
  imageKey: string | null;
  prompt: Record<string, unknown>;
};

export type GameSession = {
  id: string;
  unitId: string;
  activityType: Activity;
  groupMode: 'single' | 'board';
  boardGroups: { id: string; titleVi: string }[] | null;
  endedAt: string | null;
  activeMs: number;
  items: GameItem[];
};

export type AnswerResult = {
  id: string;
  correct: boolean;
  correction: Correction;
};

export function sessionKey(
  studentId: string,
  unitId: string,
  activity: Activity,
) {
  return `english-game:${studentId}:${unitId}:${activity}`;
}

function gameTipKey(studentId: string, activity: Activity) {
  return `english-tip-dismissed:${studentId}:${activity}`;
}

export function isGameTipDismissed(studentId: string, activity: Activity) {
  if (!studentId || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(gameTipKey(studentId, activity)) === '1';
  } catch {
    return false;
  }
}

export function setGameTipDismissed(
  studentId: string,
  activity: Activity,
  dismissed: boolean,
) {
  if (!studentId || typeof window === 'undefined') return;
  try {
    const key = gameTipKey(studentId, activity);
    if (dismissed) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch {
    // Tips remain usable when the browser cannot save preferences.
  }
}
