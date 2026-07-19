-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "ReviewReport" ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "UserToken" ALTER COLUMN "expires" SET DEFAULT NOW() + interval '7 days';
