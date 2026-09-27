import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { generateBarcode, generateSku, isValidEan13 } from "@/lib/codes";

export const dynamic = "force-dynamic";

/**
 * Régularise les produits sans code-barres valide.
 * Garantit que chaque produit possède un EAN-13 unique, donc un QR code
 * scannable, sans toucher à l'historique des ventes.
 */
export async function POST() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "admin") return jsonError("Accès refusé", 403);

  const all = await db
    .select({ id: products.id, name: products.name, barcode: products.barcode, sku: products.sku })
    .from(products)
    .where(isNull(products.deletedAt));

  const used = new Set(all.map((p) => p.barcode).filter((b): b is string => !!b && isValidEan13(b)));

  const fixed: Array<{ id: number; name: string; from: string | null; to: string }> = [];

  for (const p of all) {
    if (p.barcode && isValidEan13(p.barcode)) continue;

    let candidate = generateBarcode();
    while (used.has(candidate)) candidate = generateBarcode();
    used.add(candidate);

    await db
      .update(products)
      .set({
        barcode: candidate,
        sku: p.sku && p.sku.trim() ? p.sku : generateSku(p.name, p.id),
        updatedAt: new Date(),
      })
      .where(eq(products.id, p.id));

    fixed.push({ id: p.id, name: p.name, from: p.barcode, to: candidate });
  }

  if (fixed.length > 0) {
    await writeAuditLog({
      user,
      action: "fix_barcodes",
      entityType: "product",
      newValues: { count: fixed.length },
      note: "Régularisation des codes-barres / QR codes",
    });
  }

  return jsonSuccess({ fixed: fixed.length, details: fixed });
}
