import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";

export async function writeAuditLog(input: {
  user?: Pick<SessionUser, "id" | "username"> | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  oldValues?: unknown;
  newValues?: unknown;
  ip?: string;
  deviceId?: string;
  note?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: input.user?.id ?? null,
      username: input.user?.username ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId !== null && input.entityId !== undefined ? String(input.entityId) : null,
      oldValues: input.oldValues ? (input.oldValues as any) : null,
      newValues: input.newValues ? (input.newValues as any) : null,
      ip: input.ip ?? null,
      deviceId: input.deviceId ?? null,
      note: input.note ?? null,
    });
  } catch (err) {
    // Audit log failure should not block the main operation
    console.error("Failed to write audit log", err);
  }
}
