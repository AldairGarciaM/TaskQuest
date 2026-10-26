-- Split the display name into first/last name and add a unique username.
-- Existing data is kept: "name" becomes "firstName" and usernames are generated from the email.

ALTER TABLE "User" RENAME COLUMN "name" TO "firstName";

ALTER TABLE "User" ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ALTER COLUMN "lastName" DROP DEFAULT;

ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- e.g. "demo@taskquest.local" -> "demo_x7k2" (local part sanitized, plus the end of the id for uniqueness).
UPDATE "User"
SET "username" =
  LEFT(
    COALESCE(NULLIF(REGEXP_REPLACE(LOWER(SPLIT_PART("email", '@', 1)), '[^a-z0-9_.]', '', 'g'), ''), 'user'),
    15
  ) || '_' || LOWER(RIGHT("id", 4));

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
