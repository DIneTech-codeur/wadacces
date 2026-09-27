"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Search, Eye, TrendingUp } from "lucide-react";

type Sale = {
  id: number;
  saleNumber: string;
  customerName?: string | null;
  totalAmount: string | number;
  profit: string | number;
  paymentMethod: string;
  paymentStatus: string;
  itemsCount: number | string;
  createdAt: string;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function AdminSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summary, setSummary] = useState({ total: 0, profit: 0, count: 0, items: 0 });
  const pageSize = 50;

  const load = async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(p),
      pageSize: String(pageSize),
    });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const res = await api.get<any>(`/api/sales?${params}`);
    if (res.ok && res.data) {
      setSales(res.data.items);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
      setPage(p);

      // Compute summary
      let tot = 0,
        prof = 0,
        items = 0;
      for (const s of res.data.items) {
        tot += toNum(s.totalAmount);
        prof += toNum(s.profit);
        items += toNum(s.itemsCount);
      }
      setSummary({ total: tot, profit: prof, count: res.data.items.length, items });
    }
    setLoading(false);
  };

  useEffect(() => {
    load(1);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ventes</h1>
        <p className="text-sm text-slate-500">{total} vente(s) au total</p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Date début</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Date fin</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2">
          <button onClick={() => load(1)} className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
            <Search className="h-4 w-4" /> Filtrer
          </button>
          <button
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setTimeout(() => load(1), 0);
            }}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Résultat page" value={formatCurrency(summary.total)} color="bg-blue-500" />
        <SummaryCard label="Bénéfice" value={formatCurrency(summary.profit)} color="bg-teal-500" icon={<TrendingUp className="h-4 w-4" />} />
        <SummaryCard label="Ventes" value={summary.count} color="bg-purple-500" />
        <SummaryCard label="Articles" value={summary.items} color="bg-amber-500" />
      </div>

      <div className="table-scroll rounded-2xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">N°</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3 text-right">Articles</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Bénéfice</th>
              <th className="px-4 py-3">Paiement</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={8} className="py-8 text-center">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && sales.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  Aucune vente
                </td>
              </tr>
            )}
            {sales.map((s) => {
              const total = toNum(s.totalAmount);
              const profit = toNum(s.profit);
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/admin/sales/${s.id}`} className="text-teal-700 hover:underline">
                      {s.saleNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(s.createdAt)}</td>
                  <td className="px-4 py-3">{s.customerName || "—"}</td>
                  <td className="px-4 py-3 text-right">{toNum(s.itemsCount)}</td>
                  <td className="px-4 py-3 text-right font-bold">{formatCurrency(total)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${profit >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {formatCurrency(profit)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.paymentMethod === "cash"
                      ? "💵 Espèces"
                      : s.paymentMethod === "mobile_money"
                      ? "📱 MM"
                      : s.paymentMethod === "transfer"
                      ? "🏦 Virement"
                      : "📝 Crédit"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.paymentStatus === "paid"
                          ? "bg-green-100 text-green-700"
                          : s.paymentStatus === "partial"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.paymentStatus === "paid" ? "Payé" : s.paymentStatus === "partial" ? "Partiel" : "Non payé"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => load(page - 1)}
            disabled={page <= 1}
            className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => load(page + 1)}
            disabled={page >= totalPages}
            className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${color} text-white`}>{icon || ""}</span>
        {label}
      </div>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
