"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Search, Camera, Minus, Plus, Trash2, X, Check } from "lucide-react";
import { api } from "@/lib/client-api";
import { offlineDB, isOnline } from "@/lib/offline-db";
import { generateLocalId, getDeviceId, speak, playBeep, formatCurrency } from "@/lib/utils";
import { categoryIcon } from "@/lib/category-icons";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Numpad } from "@/components/numpad";
import { pullCatalog } from "@/lib/sync-client";
import type { CartItem, PriceType } from "@/types";

type ProductHit = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  retailPrice: number | string;
  wholesalePrice: number | string;
  stock: number | string;
  categoryName?: string | null;
  purchasePrice: number | string;
  minStock?: number | string;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
}

export default function VendorSellPage() {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [priceType, setPriceType] = useState<PriceType>("retail");
  const [picked, setPicked] = useState<ProductHit | null>(null);
  const [qtyText, setQtyText] = useState("1");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef("");
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((type: "ok" | "err", text: string) => {
    setFlash({ type, text });
    if (type === "ok") {
      playBeep(880, 140);
      speak(text, true);
    } else {
      playBeep(220, 220);
      speak(text, true);
    }
    setTimeout(() => setFlash(null), 2200);
  }, []);

  useEffect(() => {
    pullCatalog().catch(() => {});
  }, []);

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      const offline = await offlineDB.getProducts();
      setResults(offline.slice(0, 40));
      return;
    }
    if (isOnline()) {
      const res = await api.get<ProductHit[]>(`/api/products/search?q=${encodeURIComponent(query)}&limit=40`);
      if (res.ok && res.data) {
        setResults(res.data);
        return;
      }
    }
    setResults(await offlineDB.findProducts(query));
  }, []);

  useEffect(() => {
    runSearch(search);
  }, [search, runSearch]);

  const openProduct = useCallback(
    (p: ProductHit) => {
      if (toNum(p.stock) <= 0) {
        showFlash("err", "Stock insuffisant");
        return;
      }
      setPicked(p);
      setQtyText("1");
      playBeep(620, 80);
    },
    [showFlash]
  );

  const addByBarcode = useCallback(
    async (barcode: string) => {
      let product: ProductHit | undefined = await offlineDB.getProductByBarcode(barcode);
      if (!product && isOnline()) {
        const res = await api.get<ProductHit[]>(`/api/products/search?q=${encodeURIComponent(barcode)}&limit=1`);
        if (res.ok && res.data?.[0]) product = res.data[0];
      }
      if (!product) {
        showFlash("err", "Produit introuvable");
        return;
      }
      openProduct(product);
    },
    [openProduct, showFlash]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLInputElement;
      if (target && target.tagName === "INPUT" && target !== searchInputRef.current) return;
      if (e.key === "Enter") {
        if (barcodeBufferRef.current.length > 3) {
          const code = barcodeBufferRef.current;
          barcodeBufferRef.current = "";
          addByBarcode(code);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        barcodeBufferRef.current += e.key;
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
        barcodeTimerRef.current = setTimeout(() => {
          barcodeBufferRef.current = "";
        }, 180);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [addByBarcode]);

  const unitPriceOf = (p: ProductHit) =>
    priceType === "wholesale" ? toNum(p.wholesalePrice) || toNum(p.retailPrice) : toNum(p.retailPrice);

  const addToCart = (p: ProductHit, quantity: number, sellNow: boolean) => {
    const stockNum = toNum(p.stock);
    if (quantity < 1) {
      showFlash("err", "Quantité incorrecte");
      return;
    }
    if (quantity > stockNum) {
      showFlash("err", "Stock insuffisant");
      return;
    }
    const unitPrice = unitPriceOf(p);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === p.id);
      const already = existing?.quantity || 0;
      if (already + quantity > stockNum) {
        showFlash("err", "Stock insuffisant");
        return prev;
      }
      const next: CartItem[] = existing
        ? prev.map((i) => (i.productId === p.id ? { ...i, quantity: i.quantity + quantity } : i))
        : [
            ...prev,
            {
              productId: p.id,
              name: p.name,
              sku: p.sku,
              barcode: p.barcode,
              quantity,
              unitPrice,
              purchasePrice: toNum(p.purchasePrice),
              priceType,
              stock: stockNum,
            },
          ];
      if (sellNow) {
        queueMicrotask(() => {
          void submitSale(next);
        });
      }
      return next;
    });
    setPicked(null);
    setSearch("");
    playBeep(700, 90);
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const submitSale = async (items = cart) => {
    if (items.length === 0) {
      showFlash("err", "Ajoutez un produit");
      return;
    }
    setProcessing(true);
    try {
      const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      const payload = {
        saleType: priceType === "wholesale" ? "wholesale" : "retail",
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          priceType: i.priceType,
        })),
        paymentMethod: "cash",
        amountPaid: total,
        isOffline: !isOnline(),
        localId: generateLocalId(),
        deviceId: getDeviceId(),
      };

      if (isOnline()) {
        const res = await api.post<{ id: number }>("/api/sales", payload);
        if (!res.ok) throw new Error(res.error || "Erreur");
      } else {
        await offlineDB.addPendingSale({
          ...payload,
          items: items.map((i) => ({
            productId: i.productId,
            productName: i.name,
            productSku: i.sku,
            quantity: i.quantity,
            purchasePriceAtTime: i.purchasePrice,
            unitPrice: i.unitPrice,
            priceType: i.priceType,
          })),
          createdAt: new Date().toISOString(),
          userId: user?.id,
        });
      }
      for (const item of items) {
        await offlineDB.updateProductStock(item.productId, Math.max(0, item.stock - item.quantity));
      }
      setCart([]);
      setSearch("");
      showFlash("ok", "Vente enregistrée");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur lors de la vente";
      showFlash("err", message);
    } finally {
      setProcessing(false);
    }
  };

  const qty = Math.max(1, parseInt(qtyText || "1", 10) || 1);

  return (
    <div>
      {flash && (
        <div
          className={`mb-3 rounded-3xl p-5 text-center text-2xl font-black ${
            flash.type === "ok" ? "bg-green-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {flash.type === "ok" ? "✅ " : "❌ "}
          {flash.text}
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setPriceType("retail")}
          className={`rounded-2xl py-4 text-xl font-black ${
            priceType === "retail" ? "bg-green-600 text-white" : "bg-white text-slate-700"
          }`}
        >
          👤 1
        </button>
        <button
          type="button"
          onClick={() => setPriceType("wholesale")}
          className={`rounded-2xl py-4 text-xl font-black ${
            priceType === "wholesale" ? "bg-green-600 text-white" : "bg-white text-slate-700"
          }`}
        >
          👥 GROS
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white p-2 shadow">
        <Search className="ml-2 h-7 w-7 text-slate-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom ou code…"
          className="flex-1 border-none bg-transparent px-2 py-3 text-xl outline-none"
        />
        <button
          type="button"
          onClick={() => setShowScanner((v) => !v)}
          className="rounded-xl bg-blue-600 p-3 text-white"
        >
          <Camera className="h-7 w-7" />
        </button>
      </div>

      {showScanner && (
        <div className="mb-3 rounded-2xl bg-black p-3">
          <BarcodeScanner
            onDetected={(code) => {
              setShowScanner(false);
              addByBarcode(code);
            }}
          />
          <button
            type="button"
            onClick={() => setShowScanner(false)}
            className="mt-2 w-full rounded-xl bg-white/20 py-3 font-bold text-white"
          >
            Fermer
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {results.slice(0, 24).map((p) => {
          const stock = toNum(p.stock);
          const price = unitPriceOf(p);
          return (
            <button
              key={p.id}
              type="button"
              disabled={stock <= 0}
              onClick={() => openProduct(p)}
              className={`rounded-3xl bg-white p-3 text-left shadow active:scale-95 disabled:opacity-40 ${
                stock === 0 ? "border-4 border-red-500" : stock <= toNum(p.minStock) ? "border-4 border-orange-400" : "border-4 border-transparent"
              }`}
            >
              <div className="text-3xl">{categoryIcon(p.categoryName)}</div>
              <p className="mt-1 line-clamp-2 min-h-[48px] text-base font-black leading-tight text-slate-900">{p.name}</p>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-lg font-black text-teal-700">{formatCurrency(price)}</span>
                <span className={`text-2xl font-black ${stock === 0 ? "text-red-600" : stock <= 5 ? "text-orange-600" : "text-green-700"}`}>
                  {stock}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div className="mt-3 rounded-3xl bg-white p-3 shadow">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-lg font-black">Panier {cartCount}</p>
            <button type="button" onClick={() => setCart([])} className="rounded-xl bg-red-100 px-3 py-2 font-bold text-red-700">
              Vider
            </button>
          </div>
          <ul className="space-y-2">
            {cart.map((item) => (
              <li key={item.productId} className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{item.name}</p>
                  <p className="text-sm font-bold text-teal-700">{formatCurrency(item.unitPrice * item.quantity)}</p>
                </div>
                <button type="button" onClick={() => setCart((c) => c.map((i) => (i.productId === item.productId ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i)))} className="h-12 w-12 rounded-xl bg-slate-200">
                  <Minus className="mx-auto h-6 w-6" />
                </button>
                <span className="w-8 text-center text-2xl font-black">{item.quantity}</span>
                <button type="button" onClick={() => setCart((c) => c.map((i) => (i.productId === item.productId ? { ...i, quantity: Math.min(i.stock, i.quantity + 1) } : i)))} className="h-12 w-12 rounded-xl bg-green-600 text-white">
                  <Plus className="mx-auto h-6 w-6" />
                </button>
                <button type="button" onClick={() => setCart((c) => c.filter((i) => i.productId !== item.productId))} className="text-red-600">
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-3xl font-black text-teal-800">{formatCurrency(cartTotal)}</p>
          <button
            type="button"
            disabled={processing}
            onClick={() => submitSale()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-3xl bg-green-600 py-5 text-3xl font-black text-white shadow-lg active:scale-95 disabled:opacity-60"
          >
            <Check className="h-8 w-8" /> VENDRE
          </button>
        </div>
      )}

      {picked && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/50 p-3 sm:items-center">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-[2rem] bg-slate-100 p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-2xl font-black leading-tight">{picked.name}</p>
                <p className="text-xl font-black text-teal-700">{formatCurrency(unitPriceOf(picked))}</p>
                <p className="text-sm font-bold text-slate-500">Reste {toNum(picked.stock)}</p>
              </div>
              <button type="button" onClick={() => setPicked(null)} className="rounded-full bg-white p-2">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-3 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setQtyText(String(Math.max(1, qty - 1)))} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200">
                <Minus className="h-8 w-8" />
              </button>
              <div className="min-w-[90px] rounded-2xl bg-white py-3 text-center text-5xl font-black">{qty}</div>
              <button type="button" onClick={() => setQtyText(String(Math.min(toNum(picked.stock), qty + 1)))} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-600 text-white">
                <Plus className="h-8 w-8" />
              </button>
            </div>
            <div className="mb-3 grid grid-cols-4 gap-2">
              {[5, 10, 20, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQtyText(String(n))}
                  className="rounded-xl bg-white py-3 text-xl font-black"
                >
                  {n}
                </button>
              ))}
            </div>
            <Numpad
              onDigit={(d) => setQtyText((prev) => {
                const next = (prev === "0" || prev === "1" ? d : prev + d).slice(0, 6);
                return next;
              })}
              onBackspace={() => setQtyText((p) => (p.length <= 1 ? "1" : p.slice(0, -1)))}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addToCart(picked, qty, false)}
                className="rounded-2xl bg-blue-600 py-5 text-xl font-black text-white"
              >
                ➕ ENCORE
              </button>
              <button
                type="button"
                onClick={() => addToCart(picked, qty, true)}
                className="rounded-2xl bg-green-600 py-5 text-xl font-black text-white"
              >
                ✅ VENDRE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
