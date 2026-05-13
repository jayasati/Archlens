-- CreateTable
CREATE TABLE "fix_suggestions" (
    "id" UUID NOT NULL,
    "smellId" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fix_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fix_suggestions_smellId_model_promptHash_key" ON "fix_suggestions"("smellId", "model", "promptHash");

-- CreateIndex
CREATE INDEX "fix_suggestions_reportId_idx" ON "fix_suggestions"("reportId");

-- AddForeignKey
ALTER TABLE "fix_suggestions" ADD CONSTRAINT "fix_suggestions_smellId_fkey" FOREIGN KEY ("smellId") REFERENCES "smells"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fix_suggestions" ADD CONSTRAINT "fix_suggestions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
