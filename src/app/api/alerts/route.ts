import { db } from "@/db";
import {
  products,
  categories,
  customers,
  suppliers,
  customerDebtLogs,
  supplierDebtLogs,
  inventories,
  syncOperations,
  storeSettings,
} from "@/db/schema";
import { and, asc, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { requireRole, jsonSuccess } from "@/lib/api-helpers";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Nombre de jours entre une date et aujourd'hui. */
function daysSince(date: Date | string | null): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

/**
 * Centre d'alertes : tout ce qui demande une action du responsable.
 *
 * Regroupe les ruptures, les stocks bas, les dettes clients et fournisseurs,
 * les inventaires laissés en cours et les synchronisations en échec.
 */
export async function GET() {
  // Données sensibles (dettes, prix d'achat) : réservées au bureau.
  const { error } = await requireRole("admin", "manager");
  if (error) return error;

  const [settings] = await db.select().from(storeSettings).limit(1);
  const defaultThreshold = settings?.lowStockThreshold ?? 5;

  // 1. Ruptures de stock (produits actifs à 0)
  const outOfStock = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      categoryName: categories.name,
      stock: products.stock,
      minStock: products.minStock,
      retailPrice: products.retailPrice,
      purchasePrice: products.purchasePrice,
      supplierName: suppliers.name,
      supplierPhone: suppliers.phone,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(and(isNull(products.deletedAt), eq(products.active, true), eq(products.stock, 0)))
    .orderBy(asc(products.name));

  // 2. Stock bas (au-dessus de 0 mais au seuil ou en dessous)
  const lowStock = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      categoryName: categories.name,
      stock: products.stock,
      minStock: products.minStock,
      retailPrice: products.retailPrice,
      purchasePrice: products.purchasePrice,
      supplierName: suppliers.name,
      supplierPhone: suppliers.phone,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(
      and(
        isNull(products.deletedAt),
        eq(products.active, true),
        gt(products.stock, 0),
        sql`${products.stock} <= ${products.minStock}`
      )
    )
    .orderBy(asc(products.stock));

  // 3. Dettes clients, avec l'ancienneté de la plus vieille créance
  const customerRows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      company: customers.company,
      debt: customers.debt,
    })
    .from(customers)
    .where(and(eq(customers.active, true), gt(customers.debt, "0")))
    .orderBy(desc(customers.debt));

  const customerOldest = await db
    .select({
      customerId: customerDebtLogs.customerId,
      oldest: sql<string>`min(${customerDebtLogs.createdAt})`,
    })
    .from(customerDebtLogs)
    .where(eq(customerDebtLogs.type, "charge"))
    .groupBy(customerDebtLogs.customerId);
  const customerOldestBy = new Map(customerOldest.map((r) => [r.customerId, r.oldest]));

  const customerDebts = customerRows.map((c) => ({
    ...c,
    debt: toNumber(c.debt),
    sinceDays: daysSince(customerOldestBy.get(c.id) ?? null),
  }));

  // 4. Dettes fournisseurs
  const supplierRows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      phone: suppliers.phone,
      company: suppliers.company,
      debt: suppliers.debt,
    })
    .from(suppliers)
    .where(and(eq(suppliers.active, true), gt(suppliers.debt, "0")))
    .orderBy(desc(suppliers.debt));

  const supplierOldest = await db
    .select({
      supplierId: supplierDebtLogs.supplierId,
      oldest: sql<string>`min(${supplierDebtLogs.createdAt})`,
    })
    .from(supplierDebtLogs)
    .where(eq(supplierDebtLogs.type, "charge"))
    .groupBy(supplierDebtLogs.supplierId);
  const supplierOldestBy = new Map(supplierOldest.map((r) => [r.supplierId, r.oldest]));

  const supplierDebts = supplierRows.map((s) => ({
    ...s,
    debt: toNumber(s.debt),
    sinceDays: daysSince(supplierOldestBy.get(s.id) ?? null),
  }));

  // 5. Inventaires laissés en cours
  const draftInventories = await db
    .select({
      id: inventories.id,
      inventoryNumber: inventories.inventoryNumber,
      label: inventories.label,
      createdAt: inventories.createdAt,
      categoryName: categories.name,
      total: sql<number>`(select count(*) from inventory_items it where it.inventory_id = ${inventories.id})`,
      counted: sql<number>`(select count(it.counted_stock) from inventory_items it where it.inventory_id = ${inventories.id})`,
    })
    .from(inventories)
    .leftJoin(categories, eq(inventories.categoryId, categories.id))
    .where(eq(inventories.status, "draft"))
    .orderBy(desc(inventories.createdAt));

  // 6. Synchronisations en échec ou en attente
  const syncIssues = await db
    .select({
      id: syncOperations.id,
      localId: syncOperations.localId,
      deviceId: syncOperations.deviceId,
      entityType: syncOperations.entityType,
      status: syncOperations.status,
      attempts: syncOperations.attempts,
      errorMessage: syncOperations.errorMessage,
      createdAt: syncOperations.createdAt,
    })
    .from(syncOperations)
    .where(sql`${syncOperations.status} in ('failed', 'pending')`)
    .orderBy(desc(syncOperations.createdAt))
    .limit(50);

  const lostRevenue = outOfStock.reduce((sum, p) => sum + toNumber(p.retailPrice), 0);
  const restockCost =
    outOfStock.reduce((sum, p) => sum + toNumber(p.purchasePrice) * Number(p.minStock), 0) +
    lowStock.reduce(
      (sum, p) => sum + toNumber(p.purchasePrice) * Math.max(0, Number(p.minStock) - Number(p.stock)),
      0
    );

  const customerDebtTotal = customerDebts.reduce((sum, c) => sum + c.debt, 0);
  const supplierDebtTotal = supplierDebts.reduce((sum, s) => sum + s.debt, 0);

  const criticalCount = outOfStock.length + syncIssues.filter((s) => s.status === "failed").length;
  const warningCount = lowStock.length + customerDebts.length + supplierDebts.length;
  const infoCount = draftInventories.length + syncIssues.filter((s) => s.status === "pending").length;

  return jsonSuccess({
    generatedAt: new Date().toISOString(),
    defaultThreshold,
    counts: {
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
      total: criticalCount + warningCount + infoCount,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      customerDebts: customerDebts.length,
      supplierDebts: supplierDebts.length,
      draftInventories: draftInventories.length,
      syncIssues: syncIssues.length,
    },
    totals: {
      lostRevenue,
      restockCost,
      customerDebtTotal,
      supplierDebtTotal,
    },
    outOfStock: outOfStock.map((p) => ({ ...p, retailPrice: toNumber(p.retailPrice), purchasePrice: toNumber(p.purchasePrice) })),
    lowStock: lowStock.map((p) => ({ ...p, retailPrice: toNumber(p.retailPrice), purchasePrice: toNumber(p.purchasePrice) })),
    customerDebts,
    supplierDebts,
    draftInventories: draftInventories.map((i) => ({
      ...i,
      total: Number(i.total),
      counted: Number(i.counted),
      sinceDays: daysSince(i.createdAt),
    })),
    syncIssues,
  });
}
