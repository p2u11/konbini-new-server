/*
  Warnings:

  - You are about to drop the `Category` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "App" DROP CONSTRAINT "App_categoryId_fkey";

-- AlterTable
ALTER TABLE "UserToken" ALTER COLUMN "expires" SET DEFAULT NOW() + interval '7 days';

-- DropTable
DROP TABLE "Category";

-- DropEnum
DROP TYPE "CategoryType";
