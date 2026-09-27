"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from "recharts";

type Summary = {
  today: { salesCount: number; revenue: number; profit: number; itemsCount: number };
  month: { salesCount: number; revenue: number; profit: number };
  stock: { totalProducts: number; totalStock: number; stockValue: number; lowStock: number; outOfStock: number };
  recentSales: Array<{
    id: number;
    saleNumber: string;
    totalAmount: string | number;
    profit: string | number;
    paymentMethod: string;
    createdAt: string;
  }>;
  recentMovements: Array<{
    id: number;
    productName: string;
    movementType: string;
    quantity: number;
    createdAt: string;
  }>;
  chart: Array<{ date: string; revenue: string | number; profit: string | number; count: number }>;
  topProducts: Array<{
    productId: number;
    productName: string;
    totalQty: number | string;
    revenue: string | number;
    profit: string | number;
  }>;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function AdminDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.get<Summary>("/api/dashboard/summary");
      if (res.ok && res.data) setData(res.data);
      else setError(res.error || "Erreur de chargement");
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>;
  }

  const chartData = data.chart.map((d) => ({
    date: d.date.slice(5),
    revenue: toNum(d.revenue),
    profit: toNum(d.profit),
    count: toNum(d.count),
  }));

  const stats = [
    {
      label: "Ventes aujourd'hui",
      value: data.today.salesCount,
      icon: ShoppingCart,
      color: "bg-blue-500",
    },
    {
      label: "CA aujourd'hui",
      value: formatCurrency(data.today.revenue),
      icon: DollarSign,
      color: "bg-green-500",
    },
    {
      label: "Bénéfice aujourd'hui",
      value: formatCurrency(data.today.profit),
      icon: TrendingUp,
      color: "bg-teal-500",
    },
    {
      label: "Articles vendus",
      value: data.today.itemsCount,
      icon: Package,
      color: "bg-purple-500",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord</h1>
        <p className="text-sm text-slate-500">Vue d'ensemble de l'activité</p>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{s.label}</p>
                  <p className="mt-2 break-words text-xl font-bold text-slate-900 sm:text-2xl">{s.value}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.color} text-white`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stock summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 [&>*]:min-w-0">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Produits</p>
              <p className="text-xl font-bold">{data.stock.totalProducts}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Valeur du stock</p>
              <p className="text-xl font-bold">{formatCurrency(data.stock.stockValue)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${data.stock.lowStock > 0 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Alertes stock</p>
              <p className="text-xl font-bold">
                {data.stock.lowStock} bas · {data.stock.outOfStock} rupture
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-800">Ventes 7 derniers jours</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: 8 }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="CA" stroke="#0d9488" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" name="Bénéfice" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-800">Top produits du mois</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.topProducts.map((p) => ({
                  name: p.productName.length > 20 ? p.productName.slice(0, 18) + "…" : p.productName,
                  qty: toNum(p.totalQty),
                }))}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" fontSize={12} />
                <YAxis dataKey="name" type="category" fontSize={11} width={100} />
                <Tooltip />
                <Bar dataKey="qty" fill="#0d9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent sales + movements */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-800">Dernières ventes</h3>
            <Link href="/admin/sales" className="text-sm text-teal-600 hover:underline">
              Voir tout
            </Link>
          </div>
          {data.recentSales.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucune vente</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentSales.map((s) => {
                const profit = toNum(s.profit);
                const total = toNum(s.totalAmount);
                return (
                  <li key={s.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{s.saleNumber}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(s.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{formatCurrency(total)}</p>
                      <p className={`flex items-center justify-end gap-1 text-xs ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {profit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {formatCurrency(profit)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-800">Derniers mouvements</h3>
            <Activity className="h-4 w-4 text-slate-400" />
          </div>
          {data.recentMovements.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucun mouvement</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentMovements.slice(0, 8).map((m) => {
                const isEntry = m.quantity > 0;
                return (
                  <li key={m.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{m.productName}</p>
                      <p className="text-xs text-slate-500">
                        {m.movementType} · {formatDateTime(m.createdAt)}
                      </p>
                    </div>
                    <div className={`ml-2 rounded-lg px-2 py-1 text-sm font-bold ${isEntry ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {isEntry ? "+" : ""}
                      {m.quantity}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
