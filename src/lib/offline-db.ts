/**
 * Offline IndexedDB storage for products, pending operations, and settings.
 */
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "grossiste-offline";
const DB_VERSION = 1;

interface OfflineDBSchema {
  products: { key: number; value: any };
  categories: { key: number; value: any };
  pendingSales: { key: string; value: any };
  pendingPurchases: { key: string; value: any };
  settings: { key: string; value: any };
}

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

function getDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("products")) {
          const store = db.createObjectStore("products", { keyPath: "id" });
          store.createIndex("name", "name");
          store.createIndex("barcode", "barcode", { unique: false });
        }
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("pendingSales")) {
          const s = db.createObjectStore("pendingSales", { keyPath: "localId" });
          s.createIndex("createdAt", "createdAt");
          s.createIndex("synced", "synced");
        }
        if (!db.objectStoreNames.contains("pendingPurchases")) {
          const s = db.createObjectStore("pendingPurchases", { keyPath: "localId" });
          s.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
      },
    });
  }
  return dbPromise;
}

export const offlineDB = {
  async setProducts(products: any[]) {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction("products", "readwrite");
    await tx.objectStore("products").clear();
    for (const p of products) {
      await tx.objectStore("products").put(p);
    }
    await tx.done;
  },
  async getProducts(): Promise<any[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAll("products");
  },
  async getProductByBarcode(barcode: string): Promise<any | undefined> {
    const db = await getDB();
    if (!db) return;
    return db.getFromIndex("products", "barcode", barcode);
  },
  async findProducts(query: string): Promise<any[]> {
    const db = await getDB();
    if (!db) return [];
    const all = await db.getAll("products");
    const q = query.toLowerCase();
    return all
      .filter((p) => {
        if (!p || p.deletedAt) return false;
        if (!p.active) return false;
        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.model?.toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  },
  async updateProductStock(productId: number, newStock: number) {
    const db = await getDB();
    if (!db) return;
    const product = await db.get("products", productId);
    if (product) {
      product.stock = newStock;
      await db.put("products", product);
    }
  },
  async setCategories(cats: any[]) {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction("categories", "readwrite");
    await tx.objectStore("categories").clear();
    for (const c of cats) await tx.objectStore("categories").put(c);
    await tx.done;
  },
  async getCategories(): Promise<any[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAll("categories");
  },
  async addPendingSale(sale: any) {
    const db = await getDB();
    if (!db) return;
    await db.put("pendingSales", { ...sale, synced: false, createdAt: sale.createdAt || new Date().toISOString() });
  },
  async getPendingSales(): Promise<any[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAll("pendingSales");
  },
  async markSaleSynced(localId: string) {
    const db = await getDB();
    if (!db) return;
    const existing = await db.get("pendingSales", localId);
    if (existing) {
      existing.synced = true;
      await db.put("pendingSales", existing);
    }
  },
  async deletePendingSale(localId: string) {
    const db = await getDB();
    if (!db) return;
    await db.delete("pendingSales", localId);
  },
  async addPendingPurchase(purchase: any) {
    const db = await getDB();
    if (!db) return;
    await db.put("pendingPurchases", { ...purchase, synced: false });
  },
  async getPendingPurchases(): Promise<any[]> {
    const db = await getDB();
    if (!db) return [];
    return db.getAll("pendingPurchases");
  },
  async markPurchaseSynced(localId: string) {
    const db = await getDB();
    if (!db) return;
    const p = await db.get("pendingPurchases", localId);
    if (p) {
      p.synced = true;
      await db.put("pendingPurchases", p);
    }
  },
  async deletePendingPurchase(localId: string) {
    const db = await getDB();
    if (!db) return;
    await db.delete("pendingPurchases", localId);
  },
  async saveSetting(key: string, value: any) {
    const db = await getDB();
    if (!db) return;
    await db.put("settings", value, key);
  },
  async getSetting<T = any>(key: string): Promise<T | undefined> {
    const db = await getDB();
    if (!db) return undefined;
    return (await db.get("settings", key)) as T;
  },
};

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function onNetworkChange(cb: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handle = () => cb(navigator.onLine);
  window.addEventListener("online", handle);
  window.addEventListener("offline", handle);
  return () => {
    window.removeEventListener("online", handle);
    window.removeEventListener("offline", handle);
  };
}
