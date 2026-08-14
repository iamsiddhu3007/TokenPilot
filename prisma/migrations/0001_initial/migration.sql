-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";

-- Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT,
    "display_username" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_key" ON "user"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_key" ON "user"("username");

CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_token_key" ON "session"("token");

CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- App tables
CREATE TABLE IF NOT EXISTS "project" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "project_member" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_member_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_member_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
    CONSTRAINT "project_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_member_unique" ON "project_member"("project_id", "user_id");

CREATE TABLE IF NOT EXISTS "provider_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "enc_api_key" TEXT NOT NULL,
    "enc_nvidia_api_key" TEXT,
    "nvidia_embed_model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_config_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_config_project_id_key" ON "provider_config"("project_id");

CREATE TABLE IF NOT EXISTS "github_connection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "installation_id" TEXT NOT NULL,
    "owner" TEXT,
    "name" TEXT,
    "default_branch" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "github_connection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "github_connection_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "github_connection_project_id_key" ON "github_connection"("project_id");

-- Agent pipeline tables
CREATE TABLE IF NOT EXISTS "issue_job" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "github_issue_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "priority" TEXT,
    "budget_tier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_job_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "issue_job_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "agent_run" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issue_job_id" UUID NOT NULL,
    "agent_type" TEXT NOT NULL,
    "langsmith_run_id" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "cost_usd" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "agent_run_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_run_issue_job_id_fkey" FOREIGN KEY ("issue_job_id") REFERENCES "issue_job"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "code_chunk" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024),
    "sha" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "code_chunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "code_chunk_project_id_file_path_chunk_index_key" ON "code_chunk"("project_id", "file_path", "chunk_index");
CREATE INDEX IF NOT EXISTS "code_chunk_embedding_idx" ON "code_chunk" USING hnsw ("embedding" vector_cosine_ops);

CREATE TABLE IF NOT EXISTS "issue_estimate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issue_job_id" UUID NOT NULL,
    "effort_hours" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,
    "similar_chunks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_estimate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "issue_estimate_issue_job_id_fkey" FOREIGN KEY ("issue_job_id") REFERENCES "issue_job"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_estimate_issue_job_id_key" ON "issue_estimate"("issue_job_id");
