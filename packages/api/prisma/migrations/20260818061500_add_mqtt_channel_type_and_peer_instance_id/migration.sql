-- AlterEnum
ALTER TYPE "ChannelType" ADD VALUE 'mqtt';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mqttPeerInstanceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_mqttPeerInstanceId_key" ON "User"("mqttPeerInstanceId");
