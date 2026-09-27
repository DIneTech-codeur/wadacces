import { api } from "@/lib/client-api";
import { offlineDB, isOnline } from "@/lib/offline-db";

export interface SyncResult {
  ok: boolean;
  synced: number;
  failed: number;
  message: string;
}

export async function pullCatalog(): Promise<void> {
  if (!isOnline()) return;
  const [productsRes, catsRes, settingsRes] = await Promise.all([
    api.get<{ items: unknown[] }>("/api/products?pageSize=5000"),
    api.get<unknown[]>("/api/categories"),
    api.get<unknown>("/api/store-settings"),
  ]);
  if (productsRes.ok && productsRes.data) {
    const items = Array.isArray(productsRes.data)
      ? productsRes.data
      : (productsRes.data as { items?: unknown[] }).items || [];
    await offlineDB.setProducts(items);
  }
  if (catsRes.ok && catsRes.data) {
    await offlineDB.setCategories(catsRes.data as unknown[]);
  }
  if (settingsRes.ok && settingsRes.data) {
    await offlineDB.saveSetting("storeSettings", settingsRes.data);
  }
}

export async function syncPending(): Promise<SyncResult> {
  if (!isOnline()) {
    return { ok: false, synced: 0, failed: 0, message: "Pas de connexion" };
  }

  const pendingSales = (await offlineDB.getPendingSales()).filter((s) => !s.synced);
  const pendingPurchases = (await offlineDB.getPendingPurchases()).filter((p) => !p.synced);

  let synced = 0;
  let failed = 0;

  for (const sale of pendingSales) {
    const res = await api.post("/api/sales", sale);
    if (res.ok) {
      await offlineDB.deletePendingSale(sale.localId);
      synced++;
    } else {
      failed++;
    }
  }

  for (const purchase of pendingPurchases) {
    const res = await api.post("/api/purchases", purchase);
    if (res.ok) {
      await offlineDB.deletePendingPurchase(purchase.localId);
      synced++;
    } else {
      failed++;
    }
  }

  try {
    await pullCatalog();
  } catch {
    // catalog refresh is best-effort
  }

  if (failed > 0) {
    return {
      ok: false,
      synced,
      failed,
      message: `${synced} OK, ${failed} en échec`,
    };
  }
  return {
    ok: true,
    synced,
    failed: 0,
    message: synced > 0 ? "Données synchronisées" : "Tout est à jour",
  };
}

export async function pendingCount(): Promise<number> {
  const sales = await offlineDB.getPendingSales();
  const purchases = await offlineDB.getPendingPurchases();
  return sales.filter((s) => !s.synced).length + purchases.filter((p) => !p.synced).length;
}
