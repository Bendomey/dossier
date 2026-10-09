-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'briefcase';


ALTER TABLE "collections" ADD CONSTRAINT "collections_icon_check"
  CHECK ("icon" IN ('scale', 'people', 'building', 'briefcase'));
