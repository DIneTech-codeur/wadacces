import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess, getClientIp } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { applyStockChange } from "@/lib/stock";
import { z } from "zod";

export const dynamic = "force-dynamic";

const adjustSchema = z.object({
  productId: z.number().int().positive(),
  // L'interface envoie une quantité positive. Pour les motifs de sortie,
  // le serveur la convertit lui-même en nombre négatif.
  quantity: z.number().int().positive().optional(),
  // Compatibilité avec l'ancienne API : delta reste accepté.
  delta: z.number().int().optional(),
  reason: z.enum([
    "loss",
    "damaged",
    "return_to_supplier",
    "internal_use",
    "correction",
    "other",
  ]),
  direction: z.enum(["out", "in"]).optional().default("out"),
  note: z.string().min(2).optional().nullable(),
});

const OUTGOING_REASONS = [
  "loss",
  "damaged",
  "return_to_supplier",
  "internal_use",
  "other",
] as const;

const REASON_LABELS: Record<string, string> = {
  loss: "Perte",
  damaged: "Produit endommagé",
  return_to_supplier: "Retour fournisseur",
  internal_use: "Usage interne",
  correction: "Correction de stock",
  other: "Autre sortie",
};

export async function POST(req: Request) {
  const { user, error } = await requireUser("stock.adjust");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Données invalides", 400);
  }

  const { productId, reason, note, direction } = parsed.data;
  const isOutgoingReason = OUTGOING_REASONS.includes(reason as (typeof OUTGOING_REASONS)[number]);

  let stockDelta: number;
  if (parsed.data.quantity !== undefined) {
    // Les motifs endommagé/perte/retour/usage/autre sont toujours des sorties.
    stockDelta = isOutgoingReason
      ? -parsed.data.quantity
      : direction === "in"
      ? parsed.data.quantity
      : -parsed.data.quantity;
  } else if (parsed.data.delta !== undefined) {
    // Ancien appel : on force aussi le signe négatif pour les motifs de sortie.
    stockDelta = isOutgoingReason
      ? -Math.abs(parsed.data.delta)
      : parsed.data.delta;
  } else {
    return jsonError("Quantité requise", 400);
  }

  if (stockDelta === 0) return jsonError("La quantité doit être différente de zéro");
  if (reason === "other" && !note?.trim()) {
    return jsonError("Veuillez expliquer le motif de cette autre sortie", 400);
  }

  try {
    const [product] = await db
      .select({ id: products.id, name: products.name, stock: products.stock, active: products.active })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!product || !product.active) return jsonError("Produit introuvable ou inactif", 404);

    const movementNote = `${REASON_LABELS[reason]}${note?.trim() ? ` — ${note.trim()}` : ""}`;

    const finalResult = await db.transaction(async (tx) => {
      return applyStockChange(tx, {
        productId,
        quantity: stockDelta,
        movementType: reason,
        referenceType: "manual_adjust",
        userId: user.id,
        note: movementNote,
        allowNegative: false,
      });
    });

    await writeAuditLog({
      user,
      action: "adjust_stock",
      entityType: "product",
      entityId: productId,
      newValues: {
        productName: product.name,
        quantity: Math.abs(stockDelta),
        delta: stockDelta,
        reason,
        direction: stockDelta > 0 ? "in" : "out",
        stockBefore: finalResult.stockBefore,
        stockAfter: finalResult.stock,
        note: movementNote,
      },
      ip: getClientIp(req),
    });

    return jsonSuccess({
      ...finalResult,
      productName: product.name,
      quantity: Math.abs(stockDelta),
      delta: stockDelta,
      reason,
      label: REASON_LABELS[reason],
      note: movementNote,
    });
  } catch (err: unknown) {
    return jsonError(err instanceof Error ? err.message : "Erreur lors de l'ajustement", 400);
  }
}
