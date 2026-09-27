"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Package } from "lucide-react";
import { api } from "@/lib/client-api";
import { offlineDB, isOnline } from "@/lib/offline-db";
import { formatCurrency } from "@/lib/utils";
import { categoryIcon } from "@/lib/category-icons";

type Product = {
  id: number;
  name: string;
  stock: number | string;
  minStock: number | string;
  retailPrice: number | string;
  categoryName?: string | null;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function VendorStockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      let list: Product[] = [];
      if (isOnline()) {
        const res = await api.get<{ items: Product[] }>("/api/products?pageSize=2000");
        if (res.ok && res.data?.items) {
          list = res.data.items;
          await offlineDB.setProducts(list);
        }
      }
      if (list.length === 0) list = await offlineDB.getProducts();
      setProducts(list);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return products;
    return products.filter((p) => p.name?.toLowerCase().includes(query));
  }, [products, q]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white p-2 shadow">
        <Search className="ml-2 h-7 w-7 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher…"
          className="flex-1 border-none bg-transparent px-2 py-3 text-xl outline-none"
        />
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white p-10 text-center">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center text-slate-400">
          <Package className="mx-auto mb-2 h-12 w-12" />
          Rien
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.slice(0, 200).map((p) => {
            const stock = toNum(p.stock);
            const min = toNum(p.minStock);
            const tone = stock === 0 ? "bg-red-500 text-white" : stock <= min ? "bg-orange-400 text-white" : "bg-white";
            return (
              <div key={p.id} className={`rounded-3xl p-3 shadow ${tone}`}>
                <div className="text-3xl">{categoryIcon(p.categoryName)}</div>
                <p className="mt-1 line-clamp-2 min-h-[44px] font-black leading-tight">{p.name}</p>
                <p className="mt-2 text-4xl font-black">{stock}</p>
                <p className={`text-sm font-bold ${stock === 0 || stock <= min ? "text-white/90" : "text-slate-500"}`}>
                  {formatCurrency(toNum(p.retailPrice))}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
