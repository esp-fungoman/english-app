-- Delete anonymous stub students (no credentials) before requiring username/password
DELETE FROM "attempts" WHERE "session_id" IN (
  SELECT "id" FROM "practice_sessions" WHERE "student_id" IN (SELECT "id" FROM "students")
);
DELETE FROM "practice_sessions" WHERE "student_id" IN (SELECT "id" FROM "students");
DELETE FROM "students";

-- AlterTable
ALTER TABLE "students" ADD COLUMN "username" TEXT;
ALTER TABLE "students" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "students" ADD COLUMN "email" TEXT;
ALTER TABLE "students" ADD COLUMN "phone" TEXT;

-- Make grade_id nullable for post-register onboarding
ALTER TABLE "students" ALTER COLUMN "grade_id" DROP NOT NULL;

-- Backfill not needed (table cleared); enforce NOT NULL on credentials
ALTER TABLE "students" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "students" ALTER COLUMN "password_hash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "students_username_key" ON "students"("username");
CREATE UNIQUE INDEX "students_email_key" ON "students"("email");
CREATE UNIQUE INDEX "students_phone_key" ON "students"("phone");
