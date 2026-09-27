"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { formatCurrency } from "@/lib/utils";
import { QrCode } from "@/components/qr-code";
import { ArrowLeft, Printer, Search } from "lucide-react";

type Product = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  retailPrice: string | number;
  wholesalePrice: string | number;
  categoryName?: string | null;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function ProductLabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async (query = "") => {
    setLoading(true);
    const res = await api.get<{ items: Product[] }>(
      `/api/products?pageSize=500&q=${encodeURIComponent(query)}`
    );
    if (res.ok && res.data) setProducts(res.data.items);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const withCodes = products.filter((p) => p.barcode);

  return (
    <div>
      <style jsx global>{`
        @media print {
          body {
            background: #fff;
          }
          .no-print {
            display: none !important;
          }
          .label-sheet {
            gap: 0 !important;
          }
          .label-card {
            break-inside: avoid;
            border: 1px dashed #94a3b8 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/admin/products" className="shrink-0 rounded-lg bg-white p-2 shadow">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">Étiquettes QR</h1>
            <p className="text-sm text-slate-500">{withCodes.length} étiquette(s) à imprimer</p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700"
        >
          <Printer className="h-4 w-4" /> Imprimer
        </button>
      </div>

      <form
        className="no-print mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrer les produits à imprimer…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4"
          />
        </div>
        <button type="submit" className="rounded-xl bg-slate-800 px-4 py-2 text-white">
          Filtrer
        </button>
      </form>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : (
        <div className="label-sheet grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {withCodes.map((p) => (
            <div
              key={p.id}
              className="label-card flex flex-col items-center rounded-xl bg-white p-3 text-center shadow-sm"
            >
              <p className="clamp-2 min-h-[36px] text-xs font-bold leading-tight text-slate-900">
                {p.name}
              </p>
              <QrCode value={p.barcode as string} size={110} className="my-2" alt={`QR ${p.name}`} />
              <p className="font-mono text-[10px] tracking-tight text-slate-600">{p.barcode}</p>
              <p className="mt-1 text-sm font-black text-teal-700">
                {formatCurrency(toNum(p.retailPrice))}
              </p>
              <p className="text-[10px] text-slate-500">
                Gros : {formatCurrency(toNum(p.wholesalePrice))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
