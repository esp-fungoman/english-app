CREATE TYPE "group_mode" AS ENUM ('single', 'board');

ALTER TABLE "units"
ADD COLUMN "group_mode" "group_mode" NOT NULL DEFAULT 'single';
