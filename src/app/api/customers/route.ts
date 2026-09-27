import { db } from "@/db";
import { customers, customerDebtLogs } from "@/db/schema";
import { eq, like, or, and, isNull, ilike, desc, asc, sql } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess, parseQuery, parseQueryInt } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  initialDebt: z.number().nonnegative().optional(),
});

export async function GET(req: Request) {
  const { error } = await requireUser("customer.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = parseQuery(searchParams.get("q"));
  const page = parseQueryInt(searchParams.get("page")) ?? 1;
  const pageSize = Math.min(parseQueryInt(searchParams.get("pageSize")) ?? 50, 200);
  const offset = (page - 1) * pageSize;

  const filters: any[] = [eq(customers.active, true)];
  if (q) {
    const likeQ = `%${q}%`;
    filters.push(
      or(
        ilike(customers.name, likeQ),
        ilike(customers.phone, likeQ),
        ilike(customers.company, likeQ)
      )
    );
  }

  const rows = await db
    .select()
    .from(customers)
    .where(and(...filters))
    .orderBy(asc(customers.name))
    .limit(pageSize)
    .offset(offset);

  const countResult = await db
    .select({ c: sql<number>`count(*)` })
    .from(customers)
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
  const { user, error } = await requireUser("customer.create");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Données invalides");
  }

  const [created] = await db
    .insert(customers)
    .values({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      address: parsed.data.address || null,
      email: parsed.data.email || null,
      type: parsed.data.type || "retail",
      notes: parsed.data.notes || null,
    })
    .returning();

  // Dette déjà existante au moment de l'enregistrement (reprise de l'existant).
  const initialDebt = user.role === "vendor" ? 0 : parsed.data.initialDebt ?? 0;
  if (initialDebt > 0) {
    await db.insert(customerDebtLogs).values({
      customerId: created.id,
      amount: String(initialDebt),
      type: "charge",
      note: "Dette existante à l'enregistrement du client",
      userId: user.id,
    });
    await db
      .update(customers)
      .set({ debt: String(initialDebt), updatedAt: new Date() })
      .where(eq(customers.id, created.id));
    created.debt = String(initialDebt);
  }

  await writeAuditLog({
    user,
    action: "create",
    entityType: "customer",
    entityId: created.id,
    newValues: created,
  });

  return jsonSuccess(created);
}
