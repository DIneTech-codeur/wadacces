import { db } from "@/db";
import { customers, payments, customerDebtLogs } from "@/db/schema";
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
    return jsonError("Seul l'administrateur ou le gestionnaire peut encaisser une dette", 403);
  }
  const { id } = await params;
  const customerId = parseInt(id, 10);
  if (Number.isNaN(customerId)) return jsonError("ID invalide");

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");

  try {
    const result = await db.transaction(async (tx) => {
      const [customer] = await tx.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!customer) throw new Error("Client introuvable");
      const currentDebt = toNumber(customer.debt);
      if (parsed.data.amount > currentDebt + 0.01) {
        throw new Error(`Le montant dépasse la dette (${currentDebt})`);
      }
      const [payment] = await tx
        .insert(payments)
        .values({
          paymentableType: "customer_debt",
          paymentableId: customerId,
          customerId,
          amount: String(parsed.data.amount),
          method: parsed.data.method,
          note: parsed.data.note || null,
          userId: user.id,
          localId: generateLocalId(),
        })
        .returning({ id: payments.id });

      await tx
        .update(customers)
        .set({
          debt: sql`GREATEST(${customers.debt}::numeric - ${String(parsed.data.amount)}::numeric, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, customerId));

      await tx.insert(customerDebtLogs).values({
        customerId,
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
      entityType: "customer",
      entityId: customerId,
      newValues: parsed.data,
    });

    return jsonSuccess(result);
  } catch (err: unknown) {
    return jsonError(err instanceof Error ? err.message : "Erreur de paiement", 400);
  }
}
