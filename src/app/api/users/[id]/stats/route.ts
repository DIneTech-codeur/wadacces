import { db } from "@/db";
import { users, sales, saleItems, customers, purchases, stockMovements, inventories } from "@/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { requireRole, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { toNumber } from "@/lib/utils";
import { parseDays, periodStart, isMonthlyPeriod, fillDailySeries } from "@/lib/performance";

export const dynamic = "force-dynamic";

/** Performance détaillée d'un utilisateur sur une période (administrateur uniquement). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("admin");
  if (error) return error;
  const uid = parseInt((await params).id, 10);
  if (Number.isNaN(uid)) return jsonError("ID invalide");

  const [profile] = await db
    .select({ id: users.id, fullName: users.fullName, role: users.role, active: users.active })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);
  if (!profile) return jsonError("Utilisateur introuvable", 404);

  const days = parseDays(new URL(req.url).searchParams.get("days"));
  const since = periodStart(days);
  const salesFilter = since ? and(eq(sales.userId, uid), gte(sales.createdAt, since)) : eq(sales.userId, uid);

  // 1. Synthèse des ventes
  const [s] = await db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
      cost: sql<string>`coalesce(sum(${sales.totalCost}), 0)`,
      creditGiven: sql<string>`coalesce(sum(${sales.amountDue}), 0)`,
      creditCount: sql<number>`count(*) filter (where ${sales.amountDue} > 0)`,
      offlineCount: sql<number>`count(*) filter (where ${sales.isOffline} = true)`,
      wholesaleCount: sql<number>`count(*) filter (where ${sales.saleType} = 'wholesale')`,
      lastSaleAt: sql<string | null>`max(${sales.createdAt})`,
    })
    .from(sales)
    .where(salesFilter);

  const [items] = await db
    .select({ qty: sql<number>`coalesce(sum(${saleItems.quantity}), 0)` })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(salesFilter);

  const count = Number(s.count);
  const revenue = toNumber(s.revenue);
  const profit = toNumber(s.profit);

  // 2. Évolution dans le temps
  const monthly = isMonthlyPeriod(days);
  const bucketExpr = monthly
    ? sql<string>`to_char(date_trunc('month', ${sales.createdAt}), 'YYYY-MM')`
    : sql<string>`to_char(date_trunc('day', ${sales.createdAt}), 'YYYY-MM-DD')`;
  const rawSeries = await db
    .select({
      bucket: bucketExpr,
      revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(sales)
    .where(salesFilter)
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const normalized = rawSeries.map((r) => ({
    bucket: r.bucket,
    revenue: toNumber(r.revenue),
    profit: toNumber(r.profit),
    count: Number(r.count),
  }));
  const series = !monthly && since ? fillDailySeries(normalized, since) : normalized;

  // 3. Produits les plus vendus par cet utilisateur
  const topProducts = await db
    .select({
      name: saleItems.productName,
      qty: sql<number>`sum(${saleItems.quantity})`,
      revenue: sql<string>`sum(${saleItems.subtotal})`,
      profit: sql<string>`sum(${saleItems.profit})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(salesFilter)
    .groupBy(saleItems.productName)
    .orderBy(desc(sql`sum(${saleItems.quantity})`))
    .limit(5);

  // 4. Moyens de paiement
  const paymentsBreakdown = await db
    .select({
      method: sales.paymentMethod,
      count: sql<number>`count(*)`,
      revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
    })
    .from(sales)
    .where(salesFilter)
    .groupBy(sales.paymentMethod);

  // 5. Dernières ventes
  const recentSales = await db
    .select({
      id: sales.id,
      saleNumber: sales.saleNumber,
      totalAmount: sales.totalAmount,
      profit: sales.profit,
      paymentMethod: sales.paymentMethod,
      paymentStatus: sales.paymentStatus,
      customerName: customers.name,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(salesFilter)
    .orderBy(desc(sales.createdAt))
    .limit(10);

  // 6. Autres activités : réceptions, sorties classées, inventaires
  const [receptions] = await db
    .select({ count: sql<number>`count(*)`, total: sql<string>`coalesce(sum(${purchases.totalAmount}), 0)` })
    .from(purchases)
    .where(since ? and(eq(purchases.userId, uid), gte(purchases.purchaseDate, since)) : eq(purchases.userId, uid));

  const [adjustments] = await db
    .select({ count: sql<number>`count(*)`, units: sql<number>`coalesce(sum(abs(${stockMovements.quantity})), 0)` })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.userId, uid),
        eq(stockMovements.referenceType, "manual_adjust"),
        since ? gte(stockMovements.createdAt, since) : undefined
      )
    );

  const [inventoryCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventories)
    .where(since ? and(eq(inventories.userId, uid), gte(inventories.createdAt, since)) : eq(inventories.userId, uid));

  // 7. Place dans l'équipe sur la même période
  const teamRows = await db
    .select({ userId: sales.userId, revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)` })
    .from(sales)
    .where(since ? gte(sales.createdAt, since) : undefined)
    .groupBy(sales.userId);
  const ranking = teamRows
    .map((r) => ({ userId: r.userId, revenue: toNumber(r.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);
  const teamRevenue = ranking.reduce((sum, r) => sum + r.revenue, 0);
  const rankIndex = ranking.findIndex((r) => r.userId === uid);

  return jsonSuccess({
    profile,
    period: { days, since, monthly },
    summary: {
      count,
      revenue,
      profit,
      cost: toNumber(s.cost),
      itemsSold: Number(items.qty),
      avgBasket: count > 0 ? revenue / count : 0,
      marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
      creditGiven: toNumber(s.creditGiven),
      creditCount: Number(s.creditCount),
      offlineCount: Number(s.offlineCount),
      wholesaleCount: Number(s.wholesaleCount),
      lastSaleAt: s.lastSaleAt,
      share: teamRevenue > 0 ? (revenue / teamRevenue) * 100 : 0,
    },
    series,
    topProducts: topProducts.map((p) => ({
      name: p.name,
      qty: Number(p.qty),
      revenue: toNumber(p.revenue),
      profit: toNumber(p.profit),
    })),
    payments: paymentsBreakdown.map((p) => ({
      method: p.method,
      count: Number(p.count),
      revenue: toNumber(p.revenue),
    })),
    recentSales,
    activity: {
      receptions: Number(receptions.count),
      receptionsTotal: toNumber(receptions.total),
      adjustments: Number(adjustments.count),
      adjustedUnits: Number(adjustments.units),
      inventories: Number(inventoryCount.count),
    },
    team: {
      revenue: teamRevenue,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      sellers: ranking.length,
    },
  });
}
