/*
  Warnings:

  - The primary key for the `Launch` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Profile` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_launchAddress_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_wallet_fkey";

-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_launchAddress_fkey";

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "launchAddress" SET DATA TYPE TEXT,
ALTER COLUMN "wallet" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Launch" DROP CONSTRAINT "Launch_pkey",
ALTER COLUMN "launchAddress" SET DATA TYPE TEXT,
ALTER COLUMN "tokenAddress" SET DATA TYPE TEXT,
ALTER COLUMN "twitterUrl" SET DATA TYPE TEXT,
ALTER COLUMN "telegramUrl" SET DATA TYPE TEXT,
ALTER COLUMN "websiteUrl" SET DATA TYPE TEXT,
ADD CONSTRAINT "Launch_pkey" PRIMARY KEY ("launchAddress");

-- AlterTable
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_pkey",
ALTER COLUMN "wallet" SET DATA TYPE TEXT,
ADD CONSTRAINT "Profile_pkey" PRIMARY KEY ("wallet");

-- AlterTable
ALTER TABLE "Trade" ALTER COLUMN "launchAddress" SET DATA TYPE TEXT,
ALTER COLUMN "wallet" SET DATA TYPE TEXT,
ALTER COLUMN "bnbAmount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "tokenAmount" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "txHash" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "PriceBar" (
    "id" SERIAL NOT NULL,
    "launchAddress" TEXT NOT NULL,
    "bucketMs" BIGINT NOT NULL,
    "open" DECIMAL(65,30) NOT NULL,
    "high" DECIMAL(65,30) NOT NULL,
    "low" DECIMAL(65,30) NOT NULL,
    "close" DECIMAL(65,30) NOT NULL,
    "mcapUsd" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "PriceBar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceBar_launchAddress_bucketMs_idx" ON "PriceBar"("launchAddress", "bucketMs");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBar_launchAddress_bucketMs_key" ON "PriceBar"("launchAddress", "bucketMs");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_launchAddress_fkey" FOREIGN KEY ("launchAddress") REFERENCES "Launch"("launchAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_launchAddress_fkey" FOREIGN KEY ("launchAddress") REFERENCES "Launch"("launchAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "Profile"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBar" ADD CONSTRAINT "PriceBar_launchAddress_fkey" FOREIGN KEY ("launchAddress") REFERENCES "Launch"("launchAddress") ON DELETE RESTRICT ON UPDATE CASCADE;
