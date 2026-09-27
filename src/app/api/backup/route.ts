import { db } from "@/db";
import {
  products,
  categories,
  customers,
  suppliers,
  sales,
  saleItems,
  purchases,
  purchaseItems,
  storeSettings,
  users,
} from "@/db/schema";
import { requireUser, jsonError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "admin") return jsonError("Accès refusé", 403);

  const [cats, prods, custs, sups, saleRows, saleItemRows, purchaseRows, purchaseItemRows, settings, userRows] =
    await Promise.all([
      db.select().from(categories),
      db.select().from(products),
      db.select().from(customers),
      db.select().from(suppliers),
      db.select().from(sales),
      db.select().from(saleItems),
      db.select().from(purchases),
      db.select().from(purchaseItems),
      db.select().from(storeSettings),
      db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      }).from(users),
    ]);

  const payload = {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    store: settings[0] || null,
    categories: cats,
    products: prods,
    customers: custs,
    suppliers: sups,
    sales: saleRows,
    saleItems: saleItemRows,
    purchases: purchaseRows,
    purchaseItems: purchaseItemRows,
    users: userRows,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="wadacces-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
