-- AlterForeignKey cascades for CMS delete

ALTER TABLE "units" DROP CONSTRAINT "units_grade_id_fkey";
ALTER TABLE "units" ADD CONSTRAINT "units_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "words" DROP CONSTRAINT "words_unit_id_fkey";
ALTER TABLE "words" ADD CONSTRAINT "words_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "students" DROP CONSTRAINT "students_grade_id_fkey";
ALTER TABLE "students" ADD CONSTRAINT "students_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "practice_sessions" DROP CONSTRAINT "practice_sessions_student_id_fkey";
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "practice_sessions" DROP CONSTRAINT "practice_sessions_unit_id_fkey";
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attempts" DROP CONSTRAINT "attempts_word_id_fkey";
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "word_categories" DROP CONSTRAINT "word_categories_category_id_fkey";
ALTER TABLE "word_categories" ADD CONSTRAINT "word_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
