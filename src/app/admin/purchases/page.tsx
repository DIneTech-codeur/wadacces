"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Plus, Download } from "lucide-react";

type Purchase = {
  id: number;
  purchaseNumber: string;
  supplierName?: string | null;
  totalAmount: string | number;
  paymentMethod: string;
  amountDue: string | number;
  purchaseDate: string;
  itemsCount: number | string;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 50;

  const load = async (p = 1) => {
    setLoading(true);
    const res = await api.get<any>(`/api/purchases?page=${p}&pageSize=${pageSize}`);
    if (res.ok && res.data) {
      setPurchases(res.data.items);
      setTotalPages(res.data.pagination.totalPages);
      setPage(p);
    }
    setLoading(false);
  };

  useEffect(() => {
    load(1);
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Achats (entrées de stock)</h1>
        </div>
      </div>

      <div className="table-scroll rounded-2xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">N°</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Fournisseur</th>
              <th className="px-4 py-3 text-right">Articles</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3 text-right">Dû</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="py-8 text-center">Chargement…</td></tr>
            )}
            {!loading && purchases.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-400">Aucun achat. Utilisez la fonction "RECEVOIR" sur l'interface vendeur pour enregistrer une entrée.</td></tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold">{p.purchaseNumber}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(p.purchaseDate)}</td>
                <td className="px-4 py-3">{p.supplierName || "—"}</td>
                <td className="px-4 py-3 text-right">{toNum(p.itemsCount)}</td>
                <td className="px-4 py-3 text-right font-bold">{formatCurrency(toNum(p.totalAmount))}</td>
                <td className="px-4 py-3 text-xs">
                  {p.paymentMethod === "cash" ? "💵 Espèces" : p.paymentMethod === "mobile_money" ? "📱 MM" : p.paymentMethod === "transfer" ? "🏦 Virement" : "📝 Crédit"}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${toNum(p.amountDue) > 0 ? "text-red-600" : "text-slate-500"}`}>
                  {formatCurrency(toNum(p.amountDue))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button onClick={() => load(page - 1)} disabled={page <= 1} className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-50">
            Précédent
          </button>
          <span className="text-sm">Page {page} / {totalPages}</span>
          <button onClick={() => load(page + 1)} disabled={page >= totalPages} className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-50">
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
