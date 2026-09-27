"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatCurrency } from "@/lib/utils";
import { Download, TrendingUp, Package, FileDown } from "lucide-react";
import { generatePdfReport, pdfAmount, pdfNumber } from "@/lib/pdf";

function frDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

function toCSV(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [salesReport, setSalesReport] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [storeName, setStoreName] = useState("WadAcces");

  const periodLabel = () => {
    if (dateFrom && dateTo) return `Période du ${frDate(dateFrom)} au ${frDate(dateTo)}`;
    if (dateFrom) return `Période à partir du ${frDate(dateFrom)}`;
    if (dateTo) return `Période jusqu'au ${frDate(dateTo)}`;
    return "Toutes les ventes depuis l'ouverture";
  };

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const [sRes, stRes] = await Promise.all([
      api.get<any>(`/api/reports/sales?${params}`),
      api.get<any>("/api/reports/stock"),
    ]);
    if (sRes.ok) setSalesReport(sRes.data);
    if (stRes.ok) setStockReport(stRes.data);
    const settings = await api.get<{ storeName: string }>("/api/store-settings");
    if (settings.ok && settings.data?.storeName) setStoreName(settings.data.storeName);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const exportSalesByProduct = () => {
    if (!salesReport) return;
    const csv = toCSV(
      ["Produit", "Quantité vendue", "Chiffre d'affaires", "Coût", "Bénéfice"],
      salesReport.byProduct.map((p: any) => [p.productName, toNum(p.quantity), toNum(p.revenue), toNum(p.cost), toNum(p.profit)])
    );
    downloadCSV("rapport-ventes-par-produit.csv", csv);
  };

  const exportStock = () => {
    if (!stockReport) return;
    const csv = toCSV(
      ["Produit", "Catégorie", "Stock", "Seuil", "Prix achat", "Prix vente", "Valeur stock"],
      stockReport.items.map((p: any) => [
        p.name,
        p.categoryName || "",
        toNum(p.stock),
        toNum(p.minStock),
        toNum(p.purchasePrice),
        toNum(p.retailPrice),
        toNum(p.stockValue),
      ])
    );
    downloadCSV("rapport-stock.csv", csv);
  };

  // --- Exports PDF ---
  const salesPdfSections = () => {
    const products = (salesReport?.byProduct || []) as any[];
    const vendors = (salesReport?.byVendor || []) as any[];
    return [
      {
        title: `Ventes par produit (${products.length})`,
        head: ["Produit", "Qté", "Chiffre d'affaires", "Coût", "Bénéfice"],
        rows: products.map((p) => [
          p.productName,
          pdfNumber(toNum(p.quantity)),
          pdfAmount(toNum(p.revenue)),
          pdfAmount(toNum(p.cost)),
          pdfAmount(toNum(p.profit)),
        ]),
        numericColumns: [1, 2, 3, 4],
        totalRow: [
          "TOTAL",
          pdfNumber(products.reduce((s2, p) => s2 + toNum(p.quantity), 0)),
          pdfAmount(toNum(salesReport?.totals?.revenue)),
          pdfAmount(toNum(salesReport?.totals?.cost)),
          pdfAmount(toNum(salesReport?.totals?.profit)),
        ],
        emptyText: "Aucune vente sur cette période.",
      },
      {
        title: `Ventes par vendeur (${vendors.length})`,
        head: ["Vendeur", "Nb ventes", "Chiffre d'affaires", "Bénéfice", "Marge"],
        rows: vendors.map((v) => {
          const rev = toNum(v.revenue);
          const prof = toNum(v.profit);
          return [
            v.username || "—",
            pdfNumber(toNum(v.salesCount)),
            pdfAmount(rev),
            pdfAmount(prof),
            `${rev > 0 ? ((prof / rev) * 100).toFixed(1) : "0.0"} %`,
          ];
        }),
        numericColumns: [1, 2, 3, 4],
        emptyText: "Aucune vente sur cette période.",
      },
    ];
  };

  const salesKpis = () => {
    const rev = toNum(salesReport?.totals?.revenue);
    const prof = toNum(salesReport?.totals?.profit);
    const nb = toNum(salesReport?.totals?.count);
    return [
      { label: "Chiffre d'affaires", value: pdfAmount(rev) },
      { label: "Coût des marchandises", value: pdfAmount(toNum(salesReport?.totals?.cost)) },
      { label: "Bénéfice", value: pdfAmount(prof), tone: (prof >= 0 ? "good" : "bad") as "good" | "bad" },
      { label: "Nombre de ventes", value: pdfNumber(nb) },
      { label: "Panier moyen", value: pdfAmount(nb > 0 ? rev / nb : 0) },
      { label: "Marge moyenne", value: `${rev > 0 ? ((prof / rev) * 100).toFixed(1) : "0.0"} %` },
    ];
  };

  const exportSalesPdf = () => {
    if (!salesReport) return;
    generatePdfReport({
      fileName: `wadacces-rapport-ventes-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Rapport des ventes et bénéfices",
      subtitle: periodLabel(),
      storeName,
      kpis: salesKpis(),
      sections: salesPdfSections(),
    });
  };

  const stockPdfSection = () => {
    const items = (stockReport?.items || []) as any[];
    return {
      title: `État du stock (${items.length} produits)`,
      head: ["Produit", "Catégorie", "Stock", "Seuil", "Prix vente", "Valeur (achat)"],
      rows: items.map((p) => [
        p.name,
        p.categoryName || "—",
        pdfNumber(toNum(p.stock)),
        pdfNumber(toNum(p.minStock)),
        pdfAmount(toNum(p.retailPrice)),
        pdfAmount(toNum(p.stockValue)),
      ]),
      numericColumns: [2, 3, 4, 5],
      totalRow: ["TOTAL", "", pdfNumber(toNum(stockReport?.totals?.totalStock)), "", "", pdfAmount(toNum(stockReport?.totals?.totalValue))],
      emptyText: "Aucun produit en catalogue.",
      note: `Produits sous le seuil d'alerte : ${toNum(stockReport?.totals?.lowStock)} — Ruptures : ${toNum(stockReport?.totals?.outOfStock)}`,
    };
  };

  const exportStockPdf = () => {
    if (!stockReport) return;
    generatePdfReport({
      fileName: `wadacces-rapport-stock-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Rapport d'état du stock",
      subtitle: `Situation au ${frDate(new Date().toISOString().slice(0, 10))}`,
      storeName,
      kpis: [
        { label: "Articles en stock", value: pdfNumber(toNum(stockReport?.totals?.totalStock)) },
        { label: "Valeur du stock", value: pdfAmount(toNum(stockReport?.totals?.totalValue)) },
        { label: "Stocks bas", value: pdfNumber(toNum(stockReport?.totals?.lowStock)), tone: "warn" as const },
        { label: "Ruptures", value: pdfNumber(toNum(stockReport?.totals?.outOfStock)), tone: "bad" as const },
      ],
      sections: [stockPdfSection()],
    });
  };

  const exportFullPdf = () => {
    if (!salesReport || !stockReport) return;
    generatePdfReport({
      fileName: `wadacces-rapport-complet-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Rapport complet d'activité",
      subtitle: periodLabel(),
      storeName,
      kpis: salesKpis(),
      sections: [...salesPdfSections(), stockPdfSection()],
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rapports</h1>
          <p className="text-sm text-slate-500">Analyse des ventes, du stock et des bénéfices</p>
        </div>
        <button
          onClick={exportFullPdf}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-teal-700"
        >
          <FileDown className="h-4 w-4" /> Rapport complet PDF
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Date début</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Date fin</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button onClick={load} className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">
            Filtrer
          </button>
        </div>
      </div>

      {/* Sales totals */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 [&>*]:min-w-0">
        <StatCard label="Chiffre d'affaires" value={formatCurrency(toNum(salesReport?.totals?.revenue))} color="bg-blue-500" />
        <StatCard label="Coût total" value={formatCurrency(toNum(salesReport?.totals?.cost))} color="bg-slate-500" />
        <StatCard label="Bénéfice" value={formatCurrency(toNum(salesReport?.totals?.profit))} color="bg-green-500" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Nb ventes" value={toNum(salesReport?.totals?.count)} color="bg-purple-500" />
      </div>

      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Ventes par produit</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportSalesPdf} className="flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700">
              <FileDown className="h-4 w-4" /> PDF
            </button>
            <button onClick={exportSalesByProduct} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>
        <div className="table-scroll rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">CA</th>
                <th className="px-3 py-2 text-right">Coût</th>
                <th className="px-3 py-2 text-right">Bénéfice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(salesReport?.byProduct || []).length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400">Aucune donnée</td></tr>
              ) : (
                salesReport.byProduct.map((p: any) => (
                  <tr key={p.productId}>
                    <td className="px-3 py-2 font-medium">{p.productName}</td>
                    <td className="px-3 py-2 text-right">{toNum(p.quantity)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(toNum(p.revenue))}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{formatCurrency(toNum(p.cost))}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700">{formatCurrency(toNum(p.profit))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Ventes par vendeur</h2>
        <div className="table-scroll rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Vendeur</th>
                <th className="px-3 py-2 text-right">Nb ventes</th>
                <th className="px-3 py-2 text-right">CA</th>
                <th className="px-3 py-2 text-right">Bénéfice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(salesReport?.byVendor || []).length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-center text-slate-400">Aucune donnée</td></tr>
              ) : (
                salesReport.byVendor.map((v: any) => (
                  <tr key={v.userId}>
                    <td className="px-3 py-2 font-medium">{v.username || "—"}</td>
                    <td className="px-3 py-2 text-right">{toNum(v.salesCount)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(toNum(v.revenue))}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-700">{formatCurrency(toNum(v.profit))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Rapport de stock</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportStockPdf} className="flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700">
              <FileDown className="h-4 w-4" /> PDF
            </button>
            <button onClick={exportStock} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white hover:bg-slate-700">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4 [&>*]:min-w-0">
          <StatCard label="Stock total" value={toNum(stockReport?.totals?.totalStock)} color="bg-blue-500" icon={<Package className="h-4 w-4" />} />
          <StatCard label="Valeur stock" value={formatCurrency(toNum(stockReport?.totals?.totalValue))} color="bg-green-500" />
          <StatCard label="Stock bas" value={toNum(stockReport?.totals?.lowStock)} color="bg-orange-500" />
          <StatCard label="Rupture" value={toNum(stockReport?.totals?.outOfStock)} color="bg-red-500" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${color} text-white`}>{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
