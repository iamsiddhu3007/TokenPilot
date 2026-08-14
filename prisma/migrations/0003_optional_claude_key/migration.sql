-- Claude key is now optional; NVIDIA key covers LLM + embeddings
ALTER TABLE "provider_config" ALTER COLUMN "enc_api_key" DROP NOT NULL;
