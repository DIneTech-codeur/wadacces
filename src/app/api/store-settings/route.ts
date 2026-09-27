import { db } from "@/db";
import { storeSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  // Public endpoint (needed by vendor UI before full login flow on PWA)
  // No auth required for reading basic store settings.
  const rows = await db.select().from(storeSettings).limit(1);
  if (rows.length === 0) {
    const [inserted] = await db
      .insert(storeSettings)
      .values({
        storeName: "Ma Boutique",
        currency: "FCFA",
        lowStockThreshold: 5,
      })
      .returning();
    return jsonSuccess(inserted);
  }
  return jsonSuccess(rows[0]);
}

const updateSchema = z.object({
  storeName: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  lowStockThreshold: z.number().int().positive().optional(),
  enableVoiceFeedback: z.boolean().optional(),
  logoUrl: z.string().optional().nullable(),
});

export async function PUT(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "admin") {
    return jsonError("Seul l'administrateur peut modifier les paramètres", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Données invalides");
  }

  const [current] = await db.select().from(storeSettings).limit(1);
  if (!current) {
    const [inserted] = await db
      .insert(storeSettings)
      .values({ ...parsed.data, updatedAt: new Date() })
      .returning();
    return jsonSuccess(inserted);
  }

  const [updated] = await db
    .update(storeSettings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(storeSettings.id, current.id))
    .returning();

  return jsonSuccess(updated);
}
