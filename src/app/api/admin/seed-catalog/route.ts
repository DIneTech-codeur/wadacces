import { db } from "@/db";
import { products, categories, suppliers, customers } from "@/db/schema";
import { eq, isNull, and, sql } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { applyStockChange } from "@/lib/stock";
import { generateBarcode, generateSku } from "@/lib/codes";
import { CATALOG_PRODUCTS, CATALOG_SUPPLIERS, CATALOG_CUSTOMERS } from "@/db/catalog";

export const dynamic = "force-dynamic";

/**
 * Charge le catalogue de démarrage WadAcces.
 * Idempotent : un produit déjà présent (même nom) n'est jamais dupliqué.
 * Chaque produit reçoit un code-barres EAN-13 unique servant de QR code,
 * et son stock initial passe par un vrai mouvement de stock traçable.
 */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "admin") {
    return jsonError("Seul l'administrateur peut charger le catalogue", 403);
  }

  const result = {
    suppliers: 0,
    customers: 0,
    categories: 0,
    products: 0,
    skipped: 0,
  };

  try {
    // 1. Fournisseurs
    const supplierIds = new Map<string, number>();
    for (const s of CATALOG_SUPPLIERS) {
      const [existing] = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.name, s.name))
        .limit(1);
      if (existing) {
        supplierIds.set(s.name, existing.id);
        continue;
      }
      const [created] = await db
        .insert(suppliers)
        .values({
          name: s.name,
          company: s.company,
          phone: s.phone,
          address: s.address,
          notes: s.notes,
        })
        .returning({ id: suppliers.id });
      supplierIds.set(s.name, created.id);
      result.suppliers++;
    }

    // 2. Clients
    for (const c of CATALOG_CUSTOMERS) {
      const [existing] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.name, c.name))
        .limit(1);
      if (existing) continue;
      await db.insert(customers).values({
        name: c.name,
        phone: c.phone,
        company: c.company ?? null,
        address: c.address,
        type: c.type,
        notes: c.notes,
      });
      result.customers++;
    }

    // 3. Catégories
    const categoryIds = new Map<string, number>();
    const neededCategories = [...new Set(CATALOG_PRODUCTS.map((p) => p.category))];
    for (const name of neededCategories) {
      const [existing] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, name))
        .limit(1);
      if (existing) {
        categoryIds.set(name, existing.id);
        continue;
      }
      const [created] = await db
        .insert(categories)
        .values({ name })
        .returning({ id: categories.id });
      categoryIds.set(name, created.id);
      result.categories++;
    }

    // 4. Produits + stock initial tracé
    const usedBarcodes = new Set(
      (await db.select({ barcode: products.barcode }).from(products))
        .map((r) => r.barcode)
        .filter(Boolean) as string[]
    );

    for (const p of CATALOG_PRODUCTS) {
      const [existing] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.name, p.name), isNull(products.deletedAt)))
        .limit(1);
      if (existing) {
        result.skipped++;
        continue;
      }

      let barcode = generateBarcode();
      while (usedBarcodes.has(barcode)) barcode = generateBarcode();
      usedBarcodes.add(barcode);

      await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(products)
          .values({
            name: p.name,
            sku: generateSku(p.name),
            barcode,
            categoryId: categoryIds.get(p.category) ?? null,
            supplierId: p.supplier ? supplierIds.get(p.supplier) ?? null : null,
            brand: p.brand,
            model: p.model ?? null,
            compatibility: p.compatibility ?? null,
            purchasePrice: String(p.purchasePrice),
            retailPrice: String(p.retailPrice),
            wholesalePrice: String(p.wholesalePrice),
            stock: 0,
            minStock: p.minStock,
            location: p.location ?? null,
            active: true,
          })
          .returning({ id: products.id });

        if (p.stock > 0) {
          await applyStockChange(tx, {
            productId: created.id,
            quantity: p.stock,
            movementType: "entry",
            unitCost: p.purchasePrice,
            referenceType: "catalog_init",
            userId: user.id,
            note: "Stock initial catalogue WadAcces",
          });
        }
      });

      result.products++;
    }

    await writeAuditLog({
      user,
      action: "seed_catalog",
      entityType: "product",
      newValues: result,
      note: "Chargement du catalogue de démarrage WadAcces",
    });

    return jsonSuccess(result);
  } catch (err: unknown) {
    console.error("Seed catalog error:", err);
    return jsonError("Impossible de charger le catalogue. Réessayez.", 500);
  }
}

/** Indique si le catalogue est déjà chargé. */
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(products)
    .where(isNull(products.deletedAt));
  return jsonSuccess({ productCount: Number(row?.c ?? 0) });
}
