import { db } from "@/db";
import { suppliers, supplierDebtLogs } from "@/db/schema";
import { eq, or, and, ilike, asc, sql } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess, parseQuery, parseQueryInt } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const supplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  notes: z.string().optional().nullable(),
  initialDebt: z.number().nonnegative().optional(),
});

export async function GET(req: Request) {
  const { error } = await requireUser("supplier.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = parseQuery(searchParams.get("q"));
  const page = parseQueryInt(searchParams.get("page")) ?? 1;
  const pageSize = Math.min(parseQueryInt(searchParams.get("pageSize")) ?? 50, 200);
  const offset = (page - 1) * pageSize;

  const filters: any[] = [eq(suppliers.active, true)];
  if (q) {
    const likeQ = `%${q}%`;
    filters.push(
      or(
        ilike(suppliers.name, likeQ),
        ilike(suppliers.phone, likeQ),
        ilike(suppliers.company, likeQ)
      )
    );
  }

  const rows = await db
    .select()
    .from(suppliers)
    .where(and(...filters))
    .orderBy(asc(suppliers.name))
    .limit(pageSize)
    .offset(offset);

  const countResult = await db
    .select({ c: sql<number>`count(*)` })
    .from(suppliers)
    .where(and(...filters));

  return jsonSuccess({
    items: rows,
    pagination: {
      page,
      pageSize,
      total: Number(countResult[0]?.c ?? 0),
    },
  });
}

export async function POST(req: Request) {
  const { user, error } = await requireUser("supplier.create");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Données invalides");
  }

  const [created] = await db
    .insert(suppliers)
    .values({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      address: parsed.data.address || null,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    })
    .returning();

  // Dette déjà existante au moment de l'enregistrement (reprise de l'existant).
  const initialDebt = user.role === "vendor" ? 0 : parsed.data.initialDebt ?? 0;
  if (initialDebt > 0) {
    await db.insert(supplierDebtLogs).values({
      supplierId: created.id,
      amount: String(initialDebt),
      type: "charge",
      note: "Dette existante à l'enregistrement du fournisseur",
      userId: user.id,
    });
    await db
      .update(suppliers)
      .set({ debt: String(initialDebt), updatedAt: new Date() })
      .where(eq(suppliers.id, created.id));
    created.debt = String(initialDebt);
  }

  await writeAuditLog({
    user,
    action: "create",
    entityType: "supplier",
    entityId: created.id,
    newValues: created,
  });

  return jsonSuccess(created);
}
