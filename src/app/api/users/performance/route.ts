import { db } from "@/db";
import { users, sales, saleItems, purchases, stockMovements } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireRole, jsonSuccess } from "@/lib/api-helpers";
import { toNumber } from "@/lib/utils";
import { parseDays, periodStart } from "@/lib/performance";

export const dynamic = "force-dynamic";

/** Comparaison des performances de toute l'équipe sur une période (administrateur uniquement). */
export async function GET(req: Request) {
  const { error } = await requireRole("admin");
  if (error) return error;

  const days = parseDays(new URL(req.url).searchParams.get("days"));
  const since = periodStart(days);

  const members = await db
    .select({ id: users.id, fullName: users.fullName, role: users.role, active: users.active })
    .from(users);

  const salesAgg = await db
    .select({
      userId: sales.userId,
      count: sql<number>`count(*)`,
      revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
      creditGiven: sql<string>`coalesce(sum(${sales.amountDue}), 0)`,
      offlineCount: sql<number>`count(*) filter (where ${sales.isOffline} = true)`,
      lastSaleAt: sql<string | null>`max(${sales.createdAt})`,
    })
    .from(sales)
    .where(since ? gte(sales.createdAt, since) : undefined)
    .groupBy(sales.userId);

  const itemsAgg = await db
    .select({ userId: sales.userId, qty: sql<number>`coalesce(sum(${saleItems.quantity}), 0)` })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(since ? gte(sales.createdAt, since) : undefined)
    .groupBy(sales.userId);

  const purchasesAgg = await db
    .select({ userId: purchases.userId, count: sql<number>`count(*)` })
    .from(purchases)
    .where(since ? gte(purchases.purchaseDate, since) : undefined)
    .groupBy(purchases.userId);

  const adjAgg = await db
    .select({ userId: stockMovements.userId, count: sql<number>`count(*)` })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.referenceType, "manual_adjust"),
        since ? gte(stockMovements.createdAt, since) : undefined
      )
    )
    .groupBy(stockMovements.userId);

  const salesBy = new Map(salesAgg.map((r) => [r.userId, r]));
  const itemsBy = new Map(itemsAgg.map((r) => [r.userId, Number(r.qty)]));
  const purchasesBy = new Map(purchasesAgg.map((r) => [r.userId, Number(r.count)]));
  const adjBy = new Map(adjAgg.map((r) => [r.userId, Number(r.count)]));

  const rows = members
    .map((m) => {
      const s = salesBy.get(m.id);
      const count = Number(s?.count ?? 0);
      const revenue = toNumber(s?.revenue);
      const profit = toNumber(s?.profit);
      return {
        ...m,
        count,
        revenue,
        profit,
        itemsSold: itemsBy.get(m.id) ?? 0,
        avgBasket: count > 0 ? revenue / count : 0,
        marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
        creditGiven: toNumber(s?.creditGiven),
        offlineCount: Number(s?.offlineCount ?? 0),
        receptions: purchasesBy.get(m.id) ?? 0,
        adjustments: adjBy.get(m.id) ?? 0,
        lastSaleAt: s?.lastSaleAt ?? null,
      };
    })
    // On affiche les comptes actifs, et les anciens comptes s'ils ont vendu sur la période.
    .filter((r) => r.active || r.count > 0)
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count);

  const team = rows.reduce(
    (acc, r) => {
      acc.count += r.count;
      acc.revenue += r.revenue;
      acc.profit += r.profit;
      acc.itemsSold += r.itemsSold;
      return acc;
    },
    { count: 0, revenue: 0, profit: 0, itemsSold: 0 }
  );

  return jsonSuccess({
    period: { days, since },
    team: {
      ...team,
      avgBasket: team.count > 0 ? team.revenue / team.count : 0,
      marginPct: team.revenue > 0 ? (team.profit / team.revenue) * 100 : 0,
    },
    members: rows.map((r, index) => ({
      ...r,
      rank: r.count > 0 ? index + 1 : null,
      share: team.revenue > 0 ? (r.revenue / team.revenue) * 100 : 0,
    })),
  });
}
