/**
 * Drizzle-DB-Client gegen Supabase Postgres.
 * Verbindung über DATABASE_URL (Connection Pooler empfohlen).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL fehlt. Bitte in .env.local den Supabase-Connection-String setzen (siehe SETUP.md).",
  );
}

// prepare: false ist für den Supabase Transaction-Pooler (Port 6543) nötig.
// max/idle_timeout halten die Verbindungen auf Vercel (serverless) schlank.
const client = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
});

export const db = drizzle(client, { schema });
export { schema };
