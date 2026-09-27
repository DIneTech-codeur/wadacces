import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function jsonSuccess<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export async function requireUser(requiredPermission?: string): Promise<
  | { user: SessionUser; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, error: jsonError("Non authentifié", 401) };
  }
  if (requiredPermission) {
    // Use can() logic from auth.ts inline to avoid circular imports
    const can =
      user.role === "admin" ||
      user.role === "manager" ||
      user.permissions.includes(requiredPermission) ||
      [
        "sale.create",
        "sale.view",
        "product.view",
        "stock.view",
        "customer.view",
        "customer.create",
        "purchase.view",
        "purchase.create",
        "sync.access",
      ].includes(requiredPermission);
    if (!can) {
      return { user: null, error: jsonError("Permission refusée", 403) };
    }
  }
  return { user, error: null };
}

/**
 * Restreint une action à certains rôles.
 *
 * Matrice des rôles WadAcces :
 * - admin   : accès total (utilisateurs, paramètres, catégories, suppressions).
 * - manager : consulte, crée et modifie au quotidien (stock, inventaire,
 *             clients, fournisseurs, dettes) mais ne supprime rien et ne
 *             touche pas à la configuration.
 * - vendor  : caisse uniquement.
 */
export async function requireRole(
  ...roles: Array<SessionUser["role"]>
): Promise<{ user: SessionUser; error: null } | { user: null; error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, error: jsonError("Non authentifié", 401) };
  }
  if (!roles.includes(user.role)) {
    const message =
      roles.length === 1 && roles[0] === "admin"
        ? "Action réservée à l'administrateur"
        : "Permission refusée pour votre rôle";
    return { user: null, error: jsonError(message, 403) };
  }
  return { user, error: null };
}

export function parseQuery(q: string | string[] | undefined | null): string | undefined {
  if (!q) return undefined;
  return Array.isArray(q) ? q[0] : q;
}

export function parseQueryInt(q: string | string[] | undefined | null): number | undefined {
  const v = parseQuery(q);
  if (v === undefined) return undefined;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}

export function getClientIp(req: Request): string | undefined {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? undefined;
}
