-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('HOUSE', 'APARTMENT', 'VILLA', 'OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('LIVING_ROOM', 'KITCHEN', 'BEDROOM', 'BATHROOM', 'STUDIO', 'CORRIDOR', 'STORAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "OpeningType" AS ENUM ('DOOR', 'WINDOW');

-- CreateEnum
CREATE TYPE "RoomBoundaryDirection" AS ENUM ('FORWARD', 'REVERSE');

-- CreateEnum
CREATE TYPE "ProjectionType" AS ENUM ('PERSPECTIVE', 'ORTHOGRAPHIC');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "domainCreatedAt" TEXT NOT NULL,
    "domainUpdatedAt" TEXT NOT NULL,
    "unitLength" TEXT NOT NULL,
    "unitAngle" TEXT NOT NULL,
    "ownerSubject" TEXT NOT NULL,
    "createdBySubject" TEXT NOT NULL,
    "updatedBySubject" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BuildingType" NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Level" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "buildingId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "elevation" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "levelId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "description" TEXT,
    "elevation" DOUBLE PRECISION,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wall" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "levelId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "startX" DOUBLE PRECISION NOT NULL,
    "startZ" DOUBLE PRECISION NOT NULL,
    "endX" DOUBLE PRECISION NOT NULL,
    "endZ" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "thickness" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Wall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallRoomReference" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "wallId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "WallRoomReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBoundaryEdge" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "wallId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "direction" "RoomBoundaryDirection" NOT NULL,

    CONSTRAINT "RoomBoundaryEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opening" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "wallId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "type" "OpeningType" NOT NULL,
    "offsetFromStart" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "elevation" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Opening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningConnectedRoomReference" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "openingId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "OpeningConnectedRoomReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staircase" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "owningLevelId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "fromLevelId" UUID NOT NULL,
    "toLevelId" UUID NOT NULL,
    "fromRoomId" UUID,
    "toRoomId" UUID,
    "width" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Staircase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StairFlight" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "staircaseId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "startX" DOUBLE PRECISION NOT NULL,
    "startZ" DOUBLE PRECISION NOT NULL,
    "endX" DOUBLE PRECISION NOT NULL,
    "endZ" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "stepCount" INTEGER NOT NULL,
    "startElevation" DOUBLE PRECISION NOT NULL,
    "endElevation" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StairFlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StairLanding" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "staircaseId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "pointX" DOUBLE PRECISION NOT NULL,
    "pointZ" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "depth" DOUBLE PRECISION NOT NULL,
    "elevation" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StairLanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Viewpoint" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "levelId" UUID NOT NULL,
    "roomId" UUID,
    "cameraPositionX" DOUBLE PRECISION NOT NULL,
    "cameraPositionY" DOUBLE PRECISION NOT NULL,
    "cameraPositionZ" DOUBLE PRECISION NOT NULL,
    "cameraTargetX" DOUBLE PRECISION NOT NULL,
    "cameraTargetY" DOUBLE PRECISION NOT NULL,
    "cameraTargetZ" DOUBLE PRECISION NOT NULL,
    "fieldOfView" DOUBLE PRECISION NOT NULL,
    "projection" "ProjectionType" NOT NULL,

    CONSTRAINT "Viewpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseImage" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "viewpointId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "assetRef" TEXT NOT NULL,
    "projectRevision" INTEGER NOT NULL,
    "domainCreatedAt" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "BaseImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignBrief" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "promptText" TEXT NOT NULL,
    "style" TEXT,
    "notes" TEXT,

    CONSTRAINT "DesignBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignBriefConstraint" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "designBriefId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "DesignBriefConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignBriefPaletteEntry" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "designBriefId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "DesignBriefPaletteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignBriefReferenceAsset" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "designBriefId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "assetRef" TEXT NOT NULL,

    CONSTRAINT "DesignBriefReferenceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderRequest" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "viewpointId" UUID NOT NULL,
    "baseImageId" UUID NOT NULL,
    "designBriefId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" "RenderStatus" NOT NULL,
    "requestedProviderId" TEXT,
    "requestedModelId" TEXT,
    "requestedResultCount" INTEGER,
    "domainCreatedAt" TEXT NOT NULL,
    "startedAt" TEXT,
    "completedAt" TEXT,
    "error" TEXT,

    CONSTRAINT "RenderRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderResult" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "renderRequestId" UUID NOT NULL,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "status" "RenderStatus" NOT NULL,
    "domainCreatedAt" TEXT NOT NULL,
    "assetRef" TEXT,
    "providerId" TEXT,
    "modelId" TEXT,
    "notes" TEXT,
    "favorite" BOOLEAN,
    "error" TEXT,
    "width" INTEGER,
    "height" INTEGER,

    CONSTRAINT "RenderResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_domainId_key" ON "Project"("domainId");

-- CreateIndex
CREATE INDEX "Project_ownerSubject_idx" ON "Project"("ownerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "Building_projectId_key" ON "Building"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Building_projectId_domainId_key" ON "Building"("projectId", "domainId");

-- CreateIndex
CREATE INDEX "Level_projectId_idx" ON "Level"("projectId");

-- CreateIndex
CREATE INDEX "Level_buildingId_position_idx" ON "Level"("buildingId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Level_projectId_domainId_key" ON "Level"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "Level_buildingId_position_key" ON "Level"("buildingId", "position");

-- CreateIndex
CREATE INDEX "Room_projectId_idx" ON "Room"("projectId");

-- CreateIndex
CREATE INDEX "Room_levelId_position_idx" ON "Room"("levelId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Room_projectId_domainId_key" ON "Room"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_levelId_position_key" ON "Room"("levelId", "position");

-- CreateIndex
CREATE INDEX "Wall_projectId_idx" ON "Wall"("projectId");

-- CreateIndex
CREATE INDEX "Wall_levelId_position_idx" ON "Wall"("levelId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Wall_projectId_domainId_key" ON "Wall"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "Wall_levelId_position_key" ON "Wall"("levelId", "position");

-- CreateIndex
CREATE INDEX "WallRoomReference_projectId_idx" ON "WallRoomReference"("projectId");

-- CreateIndex
CREATE INDEX "WallRoomReference_roomId_idx" ON "WallRoomReference"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "WallRoomReference_wallId_position_key" ON "WallRoomReference"("wallId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "WallRoomReference_wallId_roomId_key" ON "WallRoomReference"("wallId", "roomId");

-- CreateIndex
CREATE INDEX "RoomBoundaryEdge_projectId_idx" ON "RoomBoundaryEdge"("projectId");

-- CreateIndex
CREATE INDEX "RoomBoundaryEdge_wallId_idx" ON "RoomBoundaryEdge"("wallId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBoundaryEdge_roomId_position_key" ON "RoomBoundaryEdge"("roomId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBoundaryEdge_roomId_wallId_key" ON "RoomBoundaryEdge"("roomId", "wallId");

-- CreateIndex
CREATE INDEX "Opening_projectId_idx" ON "Opening"("projectId");

-- CreateIndex
CREATE INDEX "Opening_wallId_position_idx" ON "Opening"("wallId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Opening_projectId_domainId_key" ON "Opening"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "Opening_wallId_position_key" ON "Opening"("wallId", "position");

-- CreateIndex
CREATE INDEX "OpeningConnectedRoomReference_projectId_idx" ON "OpeningConnectedRoomReference"("projectId");

-- CreateIndex
CREATE INDEX "OpeningConnectedRoomReference_roomId_idx" ON "OpeningConnectedRoomReference"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningConnectedRoomReference_openingId_position_key" ON "OpeningConnectedRoomReference"("openingId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningConnectedRoomReference_openingId_roomId_key" ON "OpeningConnectedRoomReference"("openingId", "roomId");

-- CreateIndex
CREATE INDEX "Staircase_projectId_idx" ON "Staircase"("projectId");

-- CreateIndex
CREATE INDEX "Staircase_fromLevelId_idx" ON "Staircase"("fromLevelId");

-- CreateIndex
CREATE INDEX "Staircase_toLevelId_idx" ON "Staircase"("toLevelId");

-- CreateIndex
CREATE INDEX "Staircase_fromRoomId_idx" ON "Staircase"("fromRoomId");

-- CreateIndex
CREATE INDEX "Staircase_toRoomId_idx" ON "Staircase"("toRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "Staircase_projectId_domainId_key" ON "Staircase"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "Staircase_owningLevelId_position_key" ON "Staircase"("owningLevelId", "position");

-- CreateIndex
CREATE INDEX "StairFlight_projectId_idx" ON "StairFlight"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StairFlight_projectId_domainId_key" ON "StairFlight"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "StairFlight_staircaseId_position_key" ON "StairFlight"("staircaseId", "position");

-- CreateIndex
CREATE INDEX "StairLanding_projectId_idx" ON "StairLanding"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StairLanding_projectId_domainId_key" ON "StairLanding"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "StairLanding_staircaseId_position_key" ON "StairLanding"("staircaseId", "position");

-- CreateIndex
CREATE INDEX "Viewpoint_levelId_idx" ON "Viewpoint"("levelId");

-- CreateIndex
CREATE INDEX "Viewpoint_roomId_idx" ON "Viewpoint"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Viewpoint_projectId_domainId_key" ON "Viewpoint"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "Viewpoint_projectId_position_key" ON "Viewpoint"("projectId", "position");

-- CreateIndex
CREATE INDEX "BaseImage_viewpointId_idx" ON "BaseImage"("viewpointId");

-- CreateIndex
CREATE UNIQUE INDEX "BaseImage_projectId_domainId_key" ON "BaseImage"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "BaseImage_projectId_position_key" ON "BaseImage"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DesignBrief_projectId_domainId_key" ON "DesignBrief"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignBrief_projectId_position_key" ON "DesignBrief"("projectId", "position");

-- CreateIndex
CREATE INDEX "DesignBriefConstraint_projectId_idx" ON "DesignBriefConstraint"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignBriefConstraint_designBriefId_position_key" ON "DesignBriefConstraint"("designBriefId", "position");

-- CreateIndex
CREATE INDEX "DesignBriefPaletteEntry_projectId_idx" ON "DesignBriefPaletteEntry"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignBriefPaletteEntry_designBriefId_position_key" ON "DesignBriefPaletteEntry"("designBriefId", "position");

-- CreateIndex
CREATE INDEX "DesignBriefReferenceAsset_projectId_idx" ON "DesignBriefReferenceAsset"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignBriefReferenceAsset_designBriefId_position_key" ON "DesignBriefReferenceAsset"("designBriefId", "position");

-- CreateIndex
CREATE INDEX "RenderRequest_viewpointId_idx" ON "RenderRequest"("viewpointId");

-- CreateIndex
CREATE INDEX "RenderRequest_baseImageId_idx" ON "RenderRequest"("baseImageId");

-- CreateIndex
CREATE INDEX "RenderRequest_designBriefId_idx" ON "RenderRequest"("designBriefId");

-- CreateIndex
CREATE UNIQUE INDEX "RenderRequest_projectId_domainId_key" ON "RenderRequest"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "RenderRequest_projectId_position_key" ON "RenderRequest"("projectId", "position");

-- CreateIndex
CREATE INDEX "RenderResult_renderRequestId_idx" ON "RenderResult"("renderRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "RenderResult_projectId_domainId_key" ON "RenderResult"("projectId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "RenderResult_projectId_position_key" ON "RenderResult"("projectId", "position");

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Level" ADD CONSTRAINT "Level_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wall" ADD CONSTRAINT "Wall_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wall" ADD CONSTRAINT "Wall_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallRoomReference" ADD CONSTRAINT "WallRoomReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallRoomReference" ADD CONSTRAINT "WallRoomReference_wallId_fkey" FOREIGN KEY ("wallId") REFERENCES "Wall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallRoomReference" ADD CONSTRAINT "WallRoomReference_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBoundaryEdge" ADD CONSTRAINT "RoomBoundaryEdge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBoundaryEdge" ADD CONSTRAINT "RoomBoundaryEdge_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBoundaryEdge" ADD CONSTRAINT "RoomBoundaryEdge_wallId_fkey" FOREIGN KEY ("wallId") REFERENCES "Wall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opening" ADD CONSTRAINT "Opening_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opening" ADD CONSTRAINT "Opening_wallId_fkey" FOREIGN KEY ("wallId") REFERENCES "Wall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningConnectedRoomReference" ADD CONSTRAINT "OpeningConnectedRoomReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningConnectedRoomReference" ADD CONSTRAINT "OpeningConnectedRoomReference_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "Opening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningConnectedRoomReference" ADD CONSTRAINT "OpeningConnectedRoomReference_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staircase" ADD CONSTRAINT "Staircase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staircase" ADD CONSTRAINT "Staircase_owningLevelId_fkey" FOREIGN KEY ("owningLevelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staircase" ADD CONSTRAINT "Staircase_fromLevelId_fkey" FOREIGN KEY ("fromLevelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staircase" ADD CONSTRAINT "Staircase_toLevelId_fkey" FOREIGN KEY ("toLevelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staircase" ADD CONSTRAINT "Staircase_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staircase" ADD CONSTRAINT "Staircase_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StairFlight" ADD CONSTRAINT "StairFlight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StairFlight" ADD CONSTRAINT "StairFlight_staircaseId_fkey" FOREIGN KEY ("staircaseId") REFERENCES "Staircase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StairLanding" ADD CONSTRAINT "StairLanding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StairLanding" ADD CONSTRAINT "StairLanding_staircaseId_fkey" FOREIGN KEY ("staircaseId") REFERENCES "Staircase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viewpoint" ADD CONSTRAINT "Viewpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viewpoint" ADD CONSTRAINT "Viewpoint_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viewpoint" ADD CONSTRAINT "Viewpoint_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseImage" ADD CONSTRAINT "BaseImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseImage" ADD CONSTRAINT "BaseImage_viewpointId_fkey" FOREIGN KEY ("viewpointId") REFERENCES "Viewpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignBrief" ADD CONSTRAINT "DesignBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignBriefConstraint" ADD CONSTRAINT "DesignBriefConstraint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignBriefConstraint" ADD CONSTRAINT "DesignBriefConstraint_designBriefId_fkey" FOREIGN KEY ("designBriefId") REFERENCES "DesignBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignBriefPaletteEntry" ADD CONSTRAINT "DesignBriefPaletteEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignBriefPaletteEntry" ADD CONSTRAINT "DesignBriefPaletteEntry_designBriefId_fkey" FOREIGN KEY ("designBriefId") REFERENCES "DesignBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignBriefReferenceAsset" ADD CONSTRAINT "DesignBriefReferenceAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignBriefReferenceAsset" ADD CONSTRAINT "DesignBriefReferenceAsset_designBriefId_fkey" FOREIGN KEY ("designBriefId") REFERENCES "DesignBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderRequest" ADD CONSTRAINT "RenderRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderRequest" ADD CONSTRAINT "RenderRequest_viewpointId_fkey" FOREIGN KEY ("viewpointId") REFERENCES "Viewpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderRequest" ADD CONSTRAINT "RenderRequest_baseImageId_fkey" FOREIGN KEY ("baseImageId") REFERENCES "BaseImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderRequest" ADD CONSTRAINT "RenderRequest_designBriefId_fkey" FOREIGN KEY ("designBriefId") REFERENCES "DesignBrief"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderResult" ADD CONSTRAINT "RenderResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderResult" ADD CONSTRAINT "RenderResult_renderRequestId_fkey" FOREIGN KEY ("renderRequestId") REFERENCES "RenderRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
