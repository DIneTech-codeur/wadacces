import { db } from "@/db";
import { sql } from "drizzle-orm";
import { initializeDatabase } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
    await initializeDatabase();
  } catch (e) {
    console.error("Health check database error", e);
  }
  const latency = Date.now() - startTime;

  return Response.json(
    {
      ok: dbOk,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      database: dbOk ? "connected" : "error",
      latencyMs: latency,
    },
    { status: dbOk ? 200 : 503 }
  );
}
