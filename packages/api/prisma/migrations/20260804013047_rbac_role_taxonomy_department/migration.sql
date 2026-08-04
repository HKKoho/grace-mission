-- CreateEnum
CREATE TYPE "Department" AS ENUM ('all', 'program_coordination', 'donor_engagement', 'monitoring_evaluation', 'communications', 'field_operations', 'pastoral_care', 'finance', 'outreach', 'scripture_literacy');

-- AlterEnum
-- UserRole is being replaced wholesale (admin/developer/viewer -> the 7-role church
-- taxonomy). A bare text cast can't map old values into the new enum, so this remaps
-- them explicitly via a CASE expression instead of the default `::text::"UserRole_new"`
-- cast, preserving each existing user's effective access level under the new names:
--   admin -> super_admin, developer -> admin_staff, viewer -> guest.
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('super_admin', 'senior_pastor', 'pastor', 'admin_staff', 'ministry_leader', 'volunteer', 'guest');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'admin' THEN 'super_admin'
    WHEN 'developer' THEN 'admin_staff'
    WHEN 'viewer' THEN 'guest'
    ELSE "role"::text
  END::"UserRole_new"
);
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'guest';
COMMIT;

-- AlterTable
-- department defaults to 'all' for every existing user, so nobody loses workspace
-- folder visibility on migration day — department scoping only takes effect once an
-- admin deliberately narrows a specific user away from 'all'.
ALTER TABLE "User" ADD COLUMN     "department" "Department" NOT NULL DEFAULT 'all';
