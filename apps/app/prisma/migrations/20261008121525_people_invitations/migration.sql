-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "invitation_groups" (
    "organization_id" UUID NOT NULL,
    "invitation_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,

    CONSTRAINT "invitation_groups_pkey" PRIMARY KEY ("invitation_id","group_id")
);

-- CreateIndex
CREATE INDEX "invitation_groups_group_id_idx" ON "invitation_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_organization_id_id_key" ON "organization_invitations"("organization_id", "id");

-- CreateIndex
CREATE INDEX "profiles_email_idx" ON "profiles"("email");

-- AddForeignKey
ALTER TABLE "invitation_groups" ADD CONSTRAINT "invitation_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_groups" ADD CONSTRAINT "invitation_groups_organization_id_invitation_id_fkey" FOREIGN KEY ("organization_id", "invitation_id") REFERENCES "organization_invitations"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_groups" ADD CONSTRAINT "invitation_groups_organization_id_group_id_fkey" FOREIGN KEY ("organization_id", "group_id") REFERENCES "groups"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

