import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  sales,
  saleItems,
  products,
  customers,
  payments,
  customerDebtLogs,
  stockMovements,
} from "@/db/schema";
import { eq, desc, and, isNull, gte, lte, sql, inArray } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess, parseQuery, parseQueryInt, getClientIp } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { applyStockChange } from "@/lib/stock";
import { generateNumber, generateLocalId, toNumber } from "@/lib/utils";
import { z } from "zod";
import type { PaymentMethod, PriceType, SaleType } from "@/types";

export const dynamic = "force-dynamic";

const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  priceType: z.enum(["retail", "wholesale", "special", "promotional", "custom"]).default("retail"),
});

const createSaleSchema = z.object({
  customerId: z.number().int().positive().optional().nullable(),
  saleType: z.enum(["retail", "wholesale", "special"]).default("retail"),
  items: z.array(saleItemSchema).min(1, "Au moins un article requis"),
  paymentMethod: z.enum(["cash", "mobile_money", "transfer", "credit", "other"]).default("cash"),
  amountPaid: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().default(0),
  notes: z.string().optional().nullable(),
  isOffline: z.boolean().default(false),
  localId: z.string().optional(),
  deviceId: z.string().optional(),
  createdAt: z.string().optional(),
});

export async function GET(req: Request) {
  const { error } = await requireUser("sale.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = parseQueryInt(searchParams.get("page")) ?? 1;
  const pageSize = Math.min(parseQueryInt(searchParams.get("pageSize")) ?? 50, 200);
  const dateFrom = parseQuery(searchParams.get("dateFrom"));
  const dateTo = parseQuery(searchParams.get("dateTo"));
  const userId = parseQueryInt(searchParams.get("userId"));
  const customerId = parseQueryInt(searchParams.get("customerId"));

  const offset = (page - 1) * pageSize;
  const filters: any[] = [];
  if (dateFrom) filters.push(gte(sales.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    filters.push(lte(sales.createdAt, to));
  }
  if (userId) filters.push(eq(sales.userId, userId));
  if (customerId) filters.push(eq(sales.customerId, customerId));

  const rows = await db
    .select({
      id: sales.id,
      saleNumber: sales.saleNumber,
      customerId: sales.customerId,
      customerName: customers.name,
      userId: sales.userId,
      saleType: sales.saleType,
      totalAmount: sales.totalAmount,
      totalCost: sales.totalCost,
      profit: sales.profit,
      paymentMethod: sales.paymentMethod,
      paymentStatus: sales.paymentStatus,
      amountPaid: sales.amountPaid,
      amountDue: sales.amountDue,
      isOffline: sales.isOffline,
      createdAt: sales.createdAt,
      itemsCount: sql<number>`(select count(*) from sale_items where sale_items.sale_id = ${sales.id})`,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(and(...filters))
    .orderBy(desc(sales.createdAt))
    .limit(pageSize)
    .offset(offset);

  const countRes = await db
    .select({ c: sql<number>`count(*)` })
    .from(sales)
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
  const { user, error } = await requireUser("sale.create");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Données invalides", 400);
  }
  const data = parsed.data;

  // Idempotency: if localId is provided, check for existing sale
  const localId = data.localId || (data.isOffline ? generateLocalId() : undefined);
  if (localId) {
    const [existing] = await db
      .select({ id: sales.id })
      .from(sales)
      .where(eq(sales.localId, localId))
      .limit(1);
    if (existing) {
      return jsonSuccess({ id: existing.id, duplicate: true, message: "Vente déjà enregistrée" });
    }
  }

  const deviceId = data.deviceId || (typeof window === "undefined" ? undefined : undefined);
  let newSaleId: number | null = null;

  try {
    await db.transaction(async (tx) => {
      // 1. Load products and verify availability
      const productIds = [...new Set(data.items.map((i) => i.productId))];
      const productRows = await tx
        .select()
        .from(products)
        .where(
          and(
            inArray(products.id, productIds),
            isNull(products.deletedAt),
            eq(products.active, true)
          )
        );

      const productMap = new Map<number, (typeof productRows)[number]>();
      for (const p of productRows) productMap.set(p.id, p);

      // Validate all products exist and stock is sufficient
      let itemsTotal = 0;
      let totalCost = 0;
      const preparedItems: Array<{
        productId: number;
        productName: string;
        productSku: string | null;
        quantity: number;
        purchasePriceAtTime: string;
        unitPrice: number;
        priceType: PriceType;
        subtotal: string;
        subtotalCost: string;
        profit: string;
      }> = [];

      for (const item of data.items) {
        const prod = productMap.get(item.productId);
        if (!prod) {
          throw new Error(`Produit #${item.productId} introuvable ou inactif`);
        }
        const stock = toNumber(prod.stock);
        if (stock < item.quantity) {
          throw new Error(
            `Stock insuffisant pour "${prod.name}" (disponible: ${stock}, demandé: ${item.quantity})`
          );
        }

        let unitPrice: number;
        if (item.unitPrice !== undefined) {
          unitPrice = item.unitPrice;
        } else {
          switch (item.priceType) {
            case "wholesale":
              unitPrice = toNumber(prod.wholesalePrice) || toNumber(prod.retailPrice);
              break;
            case "special":
              unitPrice = toNumber(prod.specialPrice) || toNumber(prod.retailPrice);
              break;
            case "promotional":
              unitPrice = toNumber(prod.promotionalPrice) || toNumber(prod.retailPrice);
              break;
            case "custom":
              unitPrice = item.unitPrice || toNumber(prod.retailPrice);
              break;
            case "retail":
            default:
              unitPrice = toNumber(prod.retailPrice);
          }
        }

        const purchasePriceAtTime = toNumber(prod.purchasePrice);
        const subtotal = unitPrice * item.quantity;
        const subtotalCost = purchasePriceAtTime * item.quantity;
        const profit = subtotal - subtotalCost;

        itemsTotal += subtotal;
        totalCost += subtotalCost;

        preparedItems.push({
          productId: prod.id,
          productName: prod.name,
          productSku: prod.sku,
          quantity: item.quantity,
          purchasePriceAtTime: String(purchasePriceAtTime),
          unitPrice,
          priceType: item.priceType,
          subtotal: String(subtotal),
          subtotalCost: String(subtotalCost),
          profit: String(profit),
        });
      }

      const discount = data.discountAmount || 0;
      const totalAmount = Math.max(0, itemsTotal - discount);
      const profit = totalAmount - totalCost;

      // Le montant encaissé ne peut pas dépasser le total de la vente :
      // si le client donne plus, la différence est une monnaie rendue,
      // et ne doit jamais gonfler le chiffre d'affaires encaissé.
      const requestedPaid = data.amountPaid ?? (data.paymentMethod === "credit" ? 0 : totalAmount);
      const amountPaid = Math.min(requestedPaid, totalAmount);
      const changeGiven = Math.max(0, requestedPaid - totalAmount);
      const amountDue = Math.max(0, totalAmount - amountPaid);
      const paymentStatus =
        data.paymentMethod === "credit"
          ? amountPaid <= 0
            ? "unpaid"
            : amountDue > 0
            ? "partial"
            : "paid"
          : amountDue > 0
          ? "partial"
          : "paid";

      // Validate customer if provided or credit
      let customerId = data.customerId ?? null;
      if ((data.paymentMethod === "credit" || amountDue > 0) && !customerId) {
        throw new Error("Un client est requis pour une vente à crédit");
      }
      if (customerId) {
        const [cust] = await tx
          .select({ id: customers.id, debt: customers.debt })
          .from(customers)
          .where(eq(customers.id, customerId))
          .limit(1);
        if (!cust) throw new Error("Client introuvable");
      }

      // Insert the sale
      const [insertedSale] = await tx
        .insert(sales)
        .values({
          saleNumber: "", // will update after id known
          customerId,
          userId: user.id,
          saleType: data.saleType,
          itemsTotal: String(itemsTotal),
          discountAmount: String(discount),
          taxAmount: "0",
          totalAmount: String(totalAmount),
          totalCost: String(totalCost),
          profit: String(profit),
          paymentMethod: data.paymentMethod,
          paymentStatus: paymentStatus as any,
          amountPaid: String(amountPaid),
          amountDue: String(amountDue),
          notes:
            changeGiven > 0
              ? `${data.notes ? `${data.notes} · ` : ""}Monnaie rendue : ${changeGiven}`
              : data.notes || null,
          isOffline: data.isOffline,
          localId: localId || null,
          deviceId: deviceId || null,
          syncedAt: data.isOffline ? null : new Date(),
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        })
        .returning({ id: sales.id });

      newSaleId = insertedSale.id;

      const saleNumber = generateNumber("V", insertedSale.id);
      await tx
        .update(sales)
        .set({ saleNumber })
        .where(eq(sales.id, insertedSale.id));

      // Insert sale items
      for (const it of preparedItems) {
        await tx.insert(saleItems).values({
          saleId: insertedSale.id,
          productId: it.productId,
          productName: it.productName,
          productSku: it.productSku,
          quantity: it.quantity,
          purchasePriceAtTime: it.purchasePriceAtTime,
          unitPrice: String(it.unitPrice),
          priceType: it.priceType,
          subtotal: it.subtotal,
          subtotalCost: it.subtotalCost,
          profit: it.profit,
        });
      }

      // Update stock
      for (const it of preparedItems) {
        await applyStockChange(tx, {
          productId: it.productId,
          quantity: -it.quantity,
          movementType: "sale",
          referenceType: "sale",
          referenceId: insertedSale.id,
          referenceLocalId: localId,
          userId: user.id,
          note: `Vente ${saleNumber}`,
        });
      }

      // Handle payment
      if (amountPaid > 0) {
        await tx.insert(payments).values({
          paymentableType: "sale",
          paymentableId: insertedSale.id,
          customerId: customerId,
          amount: String(amountPaid),
          method: data.paymentMethod,
          userId: user.id,
          isOffline: data.isOffline,
          localId: localId ? `pay_${localId}` : null,
        });
      }

      // Update customer debt if credit/partial
      if (customerId && amountDue > 0) {
        await tx
          .update(customers)
          .set({
            debt: sql`${customers.debt} + ${String(amountDue)}`,
            totalPurchases: sql`${customers.totalPurchases} + ${String(totalAmount)}`,
          })
          .where(eq(customers.id, customerId));

        await tx.insert(customerDebtLogs).values({
          customerId,
          saleId: insertedSale.id,
          amount: String(amountDue),
          type: "charge",
          note: `Vente ${saleNumber}`,
          userId: user.id,
        });
      } else if (customerId) {
        // Just update total purchases
        await tx
          .update(customers)
          .set({
            totalPurchases: sql`${customers.totalPurchases} + ${String(totalAmount)}`,
          })
          .where(eq(customers.id, customerId));
      }

      await writeAuditLog({
        user,
        action: "create",
        entityType: "sale",
        entityId: insertedSale.id,
        newValues: {
          saleNumber,
          totalAmount,
          items: data.items.length,
        },
        ip: getClientIp(req),
        deviceId: deviceId,
      });
    });

    return jsonSuccess({ id: newSaleId, localId });
  } catch (err: any) {
    console.error("Sale creation error:", err);
    return jsonError(err.message || "Erreur lors de l'enregistrement de la vente", 400);
  }
}
