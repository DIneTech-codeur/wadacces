import { db } from "@/db";
import { suppliers, payments, supplierDebtLogs, users, purchases } from "@/db/schema";
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

/** Historique complet de ce que la boutique doit à un fournisseur. */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireRole("admin", "manager");
  if (error) return error;
  const supplierId = parseId((await params).id);
  if (!supplierId) return jsonError("ID invalide");

  const [supplier] = await db
    .select({ id: suppliers.id, name: suppliers.name, phone: suppliers.phone, debt: suppliers.debt })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  if (!supplier) return jsonError("Fournisseur introuvable", 404);

  const logs = await db
    .select({
      id: supplierDebtLogs.id,
      type: supplierDebtLogs.type,
      amount: supplierDebtLogs.amount,
      note: supplierDebtLogs.note,
      createdAt: supplierDebtLogs.createdAt,
      userName: users.fullName,
      reference: purchases.purchaseNumber,
      paymentMethod: payments.method,
    })
    .from(supplierDebtLogs)
    .leftJoin(users, eq(supplierDebtLogs.userId, users.id))
    .leftJoin(purchases, eq(supplierDebtLogs.purchaseId, purchases.id))
    .leftJoin(payments, eq(supplierDebtLogs.paymentId, payments.id))
    .where(eq(supplierDebtLogs.supplierId, supplierId))
    .orderBy(desc(supplierDebtLogs.createdAt), desc(supplierDebtLogs.id))
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

  return jsonSuccess({ entity: { ...supplier, debt: toNumber(supplier.debt) }, logs, totals });
}

const addSchema = z.object({
  amount: z.number().positive("Le montant doit être supérieur à 0"),
  note: z.string().max(500).optional().nullable(),
});

/** Ajouter une dette : la boutique doit X FCFA de plus à ce fournisseur. */
export async function POST(req: Request, { params }: Params) {
  const { user, error } = await requireRole("admin", "manager");
  if (error) return error;
  const supplierId = parseId((await params).id);
  if (!supplierId) return jsonError("ID invalide");

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Montant invalide");

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
  if (!supplier) return jsonError("Fournisseur introuvable", 404);

  const { amount } = parsed.data;
  const note = parsed.data.note?.trim() || "Dette ajoutée manuellement";

  const updated = await db.transaction(async (tx) => {
    await tx.insert(supplierDebtLogs).values({
      supplierId,
      amount: String(amount),
      type: "charge",
      note,
      userId: user.id,
    });
    const [row] = await tx
      .update(suppliers)
      .set({ debt: sql`${suppliers.debt}::numeric + ${String(amount)}::numeric`, updatedAt: new Date() })
      .where(eq(suppliers.id, supplierId))
      .returning({ debt: suppliers.debt });
    return row;
  });

  await writeAuditLog({
    user,
    action: "add_supplier_debt",
    entityType: "supplier",
    entityId: supplierId,
    oldValues: { debt: toNumber(supplier.debt) },
    newValues: { debt: toNumber(updated.debt), added: amount },
    ip: getClientIp(req),
    note,
  });

  return jsonSuccess({ id: supplierId, debt: toNumber(updated.debt), added: amount });
}

const setSchema = z.object({
  debt: z.number().nonnegative(),
  note: z.string().max(500).optional().nullable(),
});

/** Corriger le montant exact dû au fournisseur (administrateur uniquement). */
export async function PUT(req: Request, { params }: Params) {
  const { user, error } = await requireRole("admin");
  if (error) return error;
  const supplierId = parseId((await params).id);
  if (!supplierId) return jsonError("ID invalide");

  const body = await req.json().catch(() => null);
  const parsed = setSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
  if (!supplier) return jsonError("Fournisseur introuvable", 404);

  const previous = toNumber(supplier.debt);
  const next = parsed.data.debt;
  const difference = previous - next;
  if (difference === 0) return jsonSuccess({ id: supplierId, debt: next, changed: false });

  const note = parsed.data.note?.trim() || `Correction : ${previous} FCFA → ${next} FCFA`;

  await db.transaction(async (tx) => {
    if (difference > 0) {
      const [payment] = await tx
        .insert(payments)
        .values({
          paymentableType: "supplier_debt",
          paymentableId: supplierId,
          supplierId,
          amount: String(difference),
          method: "other",
          note,
          userId: user.id,
        })
        .returning({ id: payments.id });
      await tx.insert(supplierDebtLogs).values({
        supplierId,
        paymentId: payment.id,
        amount: String(difference),
        type: "payment",
        note,
        userId: user.id,
      });
    } else {
      await tx.insert(supplierDebtLogs).values({
        supplierId,
        amount: String(Math.abs(difference)),
        type: "charge",
        note,
        userId: user.id,
      });
    }
    await tx
      .update(suppliers)
      .set({ debt: String(next), updatedAt: new Date() })
      .where(eq(suppliers.id, supplierId));
  });

  await writeAuditLog({
    user,
    action: "adjust_supplier_debt",
    entityType: "supplier",
    entityId: supplierId,
    oldValues: { debt: previous },
    newValues: { debt: next },
    ip: getClientIp(req),
    note,
  });

  return jsonSuccess({ id: supplierId, debt: next, previous, changed: true });
}
