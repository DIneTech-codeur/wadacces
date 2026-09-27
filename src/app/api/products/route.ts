import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, categories, suppliers } from "@/db/schema";
import { eq, desc, asc, like, or, and, isNull, sql, ilike } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess, parseQuery, parseQueryInt } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { generateBarcode, generateSku } from "@/lib/codes";
import { applyStockChange } from "@/lib/stock";
import { z } from "zod";

export const dynamic = "force-dynamic";

const productSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  supplierId: z.number().int().positive().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  compatibility: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  purchasePrice: z.number().nonnegative().default(0),
  retailPrice: z.number().nonnegative().default(0),
  wholesalePrice: z.number().nonnegative().default(0),
  specialPrice: z.number().nonnegative().optional().nullable(),
  promotionalPrice: z.number().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative().default(0),
  minStock: z.number().int().nonnegative().default(5),
  location: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

export async function GET(req: Request) {
  const { error } = await requireUser("product.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const query = parseQuery(searchParams.get("q"));
  const page = parseQueryInt(searchParams.get("page")) ?? 1;
  const pageSize = parseQueryInt(searchParams.get("pageSize")) ?? 50;
  const categoryId = parseQueryInt(searchParams.get("categoryId"));
  const lowStock = searchParams.get("lowStock") === "1";
  const outOfStock = searchParams.get("outOfStock") === "1";
  const activeOnly = searchParams.get("activeOnly") !== "0";
  const includeInactive = searchParams.get("includeInactive") === "1";

  const offset = (page - 1) * pageSize;

  const filters: any[] = [isNull(products.deletedAt)];
  if (activeOnly && !includeInactive) filters.push(eq(products.active, true));
  if (categoryId) filters.push(eq(products.categoryId, categoryId));
  if (lowStock) {
    filters.push(sql`${products.stock} <= ${products.minStock}`);
  }
  if (outOfStock) {
    filters.push(eq(products.stock, 0));
  }
  if (query) {
    const q = `%${query}%`;
    filters.push(
      or(
        ilike(products.name, q),
        ilike(products.sku, q),
        ilike(products.barcode, q),
        ilike(products.brand, q),
        ilike(products.model, q)
      )
    );
  }

  const whereClause = and(...filters);

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      categoryId: products.categoryId,
      categoryName: categories.name,
      supplierId: products.supplierId,
      supplierName: suppliers.name,
      brand: products.brand,
      model: products.model,
      imageUrl: products.imageUrl,
      purchasePrice: products.purchasePrice,
      retailPrice: products.retailPrice,
      wholesalePrice: products.wholesalePrice,
      specialPrice: products.specialPrice,
      promotionalPrice: products.promotionalPrice,
      stock: products.stock,
      minStock: products.minStock,
      location: products.location,
      active: products.active,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(whereClause)
    .orderBy(asc(products.name))
    .limit(pageSize)
    .offset(offset);

  const countResult = await db
    .select({ c: sql<number>`count(*)` })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(whereClause);

  const total = Number(countResult[0]?.c ?? 0);

  return jsonSuccess({
    items: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}

export async function POST(req: Request) {
  const { user, error } = await requireUser("product.create");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Données invalides");
  }

  const data = parsed.data;

  // Check barcode uniqueness
  if (data.barcode) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.barcode, data.barcode), isNull(products.deletedAt)))
      .limit(1);
    if (existing) {
      return jsonError("Un produit avec ce code-barres existe déjà", 409);
    }
  }

  // Code-barres automatique (EAN-13 interne) si aucun n'est fourni.
  // Ce code sert aussi de contenu au QR code du produit.
  let barcode = data.barcode || null;
  if (!barcode) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateBarcode();
      const [clash] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.barcode, candidate))
        .limit(1);
      if (!clash) {
        barcode = candidate;
        break;
      }
    }
  }

  // Le stock initial doit passer par un mouvement traçable :
  // on crée le produit à 0 puis on enregistre une entrée.
  const created = await db.transaction(async (tx) => {
  const [row] = await tx
    .insert(products)
    .values({
      name: data.name,
      sku: data.sku || generateSku(data.name),
      barcode,
      categoryId: data.categoryId || null,
      supplierId: data.supplierId || null,
      brand: data.brand || null,
      model: data.model || null,
      compatibility: data.compatibility || null,
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      purchasePrice: String(data.purchasePrice),
      retailPrice: String(data.retailPrice),
      wholesalePrice: String(data.wholesalePrice),
      specialPrice: data.specialPrice !== null && data.specialPrice !== undefined ? String(data.specialPrice) : null,
      promotionalPrice: data.promotionalPrice !== null && data.promotionalPrice !== undefined ? String(data.promotionalPrice) : null,
      stock: 0,
      minStock: data.minStock,
      location: data.location || null,
      active: data.active,
    })
    .returning();

    if (data.stock > 0) {
      await applyStockChange(tx, {
        productId: row.id,
        quantity: data.stock,
        movementType: "entry",
        unitCost: data.purchasePrice,
        referenceType: "product_init",
        userId: user.id,
        note: "Stock initial à la création du produit",
      });
      row.stock = data.stock;
    }

    return row;
  });

  await writeAuditLog({
    user,
    action: "create",
    entityType: "product",
    entityId: created.id,
    newValues: created,
  });

  return jsonSuccess(created);
}
