-- CreateTable
CREATE TABLE "Launch" (
    "launchAddress" VARCHAR(42) NOT NULL,
    "tokenAddress" VARCHAR(42) NOT NULL,
    "description" TEXT,
    "twitterUrl" VARCHAR(255),
    "telegramUrl" VARCHAR(255),
    "websiteUrl" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("launchAddress")
);

-- CreateTable
CREATE TABLE "Profile" (
    "wallet" VARCHAR(42) NOT NULL,
    "avatarIndex" INTEGER NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("wallet")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "launchAddress" VARCHAR(42) NOT NULL,
    "parentId" INTEGER,
    "wallet" VARCHAR(42) NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_launchAddress_fkey" FOREIGN KEY ("launchAddress") REFERENCES "Launch"("launchAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_wallet_fkey" FOREIGN KEY ("wallet") REFERENCES "Profile"("wallet") ON DELETE RESTRICT ON UPDATE CASCADE;
