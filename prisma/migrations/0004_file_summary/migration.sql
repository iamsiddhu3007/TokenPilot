CREATE TABLE "file_summary" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "file_path" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "file_summary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_summary_project_id_file_path_key" ON "file_summary"("project_id", "file_path");
