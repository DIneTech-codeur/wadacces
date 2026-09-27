import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Configuration Drizzle.
 * Lit DATABASE_URL depuis .env (local) ou depuis les variables Vercel/Neon
 * (production). Pour créer les tables sur Neon : `npm run db:push`.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
