-- AlterTable
ALTER TABLE "UserToken" ALTER COLUMN "expires" SET DEFAULT NOW() + interval '7 days';
