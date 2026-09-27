import { db } from "@/db";
import { customers, payments, customerDebtLogs, users, sales } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireRole, jsonError, jsonSuccess, getClientIp } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { toNumber } from "@/lib/utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isNaN(n) ? null : n;
}

/** Historique complet de la dette d'un client (dettes ajoutées + paiements). */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireRole("admin", "manager");
  if (error) return error;
  const customerId = parseId((await params).id);
  if (!customerId) return jsonError("ID invalide");

  const [customer] = await db
    .select({ id: customers.id, name: customers.name, phone: customers.phone, debt: customers.debt })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  if (!customer) return jsonError("Client introuvable", 404);

  const logs = await db
    .select({
      id: customerDebtLogs.id,
      type: customerDebtLogs.type,
      amount: customerDebtLogs.amount,
      note: customerDebtLogs.note,
      createdAt: customerDebtLogs.createdAt,
      userName: users.fullName,
      reference: sales.saleNumber,
      paymentMethod: payments.method,
    })
    .from(customerDebtLogs)
    .leftJoin(users, eq(customerDebtLogs.userId, users.id))
    .leftJoin(sales, eq(customerDebtLogs.saleId, sales.id))
    .leftJoin(payments, eq(customerDebtLogs.paymentId, payments.id))
    .where(eq(customerDebtLogs.customerId, customerId))
    .orderBy(desc(customerDebtLogs.createdAt), desc(customerDebtLogs.id))
    .limit(200);

  const totals = logs.reduce(
    (acc, l) => {
      const amount = toNumber(l.amount);
      if (l.type === "charge") acc.charged += amount;
      else acc.paid += amount;
      return acc;
    },
    { charged: 0, paid: 0 }
  );

  return jsonSuccess({ entity: { ...customer, debt: toNumber(customer.debt) }, logs, totals });
}

const addSchema = z.object({
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  note: z.string().max(500).optional().nullable(),
});

/** Ajouter une dette : le client doit X FCFA de plus. */
export async function POST(req: Request, { params }: Params) {
  const { user, error } = await requireRole("admin", "manager");
  if (error) return error;
  const customerId = parseId((await params).id);
  if (!customerId) return jsonError("ID invalide");

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Montant invalide");

  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return jsonError("Client introuvable", 404);

  const { amount } = parsed.data;
  const note = parsed.data.note?.trim() || "Dette ajoutée manuellement";

  const updated = await db.transaction(async (tx) => {
    await tx.insert(customerDebtLogs).values({
      customerId,
      amount: String(amount),
      type: "charge",
      note,
      userId: user.id,
    });
    const [row] = await tx
      .update(customers)
      .set({ debt: sql`${customers.debt}::numeric + ${String(amount)}::numeric`, updatedAt: new Date() })
      .where(eq(customers.id, customerId))
      .returning({ debt: customers.debt });
    return row;
  });

  await writeAuditLog({
    user,
    action: "add_customer_debt",
    entityType: "customer",
    entityId: customerId,
    oldValues: { debt: toNumber(customer.debt) },
    newValues: { debt: toNumber(updated.debt), added: amount },
    ip: getClientIp(req),
    note,
  });

  return jsonSuccess({ id: customerId, debt: toNumber(updated.debt), added: amount });
}

const setSchema = z.object({
  debt: z.number().nonnegative(),
  note: z.string().max(500).optional().nullable(),
});

/**
 * Corriger le montant exact de la dette (administrateur uniquement).
 * L'écart entre l'ancien et le nouveau solde est tracé dans l'historique.
 */
export async function PUT(req: Request, { params }: Params) {
  const { user, error } = await requireRole("admin");
  if (error) return error;
  const customerId = parseId((await params).id);
  if (!customerId) return jsonError("ID invalide");

  const body = await req.json().catch(() => null);
  const parsed = setSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");

  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer) return jsonError("Client introuvable", 404);

  const previous = toNumber(customer.debt);
  const next = parsed.data.debt;
  const difference = previous - next;
  if (difference === 0) return jsonSuccess({ id: customerId, debt: next, changed: false });

  const note = parsed.data.note?.trim() || `Correction : ${previous} FCFA → ${next} FCFA`;

  await db.transaction(async (tx) => {
    if (difference > 0) {
      const [payment] = await tx
        .insert(payments)
        .values({
          paymentableType: "customer_debt",
          paymentableId: customerId,
          customerId,
          amount: String(difference),
          method: "other",
          note,
          userId: user.id,
        })
        .returning({ id: payments.id });
      await tx.insert(customerDebtLogs).values({
        customerId,
        paymentId: payment.id,
        amount: String(difference),
        type: "payment",
        note,
        userId: user.id,
      });
    } else {
      await tx.insert(customerDebtLogs).values({
        customerId,
        amount: String(Math.abs(difference)),
        type: "charge",
        note,
        userId: user.id,
      });
    }
    await tx
      .update(customers)
      .set({ debt: String(next), updatedAt: new Date() })
      .where(eq(customers.id, customerId));
  });

  await writeAuditLog({
    user,
    action: "adjust_customer_debt",
    entityType: "customer",
    entityId: customerId,
    oldValues: { debt: previous },
    newValues: { debt: next },
    ip: getClientIp(req),
    note,
  });

  return jsonSuccess({ id: customerId, debt: next, previous, changed: true });
}
