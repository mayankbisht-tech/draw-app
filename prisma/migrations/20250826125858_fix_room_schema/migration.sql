/*
  Warnings:

  - You are about to drop the column `roomId` on the `Room` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Room_roomId_key";

-- AlterTable
ALTER TABLE "public"."Room" DROP COLUMN "roomId";
