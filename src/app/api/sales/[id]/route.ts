import { db } from "@/db";
import { sales, saleItems, customers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser("sale.view");
  if (error) return error;
  const { id } = await params;
  const saleId = parseInt(id, 10);
  if (Number.isNaN(saleId)) return jsonError("ID invalide");

  const [sale] = await db
    .select({
      id: sales.id,
      saleNumber: sales.saleNumber,
      customerId: sales.customerId,
      customerName: customers.name,
      userId: sales.userId,
      userName: users.fullName,
      saleType: sales.saleType,
      itemsTotal: sales.itemsTotal,
      discountAmount: sales.discountAmount,
      totalAmount: sales.totalAmount,
      totalCost: sales.totalCost,
      profit: sales.profit,
      paymentMethod: sales.paymentMethod,
      paymentStatus: sales.paymentStatus,
      amountPaid: sales.amountPaid,
      amountDue: sales.amountDue,
      notes: sales.notes,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .leftJoin(users, eq(sales.userId, users.id))
    .where(eq(sales.id, saleId))
    .limit(1);

  if (!sale) return jsonError("Vente introuvable", 404);

  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  return jsonSuccess({ sale, items });
}
