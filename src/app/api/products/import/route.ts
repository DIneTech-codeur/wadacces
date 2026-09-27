import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { applyStockChange } from "@/lib/stock";
import { generateBarcode, generateSku } from "@/lib/codes";
import { z } from "zod";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  purchasePrice: z.number().nonnegative().default(0),
  retailPrice: z.number().nonnegative().default(0),
  wholesalePrice: z.number().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
  minStock: z.number().int().nonnegative().default(5),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1),
  dryRun: z.boolean().default(false),
});

export async function POST(req: Request) {
  const { user, error } = await requireUser("product.create");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Fichier invalide");

  const issues: Array<{ row: number; name: string; message: string }> = [];
  const preview: Array<{ name: string; barcode?: string | null; stock: number; ok: boolean }> = [];

  const existing = await db
    .select({ id: products.id, barcode: products.barcode, sku: products.sku, name: products.name })
    .from(products)
    .where(isNull(products.deletedAt));

  const barcodes = new Set(existing.map((p) => p.barcode).filter(Boolean) as string[]);
  const skus = new Set(existing.map((p) => p.sku).filter(Boolean) as string[]);

  parsed.data.items.forEach((item, index) => {
    const row = index + 1;
    if (item.barcode && barcodes.has(item.barcode)) {
      issues.push({ row, name: item.name, message: "Code-barres déjà utilisé" });
      preview.push({ name: item.name, barcode: item.barcode, stock: item.stock, ok: false });
      return;
    }
    if (item.sku && skus.has(item.sku)) {
      issues.push({ row, name: item.name, message: "SKU déjà utilisé" });
      preview.push({ name: item.name, barcode: item.barcode, stock: item.stock, ok: false });
      return;
    }
    if (item.barcode) barcodes.add(item.barcode);
    if (item.sku) skus.add(item.sku);
    preview.push({ name: item.name, barcode: item.barcode, stock: item.stock, ok: true });
  });

  if (parsed.data.dryRun) {
    return jsonSuccess({
      total: parsed.data.items.length,
      valid: preview.filter((p) => p.ok).length,
      issues,
      preview,
    });
  }

  const validItems = parsed.data.items.filter((_, i) => preview[i]?.ok);
  let imported = 0;

  try {
    await db.transaction(async (tx) => {
      const cats = await tx.select().from(categories);
      const catMap = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));

      for (const item of validItems) {
        let categoryId: number | null = null;
        if (item.category) {
          const key = item.category.toLowerCase();
          if (catMap.has(key)) {
            categoryId = catMap.get(key)!;
          } else {
            const [createdCat] = await tx.insert(categories).values({ name: item.category }).returning({ id: categories.id });
            categoryId = createdCat.id;
            catMap.set(key, categoryId);
          }
        }

        // Code-barres auto (donc QR code) pour chaque produit importé sans code.
        let barcode = item.barcode || null;
        while (!barcode || barcodes.has(`generated:${barcode}`)) {
          const candidate = generateBarcode();
          if (!barcodes.has(candidate)) {
            barcodes.add(candidate);
            barcode = candidate;
            break;
          }
        }

        const [created] = await tx
          .insert(products)
          .values({
            name: item.name,
            sku: item.sku || generateSku(item.name),
            barcode,
            categoryId,
            brand: item.brand || null,
            model: item.model || null,
            purchasePrice: String(item.purchasePrice),
            retailPrice: String(item.retailPrice),
            wholesalePrice: String(item.wholesalePrice),
            stock: 0,
            minStock: item.minStock,
            active: true,
          })
          .returning({ id: products.id });

        if (item.stock > 0) {
          await applyStockChange(tx, {
            productId: created.id,
            quantity: item.stock,
            movementType: "entry",
            unitCost: item.purchasePrice,
            referenceType: "import",
            userId: user.id,
            note: "Import initial",
          });
        }
        imported++;
      }
    });
  } catch (err: unknown) {
    console.error("Import error", err);
    return jsonError("Impossible d'importer ces produits. Vérifiez le fichier.", 400);
  }

  await writeAuditLog({
    user,
    action: "import",
    entityType: "product",
    newValues: { imported, issues: issues.length },
  });

  return jsonSuccess({ imported, issues });
}
