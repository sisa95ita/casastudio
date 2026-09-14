-- CreateTable
CREATE TABLE "FurnitureItem" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "definitionId" TEXT NOT NULL,
    "pointX" DOUBLE PRECISION NOT NULL,
    "pointZ" DOUBLE PRECISION NOT NULL,
    "rotation" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "depth" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "name" TEXT,
    "description" TEXT,

    CONSTRAINT "FurnitureItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FurnitureItem_projectId_roomId_idx" ON "FurnitureItem"("projectId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "FurnitureItem_projectId_domainId_key" ON "FurnitureItem"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "FurnitureItem_projectId_position_key" ON "FurnitureItem"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Room_projectId_id_key" ON "Room"("projectId", "id");

-- AddForeignKey
ALTER TABLE "FurnitureItem" ADD CONSTRAINT "FurnitureItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FurnitureItem" ADD CONSTRAINT "FurnitureItem_projectId_roomId_fkey" FOREIGN KEY ("projectId", "roomId") REFERENCES "Room"("projectId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Existing normalized Projects gain an empty Furniture collection without changing domain content or revision.
UPDATE "Project" SET "schemaVersion" = '4.0.0' WHERE "schemaVersion" = '3.0.0';

ALTER TABLE "FurnitureItem" ADD CONSTRAINT "FurnitureItem_dimensions_check" CHECK (
  "width" > 0 AND "width" < 'Infinity'::float8 AND
  "depth" > 0 AND "depth" < 'Infinity'::float8 AND
  "height" > 0 AND "height" < 'Infinity'::float8
);
ALTER TABLE "FurnitureItem" ADD CONSTRAINT "FurnitureItem_position_rotation_check" CHECK (
  "position" >= 0 AND
  "pointX" > '-Infinity'::float8 AND "pointX" < 'Infinity'::float8 AND
  "pointZ" > '-Infinity'::float8 AND "pointZ" < 'Infinity'::float8 AND
  "rotation" > '-Infinity'::float8 AND "rotation" < 'Infinity'::float8
);
