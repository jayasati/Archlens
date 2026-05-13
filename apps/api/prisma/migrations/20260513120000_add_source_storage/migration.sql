-- AlterTable
ALTER TABLE "reports" ADD COLUMN "sourceDirPath" TEXT;

-- AlterTable
ALTER TABLE "files" ADD COLUMN "sha256" TEXT;
ALTER TABLE "files" ADD COLUMN "byteSize" INTEGER;
ALTER TABLE "files" ADD COLUMN "truncated" BOOLEAN NOT NULL DEFAULT false;
