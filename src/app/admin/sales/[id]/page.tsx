"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api.get<any>(`/api/sales/${params.id}`);
      if (res.ok) setData(res.data);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <div className="p-10 text-center">Chargement…</div>;
  if (!data) return <div>Vente introuvable</div>;

  const { sale, items } = data;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/sales" className="rounded-lg bg-white p-2 shadow">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{sale.saleNumber}</h1>
          <p className="text-sm text-slate-500">{formatDateTime(sale.createdAt)}</p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-xl font-bold">{formatCurrency(toNum(sale.totalAmount))}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Bénéfice</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(toNum(sale.profit))}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Client</p>
          <p className="text-lg font-bold">{sale.customerName || "Comptant"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Vendeur</p>
          <p className="text-lg font-bold">{sale.userName || "—"}</p>
        </div>
      </div>
      <div className="table-scroll rounded-2xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3 text-right">Qté</th>
              <th className="px-4 py-3 text-right">Prix</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Marge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it: any) => (
              <tr key={it.id}>
                <td className="px-4 py-3 font-medium">{it.productName}</td>
                <td className="px-4 py-3 text-right">{it.quantity}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(toNum(it.unitPrice))}</td>
                <td className="px-4 py-3 text-right font-bold">{formatCurrency(toNum(it.subtotal))}</td>
                <td className="px-4 py-3 text-right text-green-700">{formatCurrency(toNum(it.profit))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
