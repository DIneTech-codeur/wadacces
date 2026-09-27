import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess, parseQueryInt } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role === "vendor") return jsonError("Accès refusé", 403);

  const { searchParams } = new URL(req.url);
  const page = parseQueryInt(searchParams.get("page")) ?? 1;
  const pageSize = Math.min(parseQueryInt(searchParams.get("pageSize")) ?? 50, 200);
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  return jsonSuccess({ items: rows, page, pageSize });
}
