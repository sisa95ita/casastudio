CREATE TYPE "RoomBoundaryKind" AS ENUM ('WALL', 'FREE');

ALTER TABLE "RoomBoundaryEdge"
  ADD COLUMN "kind" "RoomBoundaryKind" NOT NULL DEFAULT 'WALL',
  ADD COLUMN "startX" DOUBLE PRECISION,
  ADD COLUMN "startZ" DOUBLE PRECISION,
  ADD COLUMN "endX" DOUBLE PRECISION,
  ADD COLUMN "endZ" DOUBLE PRECISION,
  ALTER COLUMN "wallId" DROP NOT NULL,
  ALTER COLUMN "direction" DROP NOT NULL;

ALTER TABLE "RoomBoundaryEdge"
  ADD CONSTRAINT "RoomBoundaryEdge_source_check" CHECK (
    ("kind" = 'WALL' AND "wallId" IS NOT NULL AND "direction" IS NOT NULL
      AND "startX" IS NULL AND "startZ" IS NULL AND "endX" IS NULL AND "endZ" IS NULL)
    OR
    ("kind" = 'FREE' AND "wallId" IS NULL AND "direction" IS NULL
      AND "startX" IS NOT NULL AND "startZ" IS NOT NULL AND "endX" IS NOT NULL AND "endZ" IS NOT NULL
      AND ("startX" <> "endX" OR "startZ" <> "endZ"))
  );
