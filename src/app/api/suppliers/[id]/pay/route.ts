import { db } from "@/db";
import { suppliers, payments, supplierDebtLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { generateLocalId, toNumber } from "@/lib/utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  amount: z.number().positive(),
  method: z.enum(["cash", "mobile_money", "transfer", "other"]).default("cash"),
  note: z.string().optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role === "vendor") {
    return jsonError("Seul l'administrateur ou le gestionnaire peut régler une dette", 403);
  }
  const { id } = await params;
  const supplierId = parseInt(id, 10);
  if (Number.isNaN(supplierId)) return jsonError("ID invalide");

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");

  try {
    const result = await db.transaction(async (tx) => {
      const [supplier] = await tx.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      if (!supplier) throw new Error("Fournisseur introuvable");
      const currentDebt = toNumber(supplier.debt);
      if (parsed.data.amount > currentDebt + 0.01) {
        throw new Error(`Le montant dépasse la dette (${currentDebt})`);
      }
      const [payment] = await tx
        .insert(payments)
        .values({
          paymentableType: "supplier_debt",
          paymentableId: supplierId,
          supplierId,
          amount: String(parsed.data.amount),
          method: parsed.data.method,
          note: parsed.data.note || null,
          userId: user.id,
          localId: generateLocalId(),
        })
        .returning({ id: payments.id });

      await tx
        .update(suppliers)
        .set({
          debt: sql`GREATEST(${suppliers.debt}::numeric - ${String(parsed.data.amount)}::numeric, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, supplierId));

      await tx.insert(supplierDebtLogs).values({
        supplierId,
        paymentId: payment.id,
        amount: String(parsed.data.amount),
        type: "payment",
        note: parsed.data.note || "Règlement de dette",
        userId: user.id,
      });

      return payment;
    });

    await writeAuditLog({
      user,
      action: "payment",
      entityType: "supplier",
      entityId: supplierId,
      newValues: parsed.data,
    });

    return jsonSuccess(result);
  } catch (err: unknown) {
    return jsonError(err instanceof Error ? err.message : "Erreur de paiement", 400);
  }
}
