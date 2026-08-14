import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";

export const langsmithClient = new Client({
  apiKey: process.env.LANGSMITH_API_KEY,
});

export { traceable };
