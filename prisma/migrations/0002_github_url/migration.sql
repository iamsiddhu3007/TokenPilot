-- Make installation_id optional (URL-based repos don't have one)
ALTER TABLE "github_connection" ALTER COLUMN "installation_id" DROP NOT NULL;

-- Add encrypted GitHub PAT for private repo access
ALTER TABLE "github_connection" ADD COLUMN IF NOT EXISTS "enc_github_pat" TEXT;
