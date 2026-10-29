-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "is_live" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "workflow_id" TEXT,
ADD COLUMN     "workflow_version" VARCHAR(50);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    "inputs" JSONB NOT NULL,
    "outputs" JSONB,
    "state" JSONB,
    "trace" JSONB,
    "duration_ms" INTEGER,
    "total_tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_executions_workflow_id_created_at_idx" ON "workflow_executions"("workflow_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_executions_project_id_created_at_idx" ON "workflow_executions"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "conversations_workflow_id_idx" ON "conversations"("workflow_id");

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
