ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_parent_id_fkey";

DROP INDEX IF EXISTS "students_email_key";
DROP INDEX IF EXISTS "students_phone_key";

ALTER TABLE "students"
  DROP COLUMN "email",
  DROP COLUMN "phone",
  DROP COLUMN "parent_id",
  ADD COLUMN "school" TEXT,
  ADD COLUMN "class_name" TEXT;

DROP TABLE IF EXISTS "parents";
