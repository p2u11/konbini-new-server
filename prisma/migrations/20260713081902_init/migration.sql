-- CreateEnum
CREATE TYPE "ModeratedObjectType" AS ENUM ('APP', 'APP_VERSION', 'RESOURCE');

-- CreateEnum
CREATE TYPE "ModeratedObjectStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AppResourceType" AS ENUM ('ICON', 'SCREENSHOT');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('APP', 'GAME');

-- CreateTable
CREATE TABLE "UserToken" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER NOT NULL,
    "tokenhash" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires" TIMESTAMP(3) NOT NULL DEFAULT NOW() + interval '7 days',

    CONSTRAINT "UserToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "register_ip" TEXT NOT NULL,
    "last_login_ip" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL,
    "can_upload" BOOLEAN NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeratedObject" (
    "id" SERIAL NOT NULL,
    "objectType" "ModeratedObjectType" NOT NULL DEFAULT 'APP',
    "appId" INTEGER,
    "appVersionId" INTEGER,
    "resourceId" INTEGER,
    "status" "ModeratedObjectStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,

    CONSTRAINT "ModeratedObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "App" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "author" TEXT,
    "packageId" TEXT NOT NULL,
    "description" TEXT,
    "uploaderId" INTEGER NOT NULL,
    "moderatedObjectId" INTEGER NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppVersion" (
    "id" SERIAL NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "versionName" TEXT NOT NULL,
    "minSdk" INTEGER,
    "abis" TEXT[],
    "downloadUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appId" INTEGER NOT NULL,
    "uploaderId" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "moderatedObjectId" INTEGER NOT NULL,

    CONSTRAINT "AppVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppResource" (
    "id" SERIAL NOT NULL,
    "type" "AppResourceType" NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appId" INTEGER NOT NULL,
    "uploaderId" INTEGER NOT NULL,
    "moderatedObjectId" INTEGER NOT NULL,

    CONSTRAINT "AppResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "cat_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AppToCategory" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AppToCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserToken_tokenhash_key" ON "UserToken"("tokenhash");

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ModeratedObject_appId_key" ON "ModeratedObject"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeratedObject_appVersionId_key" ON "ModeratedObject"("appVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ModeratedObject_resourceId_key" ON "ModeratedObject"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "App_packageId_key" ON "App"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "App_moderatedObjectId_key" ON "App"("moderatedObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AppVersion_sha256_key" ON "AppVersion"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "AppVersion_moderatedObjectId_key" ON "AppVersion"("moderatedObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AppResource_moderatedObjectId_key" ON "AppResource"("moderatedObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_cat_id_key" ON "Category"("cat_id");

-- CreateIndex
CREATE INDEX "_AppToCategory_B_index" ON "_AppToCategory"("B");

-- AddForeignKey
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userid_fkey" FOREIGN KEY ("userid") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratedObject" ADD CONSTRAINT "ModeratedObject_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratedObject" ADD CONSTRAINT "ModeratedObject_appVersionId_fkey" FOREIGN KEY ("appVersionId") REFERENCES "AppVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeratedObject" ADD CONSTRAINT "ModeratedObject_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AppResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppVersion" ADD CONSTRAINT "AppVersion_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppVersion" ADD CONSTRAINT "AppVersion_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppResource" ADD CONSTRAINT "AppResource_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppResource" ADD CONSTRAINT "AppResource_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppToCategory" ADD CONSTRAINT "_AppToCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AppToCategory" ADD CONSTRAINT "_AppToCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
