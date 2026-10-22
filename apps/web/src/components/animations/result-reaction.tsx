'use client';

import type { ResultMood } from '../../lib/result-mood';
import { StudentMascot } from './student-animation';

const messages: Record<ResultMood, string> = {
  great: 'Giỏi quá! 🎉',
  good: 'Làm tốt lắm!',
  tryAgain: 'Không sao, mình thử lại nhé!',
};

export function ResultReaction({
  mood,
  sessionId,
}: {
  mood: ResultMood;
  sessionId: string;
}) {
  return (
    <div className="result-reaction">
      <StudentMascot
        key={sessionId}
        mode="result"
        className="result-reaction-owl"
      />
      <p>{messages[mood]}</p>
    </div>
  );
}
