CREATE TYPE "DoorHingeSide" AS ENUM ('START', 'END');
CREATE TYPE "DoorSwingSide" AS ENUM ('LEFT', 'RIGHT');

ALTER TABLE "Opening"
ADD COLUMN "hingeSide" "DoorHingeSide",
ADD COLUMN "swingSide" "DoorSwingSide";
