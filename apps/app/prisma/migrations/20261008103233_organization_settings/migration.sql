-- CreateEnum
CREATE TYPE "Country" AS ENUM ('GH', 'LR');

-- CreateEnum
CREATE TYPE "ResponseLanguage" AS ENUM ('MATCH', 'EN', 'FR', 'PT');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "country" "Country" NOT NULL DEFAULT 'GH',
ADD COLUMN     "detect_document_language" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "members_can_upload" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "require_citations" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "response_language" "ResponseLanguage" NOT NULL DEFAULT 'MATCH';
