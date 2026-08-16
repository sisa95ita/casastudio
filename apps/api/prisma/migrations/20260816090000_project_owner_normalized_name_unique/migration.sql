ALTER TABLE "Project" ADD COLUMN "normalizedName" TEXT;

UPDATE "Project"
SET "normalizedName" = lower(btrim("name"));

ALTER TABLE "Project" ALTER COLUMN "normalizedName" SET NOT NULL;

CREATE UNIQUE INDEX "Project_ownerSubject_normalizedName_key"
ON "Project"("ownerSubject", "normalizedName");
