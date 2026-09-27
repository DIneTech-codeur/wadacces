"use client";
import { useCallback, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Plus, Minus, Search, Trash2, Download, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { offlineDB, isOnline } from "@/lib/offline-db";
import { generateLocalId, getDeviceId, formatCurrency, speak, playBeep } from "@/lib/utils";
import { categoryIcon } from "@/lib/category-icons";
import { Numpad } from "@/components/numpad";

type ProductHit = {
  id: number;
  name: string;
  purchasePrice: number | string;
  stock: number | string;
  categoryName?: string | null;
};

type EntryItem = { productId: number; name: string; quantity: number; unitCost: number };

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function VendorReceivePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<EntryItem[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [processing, setProcessing] = useState(false);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [picked, setPicked] = useState<ProductHit | null>(null);
  const [qtyText, setQtyText] = useState("1");

  const showFlash = (type: "ok" | "err", text: string) => {
    setFlash({ type, text });
    if (type === "ok") {
      playBeep(880, 140);
      speak(text, true);
    } else playBeep(220, 220);
    setTimeout(() => setFlash(null), 2200);
  };

  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (isOnline()) {
      const res = await api.get<ProductHit[]>(`/api/products/search?q=${encodeURIComponent(query)}&limit=20`);
      if (res.ok && res.data) setResults(res.data);
    } else {
      setResults(await offlineDB.findProducts(query));
    }
  }, []);

  const addItem = (p: ProductHit, quantity: number) => {
    const cost = toNum(p.purchasePrice);
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      if (existing) return prev.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + quantity } : i));
      return [...prev, { productId: p.id, name: p.name, quantity, unitCost: cost }];
    });
    playBeep(500, 80);
    setPicked(null);
    setSearch("");
    setResults([]);
  };

  const total = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const qty = Math.max(1, parseInt(qtyText || "1", 10) || 1);

  const submit = async () => {
    if (items.length === 0) {
      showFlash("err", "Ajoutez un produit");
      return;
    }
    setProcessing(true);
    try {
      const payload = {
        supplierId: null,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
        paymentMethod: "cash",
        amountPaid: total,
        isOffline: !isOnline(),
        localId: generateLocalId(),
        deviceId: getDeviceId(),
        purchaseDate: new Date().toISOString(),
        updateProductPrice: true,
      };
      if (isOnline()) {
        const res = await api.post("/api/purchases", payload);
        if (!res.ok) throw new Error(res.error || "Erreur");
      } else {
        await offlineDB.addPendingPurchase({
          ...payload,
          items: items.map((i) => ({
            productId: i.productId,
            productName: i.name,
            quantity: i.quantity,
            unitCost: i.unitCost,
          })),
          createdAt: new Date().toISOString(),
          userId: user?.id,
        });
      }
      for (const i of items) {
        const existing = (await offlineDB.getProducts()).find((p) => p.id === i.productId);
        if (existing) await offlineDB.updateProductStock(i.productId, toNum(existing.stock) + i.quantity);
      }
      showFlash("ok", "Entrée enregistrée");
      setItems([]);
    } catch (e: unknown) {
      showFlash("err", e instanceof Error ? e.message : "Erreur");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      {flash && (
        <div className={`mb-3 rounded-3xl p-5 text-center text-2xl font-black ${flash.type === "ok" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {flash.text}
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white p-2 shadow">
        <Search className="ml-2 h-7 w-7 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            searchProducts(e.target.value);
          }}
          placeholder="Quel produit arrive ?"
          className="flex-1 border-none bg-transparent px-2 py-3 text-xl outline-none"
        />
      </div>

      {results.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPicked(p);
                setQtyText("1");
              }}
              className="rounded-3xl bg-white p-3 text-left shadow"
            >
              <div className="text-3xl">{categoryIcon(p.categoryName)}</div>
              <p className="mt-1 line-clamp-2 font-black">{p.name}</p>
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-3xl bg-white p-3 shadow">
          {items.map((item) => (
            <div key={item.productId} className="mb-2 flex items-center gap-2 rounded-2xl bg-slate-50 p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-black">{item.name}</p>
                <p className="text-sm font-bold text-teal-700">{formatCurrency(item.quantity * item.unitCost)}</p>
              </div>
              <button type="button" onClick={() => setItems((p) => p.map((i) => (i.productId === item.productId ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i)))} className="h-12 w-12 rounded-xl bg-slate-200">
                <Minus className="mx-auto h-6 w-6" />
              </button>
              <span className="w-8 text-center text-2xl font-black">{item.quantity}</span>
              <button type="button" onClick={() => setItems((p) => p.map((i) => (i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i)))} className="h-12 w-12 rounded-xl bg-amber-500 text-white">
                <Plus className="mx-auto h-6 w-6" />
              </button>
              <button type="button" onClick={() => setItems((p) => p.filter((i) => i.productId !== item.productId))} className="text-red-600">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
          <p className="mt-2 text-center text-3xl font-black">{formatCurrency(total)}</p>
          <button
            type="button"
            disabled={processing}
            onClick={submit}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-3xl bg-amber-500 py-5 text-3xl font-black text-white active:scale-95 disabled:opacity-60"
          >
            <Download className="h-8 w-8" /> ENTRÉE
          </button>
        </div>
      )}

      {picked && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50 p-3">
          <div className="w-full rounded-[2rem] bg-slate-100 p-4">
            <div className="mb-2 flex justify-between">
              <p className="text-2xl font-black">{picked.name}</p>
              <button type="button" onClick={() => setPicked(null)} className="rounded-full bg-white p-2">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-3 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setQtyText(String(Math.max(1, qty - 1)))} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200">
                <Minus className="h-8 w-8" />
              </button>
              <div className="min-w-[90px] rounded-2xl bg-white py-3 text-center text-5xl font-black">{qty}</div>
              <button type="button" onClick={() => setQtyText(String(qty + 1))} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white">
                <Plus className="h-8 w-8" />
              </button>
            </div>
            <Numpad
              onDigit={(d) => setQtyText((prev) => (prev === "1" ? d : (prev + d).slice(0, 6)))}
              onBackspace={() => setQtyText((p) => (p.length <= 1 ? "1" : p.slice(0, -1)))}
            />
            <button
              type="button"
              onClick={() => addItem(picked, qty)}
              className="mt-3 w-full rounded-2xl bg-amber-500 py-5 text-2xl font-black text-white"
            >
              ➕ AJOUTER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
