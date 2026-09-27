import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { eq, asc, sql, and, isNull } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireUser("product.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const includeCounts = searchParams.get("include_counts") === "1";

  if (includeCounts) {
    // On récupère les catégories et les comptes séparément. Cette stratégie
    // évite toute ambiguïté de corrélation SQL et garantit un nombre exact.
    const categoryRows = await db
      .select({
        id: categories.id,
        name: categories.name,
        description: categories.description,
        active: categories.active,
        createdAt: categories.createdAt,
      })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.name));

    const countRows = await db
      .select({
        categoryId: products.categoryId,
        productCount: sql<number>`count(*)`,
      })
      .from(products)
      .where(
        and(
          isNull(products.deletedAt),
          eq(products.active, true)
        )
      )
      .groupBy(products.categoryId);

    const countByCategory = new Map<number, number>();
    for (const row of countRows) {
      if (row.categoryId !== null) {
        countByCategory.set(row.categoryId, Number(row.productCount));
      }
    }

    const rows = categoryRows.map((category) => ({
      ...category,
      productCount: countByCategory.get(category.id) ?? 0,
    }));

    return jsonSuccess(rows);
  }

  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.name));
  return jsonSuccess(rows);
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

/** Création réservée à l'administrateur. */
export async function POST(req: Request) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "admin") {
    return jsonError("Seul l'administrateur peut créer une catégorie", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Nom de catégorie requis");
  }

  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, parsed.data.name))
    .limit(1);
  if (existing) {
    return jsonError("Une catégorie avec ce nom existe déjà", 409);
  }

  const [created] = await db
    .insert(categories)
    .values({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .returning();

  await writeAuditLog({
    user,
    action: "create",
    entityType: "category",
    entityId: created.id,
    newValues: created,
  });

  return jsonSuccess(created);
}

/** Liste les produits actifs d'une catégorie. */
export async function listProductsForCategory(categoryId: number) {
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      stock: products.stock,
      retailPrice: products.retailPrice,
      wholesalePrice: products.wholesalePrice,
      purchasePrice: products.purchasePrice,
      minStock: products.minStock,
      active: products.active,
    })
    .from(products)
    .where(
      and(
        eq(products.categoryId, categoryId),
        isNull(products.deletedAt),
        eq(products.active, true)
      )
    )
    .orderBy(asc(products.name));
}
