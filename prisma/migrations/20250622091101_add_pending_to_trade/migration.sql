/*
  Warnings:

  - A unique constraint covering the columns `[txHash]` on the table `Trade` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Trade_txHash_key" ON "Trade"("txHash");

-- CreateIndex
CREATE INDEX "Trade_launchAddress_createdAt_idx" ON "Trade"("launchAddress", "createdAt");
