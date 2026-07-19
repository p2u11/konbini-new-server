-- AlterTable
ALTER TABLE "UserToken" ALTER COLUMN "expires" SET DEFAULT NOW() + interval '7 days';

-- CreateTable
CREATE TABLE "Download" (
    "id" SERIAL NOT NULL,
    "appId" INTEGER NOT NULL,
    "ip" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
