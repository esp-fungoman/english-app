ALTER TABLE "words" ADD COLUMN "meaning_vi" TEXT;

CREATE TABLE "review_sessions" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "grade_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "active_ms" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "review_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "review_questions" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "word_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "choice_ids" JSONB NOT NULL,
  "selected_word_id" TEXT,
  "correct" BOOLEAN,
  CONSTRAINT "review_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_sessions_student_id_grade_id_started_at_idx" ON "review_sessions"("student_id", "grade_id", "started_at");
CREATE UNIQUE INDEX "review_questions_session_id_sort_order_key" ON "review_questions"("session_id", "sort_order");

ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_sessions" ADD CONSTRAINT "review_sessions_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_questions" ADD CONSTRAINT "review_questions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "review_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_questions" ADD CONSTRAINT "review_questions_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;
