import { db } from "@/db";
import {
  purchases,
  purchaseItems,
  products,
  suppliers,
  payments,
  supplierDebtLogs,
} from "@/db/schema";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess, parseQuery, parseQueryInt, getClientIp } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { applyStockChange } from "@/lib/stock";
import { generateNumber, generateLocalId, toNumber } from "@/lib/utils";
import { z } from "zod";
import type { PaymentMethod } from "@/types";

export const dynamic = "force-dynamic";

const purchaseItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
});

const createPurchaseSchema = z.object({
  supplierId: z.number().int().positive().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1),
  paymentMethod: z.enum(["cash", "mobile_money", "transfer", "credit", "other"]).default("cash"),
  amountPaid: z.number().nonnegative().optional(),
  notes: z.string().optional().nullable(),
  purchaseDate: z.string().optional(),
  isOffline: z.boolean().default(false),
  localId: z.string().optional(),
  deviceId: z.string().optional(),
  updateProductPrice: z.boolean().default(true),
});

export async function GET(req: Request) {
  const { error } = await requireUser("purchase.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = parseQueryInt(searchParams.get("page")) ?? 1;
  const pageSize = Math.min(parseQueryInt(searchParams.get("pageSize")) ?? 50, 200);
  const dateFrom = parseQuery(searchParams.get("dateFrom"));
  const dateTo = parseQuery(searchParams.get("dateTo"));
  const supplierId = parseQueryInt(searchParams.get("supplierId"));

  const offset = (page - 1) * pageSize;
  const filters: any[] = [];
  if (dateFrom) filters.push(gte(purchases.purchaseDate, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    filters.push(lte(purchases.purchaseDate, to));
  }
  if (supplierId) filters.push(eq(purchases.supplierId, supplierId));

  const rows = await db
    .select({
      id: purchases.id,
      purchaseNumber: purchases.purchaseNumber,
      supplierId: purchases.supplierId,
      supplierName: suppliers.name,
      userId: purchases.userId,
      invoiceNumber: purchases.invoiceNumber,
      totalAmount: purchases.totalAmount,
      paymentMethod: purchases.paymentMethod,
      amountPaid: purchases.amountPaid,
      amountDue: purchases.amountDue,
      notes: purchases.notes,
      purchaseDate: purchases.purchaseDate,
      itemsCount: sql<number>`(select count(*) from purchase_items where purchase_items.purchase_id = ${purchases.id})`,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(and(...filters))
    .orderBy(desc(purchases.purchaseDate))
    .limit(pageSize)
    .offset(offset);

  const countRes = await db
    .select({ c: sql<number>`count(*)` })
    .from(purchases)
    .where(and(...filters));

  const total = Number(countRes[0]?.c ?? 0);
  return jsonSuccess({
    items: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(req: Request) {
  const { user, error } = await requireUser("purchase.create");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Données invalides", 400);
  }
  const data = parsed.data;

  const localId = data.localId || (data.isOffline ? generateLocalId() : undefined);
  if (localId) {
    const [existing] = await db
      .select({ id: purchases.id })
      .from(purchases)
      .where(eq(purchases.localId, localId))
      .limit(1);
    if (existing) {
      return jsonSuccess({ id: existing.id, duplicate: true });
    }
  }

  const deviceId = data.deviceId;
  let newPurchaseId: number | null = null;

  try {
    await db.transaction(async (tx) => {
      let totalAmount = 0;
      const preparedItems: Array<{
        productId: number;
        productName: string;
        quantity: number;
        unitCost: number;
        subtotal: string;
      }> = [];

      const productIds = [...new Set(data.items.map((i) => i.productId))];
      const productRows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds));
      const productMap = new Map<number, (typeof productRows)[number]>();
      for (const p of productRows) productMap.set(p.id, p);

      for (const item of data.items) {
        const prod = productMap.get(item.productId);
        if (!prod) throw new Error(`Produit #${item.productId} introuvable`);
        const subtotal = item.quantity * item.unitCost;
        totalAmount += subtotal;
        preparedItems.push({
          productId: prod.id,
          productName: prod.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
          subtotal: String(subtotal),
        });
      }

      if (data.supplierId) {
        const [sup] = await tx
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(eq(suppliers.id, data.supplierId))
          .limit(1);
        if (!sup) throw new Error("Fournisseur introuvable");
      }

      const amountPaid = data.amountPaid ?? (data.paymentMethod === "credit" ? 0 : totalAmount);
      const amountDue = Math.max(0, totalAmount - amountPaid);

      const [inserted] = await tx
        .insert(purchases)
        .values({
          purchaseNumber: "",
          supplierId: data.supplierId ?? null,
          userId: user.id,
          invoiceNumber: data.invoiceNumber || null,
          totalAmount: String(totalAmount),
          paymentMethod: data.paymentMethod,
          amountPaid: String(amountPaid),
          amountDue: String(amountDue),
          notes: data.notes || null,
          isOffline: data.isOffline,
          localId: localId || null,
          deviceId: deviceId || null,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
        })
        .returning({ id: purchases.id });

      newPurchaseId = inserted.id;
      const purchaseNumber = generateNumber("A", inserted.id);
      await tx
        .update(purchases)
        .set({ purchaseNumber })
        .where(eq(purchases.id, inserted.id));

      for (const it of preparedItems) {
        await tx.insert(purchaseItems).values({
          purchaseId: inserted.id,
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitCost: String(it.unitCost),
          subtotal: it.subtotal,
        });

        // Update stock
        await applyStockChange(tx, {
          productId: it.productId,
          quantity: it.quantity,
          movementType: "entry",
          unitCost: it.unitCost,
          referenceType: "purchase",
          referenceId: inserted.id,
          referenceLocalId: localId,
          userId: user.id,
          note: `Achat ${purchaseNumber}`,
        });

        // Optionally update product's purchase price to latest cost
        if (data.updateProductPrice) {
          await tx
            .update(products)
            .set({
              purchasePrice: String(it.unitCost),
              updatedAt: new Date(),
            })
            .where(eq(products.id, it.productId));
        }
      }

      if (amountPaid > 0) {
        await tx.insert(payments).values({
          paymentableType: "purchase",
          paymentableId: inserted.id,
          supplierId: data.supplierId ?? null,
          amount: String(amountPaid),
          method: data.paymentMethod,
          userId: user.id,
          isOffline: data.isOffline,
          localId: localId ? `pay_${localId}` : null,
        });
      }

      if (data.supplierId) {
        await tx
          .update(suppliers)
          .set({
            totalPurchases: sql`${suppliers.totalPurchases} + ${String(totalAmount)}`,
            debt: amountDue > 0 ? sql`${suppliers.debt} + ${String(amountDue)}` : suppliers.debt,
          })
          .where(eq(suppliers.id, data.supplierId));

        if (amountDue > 0) {
          await tx.insert(supplierDebtLogs).values({
            supplierId: data.supplierId,
            purchaseId: inserted.id,
            amount: String(amountDue),
            type: "charge",
            note: `Achat ${purchaseNumber}`,
            userId: user.id,
          });
        }
      }

      await writeAuditLog({
        user,
        action: "create",
        entityType: "purchase",
        entityId: inserted.id,
        newValues: { purchaseNumber, totalAmount, itemsCount: preparedItems.length },
        ip: getClientIp(req),
        deviceId,
      });
    });

    return jsonSuccess({ id: newPurchaseId, localId });
  } catch (err: any) {
    console.error("Purchase creation error:", err);
    return jsonError(err.message || "Erreur lors de l'enregistrement de l'achat", 400);
  }
}
