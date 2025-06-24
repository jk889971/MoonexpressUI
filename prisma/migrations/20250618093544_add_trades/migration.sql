-- CreateTable
CREATE TABLE "Trade" (
    "id" SERIAL NOT NULL,
    "launchAddress" VARCHAR(42) NOT NULL,
    "wallet" VARCHAR(42) NOT NULL,
    "type" TEXT NOT NULL,
    "bnbAmount" DECIMAL(24,18) NOT NULL,
    "tokenAmount" DECIMAL(32,0) NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_launchAddress_fkey" FOREIGN KEY ("launchAddress") REFERENCES "Launch"("launchAddress") ON DELETE RESTRICT ON UPDATE CASCADE;
