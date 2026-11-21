-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('active', 'canceled');

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservations_resource_status_idx" ON "reservations"("resource", "status");
