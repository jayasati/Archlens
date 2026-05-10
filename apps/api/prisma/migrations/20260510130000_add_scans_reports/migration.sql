-- CreateTable
CREATE TABLE "scans" (
    "id" UUID NOT NULL,
    "repoId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progressPct" INTEGER NOT NULL DEFAULT 0,
    "progressStep" TEXT,
    "error" TEXT,
    "cloneUrl" TEXT NOT NULL,
    "ref" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "scanId" UUID NOT NULL,
    "repoId" UUID NOT NULL,
    "irVersion" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "complexityScore" DOUBLE PRECISION NOT NULL,
    "duplicationScore" DOUBLE PRECISION NOT NULL,
    "couplingScore" DOUBLE PRECISION NOT NULL,
    "cohesionScore" DOUBLE PRECISION NOT NULL,
    "smellsScore" DOUBLE PRECISION NOT NULL,
    "modulesCount" INTEGER NOT NULL DEFAULT 0,
    "filesCount" INTEGER NOT NULL DEFAULT 0,
    "classesCount" INTEGER NOT NULL DEFAULT 0,
    "functionsCount" INTEGER NOT NULL DEFAULT 0,
    "smellsCount" INTEGER NOT NULL DEFAULT 0,
    "irBlobPath" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "irModuleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "virtual" BOOLEAN NOT NULL DEFAULT false,
    "filesCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "irFileId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "loc" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smells" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "fileId" UUID,
    "irSmellId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "startLine" INTEGER,
    "endLine" INTEGER,

    CONSTRAINT "smells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scans_repoId_createdAt_idx" ON "scans"("repoId", "createdAt");

-- CreateIndex
CREATE INDEX "scans_status_idx" ON "scans"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reports_scanId_key" ON "reports"("scanId");

-- CreateIndex
CREATE INDEX "reports_repoId_generatedAt_idx" ON "reports"("repoId", "generatedAt");

-- CreateIndex
CREATE INDEX "modules_reportId_idx" ON "modules"("reportId");

-- CreateIndex
CREATE INDEX "files_reportId_idx" ON "files"("reportId");

-- CreateIndex
CREATE INDEX "files_moduleId_idx" ON "files"("moduleId");

-- CreateIndex
CREATE INDEX "smells_reportId_idx" ON "smells"("reportId");

-- CreateIndex
CREATE INDEX "smells_reportId_severity_idx" ON "smells"("reportId", "severity");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smells" ADD CONSTRAINT "smells_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smells" ADD CONSTRAINT "smells_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
