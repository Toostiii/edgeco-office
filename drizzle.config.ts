import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Lädt DATABASE_URL aus .env.local (Supabase Postgres Connection String).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
