import "dotenv/config";
import express from "express";
import cors from "cors";
import { pipelineRouter } from "./routes/pipeline";
import { issuesRouter } from "./routes/issues";
import { tracesRouter } from "./routes/traces";
import { costsRouter } from "./routes/costs";

const app = express();
app.use(cors({ origin: process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/pipeline", pipelineRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/traces", tracesRouter);
app.use("/api/costs", costsRouter);

const PORT = Number(process.env.SERVER_PORT ?? 3001);
app.listen(PORT, () => console.log(`[server] :${PORT}`));
