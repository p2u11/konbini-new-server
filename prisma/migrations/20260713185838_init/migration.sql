/*
  Warnings:

  - You are about to drop the `_AppToCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_AppToCategory" DROP CONSTRAINT "_AppToCategory_A_fkey";

-- DropForeignKey
ALTER TABLE "_AppToCategory" DROP CONSTRAINT "_AppToCategory_B_fkey";

-- AlterTable
ALTER TABLE "App" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "UserToken" ALTER COLUMN "expires" SET DEFAULT NOW() + interval '7 days';

-- DropTable
DROP TABLE "_AppToCategory";

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("cat_id") ON DELETE SET NULL ON UPDATE CASCADE;
