"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { generatePdfReport, pdfAmount, pdfNumber } from "@/lib/pdf";
import {
  AlertTriangle,
  Ban,
  BellRing,
  CheckCircle2,
  ClipboardList,
  FileDown,
  Phone,
  RefreshCw,
  TrendingDown,
  Users,
  Truck,
  WifiOff,
} from "lucide-react";

type StockAlert = {
  id: number;
  name: string;
  sku: string | null;
  categoryName: string | null;
  stock: number;
  minStock: number;
  retailPrice: number;
  purchasePrice: number;
  supplierName: string | null;
  supplierPhone: string | null;
};

type DebtAlert = {
  id: number;
  name: string;
  phone: string | null;
  company: string | null;
  debt: number;
  sinceDays: number | null;
};

type DraftInventory = {
  id: number;
  inventoryNumber: string;
  label: string | null;
  categoryName: string | null;
  total: number;
  counted: number;
  sinceDays: number | null;
  createdAt: string;
};

type SyncIssue = {
  id: number;
  localId: string;
  deviceId: string;
  entityType: string;
  status: string;
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
};

type AlertsData = {
  generatedAt: string;
  counts: {
    critical: number;
    warning: number;
    info: number;
    total: number;
    outOfStock: number;
    lowStock: number;
    customerDebts: number;
    supplierDebts: number;
    draftInventories: number;
    syncIssues: number;
  };
  totals: { lostRevenue: number; restockCost: number; customerDebtTotal: number; supplierDebtTotal: number };
  outOfStock: StockAlert[];
  lowStock: StockAlert[];
  customerDebts: DebtAlert[];
  supplierDebts: DebtAlert[];
  draftInventories: DraftInventory[];
  syncIssues: SyncIssue[];
};

type TabKey = "all" | "outOfStock" | "lowStock" | "customerDebts" | "supplierDebts" | "draftInventories" | "syncIssues";

function ageLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "depuis 1 jour";
  return `depuis ${days} jours`;
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [storeName, setStoreName] = useState("WadAcces");

  const load = useCallback(async () => {
    setLoading(true);
    const [alertsRes, settingsRes] = await Promise.all([
      api.get<AlertsData>("/api/alerts"),
      api.get<{ storeName: string }>("/api/store-settings"),
    ]);
    if (alertsRes.ok && alertsRes.data) setData(alertsRes.data);
    if (settingsRes.ok && settingsRes.data?.storeName) setStoreName(settingsRes.data.storeName);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const exportPdf = () => {
    if (!data) return;
    const c = data.counts;
    generatePdfReport({
      fileName: `wadacces-alertes-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Rapport d'alertes",
      subtitle: `${c.total} alerte(s) — ${c.critical} critique(s), ${c.warning} à surveiller, ${c.info} information(s)`,
      storeName,
      kpis: [
        { label: "Ruptures de stock", value: pdfNumber(c.outOfStock), tone: c.outOfStock > 0 ? "bad" : "good" },
        { label: "Stocks bas", value: pdfNumber(c.lowStock), tone: c.lowStock > 0 ? "warn" : "good" },
        { label: "Dettes clients", value: pdfAmount(data.totals.customerDebtTotal), tone: data.totals.customerDebtTotal > 0 ? "warn" : "good" },
        { label: "Dettes fournisseurs", value: pdfAmount(data.totals.supplierDebtTotal), tone: data.totals.supplierDebtTotal > 0 ? "warn" : "good" },
      ],
      sections: [
        {
          title: `Ruptures de stock (${data.outOfStock.length})`,
          head: ["Produit", "Catégorie", "Seuil", "Fournisseur", "Téléphone"],
          rows: data.outOfStock.map((p) => [
            p.name,
            p.categoryName ?? "—",
            pdfNumber(p.minStock),
            p.supplierName ?? "—",
            p.supplierPhone ?? "—",
          ]),
          numericColumns: [2],
          emptyText: "Aucune rupture : tous les produits sont disponibles.",
          note: data.outOfStock.length > 0 ? `Réapprovisionnement estimé : ${pdfAmount(data.totals.restockCost)}` : undefined,
        },
        {
          title: `Stocks bas (${data.lowStock.length})`,
          head: ["Produit", "Catégorie", "Restant", "Seuil", "À commander"],
          rows: data.lowStock.map((p) => [
            p.name,
            p.categoryName ?? "—",
            pdfNumber(p.stock),
            pdfNumber(p.minStock),
            pdfNumber(Math.max(0, p.minStock - p.stock)),
          ]),
          numericColumns: [2, 3, 4],
          emptyText: "Aucun produit sous son seuil d'alerte.",
        },
        {
          title: `Dettes clients (${data.customerDebts.length})`,
          head: ["Client", "Téléphone", "Ancienneté", "Montant dû"],
          rows: data.customerDebts.map((c2) => [c2.name, c2.phone ?? "—", ageLabel(c2.sinceDays), pdfAmount(c2.debt)]),
          numericColumns: [3],
          totalRow: ["TOTAL", "", "", pdfAmount(data.totals.customerDebtTotal)],
          emptyText: "Aucun client endetté.",
        },
        {
          title: `Dettes fournisseurs (${data.supplierDebts.length})`,
          head: ["Fournisseur", "Téléphone", "Ancienneté", "Montant à payer"],
          rows: data.supplierDebts.map((s) => [s.name, s.phone ?? "—", ageLabel(s.sinceDays), pdfAmount(s.debt)]),
          numericColumns: [3],
          totalRow: ["TOTAL", "", "", pdfAmount(data.totals.supplierDebtTotal)],
          emptyText: "Aucune dette fournisseur.",
        },
        {
          title: `Inventaires en cours (${data.draftInventories.length})`,
          head: ["Inventaire", "Portée", "Comptés", "Ouvert"],
          rows: data.draftInventories.map((i) => [
            i.label || i.inventoryNumber,
            i.categoryName ?? "Toute la boutique",
            `${i.counted} / ${i.total}`,
            ageLabel(i.sinceDays),
          ]),
          emptyText: "Aucun inventaire en attente de finalisation.",
        },
      ],
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl bg-red-50 p-4 text-red-700">Impossible de charger les alertes.</div>;
  }

  const c = data.counts;
  const allClear = c.total === 0;

  const cards = [
    {
      key: "outOfStock" as TabKey,
      label: "Ruptures",
      value: c.outOfStock,
      hint: c.outOfStock > 0 ? "Produits à 0" : "Tout est en stock",
      icon: Ban,
      tone: "border-red-300 bg-red-50 text-red-800",
      ring: "ring-2 ring-red-500",
    },
    {
      key: "lowStock" as TabKey,
      label: "Stocks bas",
      value: c.lowStock,
      hint: c.lowStock > 0 ? "À recommander" : "Niveaux corrects",
      icon: TrendingDown,
      tone: "border-orange-300 bg-orange-50 text-orange-800",
      ring: "ring-2 ring-orange-500",
    },
    {
      key: "customerDebts" as TabKey,
      label: "Clients qui doivent",
      value: c.customerDebts,
      hint: formatCurrency(data.totals.customerDebtTotal),
      icon: Users,
      tone: "border-amber-300 bg-amber-50 text-amber-900",
      ring: "ring-2 ring-amber-500",
    },
    {
      key: "supplierDebts" as TabKey,
      label: "À payer aux fournisseurs",
      value: c.supplierDebts,
      hint: formatCurrency(data.totals.supplierDebtTotal),
      icon: Truck,
      tone: "border-blue-300 bg-blue-50 text-blue-900",
      ring: "ring-2 ring-blue-500",
    },
    {
      key: "draftInventories" as TabKey,
      label: "Inventaires en cours",
      value: c.draftInventories,
      hint: c.draftInventories > 0 ? "À finaliser" : "Aucun en attente",
      icon: ClipboardList,
      tone: "border-indigo-300 bg-indigo-50 text-indigo-900",
      ring: "ring-2 ring-indigo-500",
    },
    {
      key: "syncIssues" as TabKey,
      label: "Synchronisation",
      value: c.syncIssues,
      hint: c.syncIssues > 0 ? "Opérations en attente" : "Tout est synchronisé",
      icon: WifiOff,
      tone: "border-slate-300 bg-slate-50 text-slate-700",
      ring: "ring-2 ring-slate-500",
    },
  ];

  const show = (key: TabKey) => tab === "all" || tab === key;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${allClear ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            <BellRing className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Alertes</h1>
            <p className="text-sm text-slate-500">
              {allClear
                ? "Aucune action requise pour le moment"
                : `${c.total} point(s) à surveiller · ${c.critical} critique(s)`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-teal-700"
          >
            <FileDown className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {allClear && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-green-50 p-5">
          <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600" />
          <div>
            <p className="font-bold text-green-900">Tout va bien</p>
            <p className="text-sm text-green-800">
              Aucune rupture, aucun stock bas, aucune dette et aucune opération en attente.
            </p>
          </div>
        </div>
      )}

      {/* Cartes cliquables */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const active = tab === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setTab(active ? "all" : card.key)}
              className={`min-w-0 rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${card.tone} ${active ? card.ring : ""} ${card.value === 0 ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-2xl font-black">{card.value}</span>
              </div>
              <p className="mt-1 truncate text-xs font-black">{card.label}</p>
              <p className="mt-0.5 truncate text-[10px] opacity-80">{card.hint}</p>
            </button>
          );
        })}
      </div>

      {tab !== "all" && (
        <button
          type="button"
          onClick={() => setTab("all")}
          className="mb-4 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          ← Voir toutes les alertes
        </button>
      )}

      {/* Impact financier */}
      {(c.outOfStock > 0 || c.lowStock > 0) && show("outOfStock") && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-slate-900 p-4 text-white">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="min-w-0">
            <p className="font-bold">Réapprovisionnement conseillé</p>
            <p className="mt-1 text-sm text-slate-300">
              Remettre tous les produits à leur seuil coûterait environ{" "}
              <strong className="text-white">{formatCurrency(data.totals.restockCost)}</strong> en prix d&apos;achat.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Ruptures */}
        {show("outOfStock") && data.outOfStock.length > 0 && (
          <Section
            title="Ruptures de stock"
            count={data.outOfStock.length}
            color="bg-red-100 text-red-700"
            icon={<Ban className="h-4 w-4" />}
            description="Ces produits ne peuvent plus être vendus. À commander en priorité."
          >
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3 text-right">Seuil</th>
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.outOfStock.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{p.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.categoryName || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{p.minStock}</td>
                    <td className="px-4 py-3">
                      {p.supplierName ? (
                        <div className="min-w-0">
                          <p className="truncate text-slate-700">{p.supplierName}</p>
                          {p.supplierPhone && (
                            <a href={`tel:${p.supplierPhone}`} className="flex items-center gap-1 text-[11px] text-teal-700 hover:underline">
                              <Phone className="h-3 w-3" /> {p.supplierPhone}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href="/vendor/receive"
                        className="inline-flex rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
                      >
                        Réceptionner
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Stocks bas */}
        {show("lowStock") && data.lowStock.length > 0 && (
          <Section
            title="Stocks bas"
            count={data.lowStock.length}
            color="bg-orange-100 text-orange-700"
            icon={<TrendingDown className="h-4 w-4" />}
            description="Ces produits arrivent à leur seuil d'alerte. Pensez à les recommander."
          >
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3 text-right">Restant</th>
                  <th className="px-4 py-3 text-right">Seuil</th>
                  <th className="px-4 py-3 text-right">À commander</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.lowStock.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">{p.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.categoryName || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-sm font-black text-orange-700">{p.stock}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{p.minStock}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {Math.max(0, p.minStock - p.stock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Dettes clients */}
        {show("customerDebts") && data.customerDebts.length > 0 && (
          <Section
            title="Clients qui doivent de l'argent"
            count={data.customerDebts.length}
            color="bg-amber-100 text-amber-800"
            icon={<Users className="h-4 w-4" />}
            description={`Total à récupérer : ${formatCurrency(data.totals.customerDebtTotal)}`}
          >
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Ancienneté</th>
                  <th className="px-4 py-3 text-right">Montant dû</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.customerDebts.map((c2) => (
                  <tr key={c2.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{c2.name}</p>
                      {c2.company && <p className="text-[11px] text-slate-500">{c2.company}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {c2.phone ? (
                        <a href={`tel:${c2.phone}`} className="flex items-center gap-1 text-teal-700 hover:underline">
                          <Phone className="h-3.5 w-3.5" /> {c2.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-xs ${(c2.sinceDays ?? 0) > 30 ? "font-bold text-red-600" : "text-slate-500"}`}>
                      {ageLabel(c2.sinceDays)}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-red-600">{formatCurrency(c2.debt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href="/admin/customers"
                        className="inline-flex rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                      >
                        Encaisser
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Dettes fournisseurs */}
        {show("supplierDebts") && data.supplierDebts.length > 0 && (
          <Section
            title="Sommes à payer aux fournisseurs"
            count={data.supplierDebts.length}
            color="bg-blue-100 text-blue-800"
            icon={<Truck className="h-4 w-4" />}
            description={`Total à payer : ${formatCurrency(data.totals.supplierDebtTotal)}`}
          >
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Ancienneté</th>
                  <th className="px-4 py-3 text-right">À payer</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.supplierDebts.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      {s.company && <p className="text-[11px] text-slate-500">{s.company}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {s.phone ? (
                        <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-teal-700 hover:underline">
                          <Phone className="h-3.5 w-3.5" /> {s.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-xs ${(s.sinceDays ?? 0) > 30 ? "font-bold text-red-600" : "text-slate-500"}`}>
                      {ageLabel(s.sinceDays)}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-red-600">{formatCurrency(s.debt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href="/admin/suppliers"
                        className="inline-flex rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                      >
                        Régler
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Inventaires en cours */}
        {show("draftInventories") && data.draftInventories.length > 0 && (
          <Section
            title="Inventaires à finaliser"
            count={data.draftInventories.length}
            color="bg-indigo-100 text-indigo-700"
            icon={<ClipboardList className="h-4 w-4" />}
            description="Tant qu'un inventaire n'est pas finalisé, le stock n'est pas corrigé."
          >
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Inventaire</th>
                  <th className="px-4 py-3">Portée</th>
                  <th className="px-4 py-3 text-right">Comptés</th>
                  <th className="px-4 py-3">Ouvert</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.draftInventories.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{i.label || i.inventoryNumber}</p>
                      <p className="font-mono text-[10px] text-slate-400">{i.inventoryNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{i.categoryName || "Toute la boutique"}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {i.counted} / {i.total}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{ageLabel(i.sinceDays)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/inventory/${i.id}`}
                        className="inline-flex rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                      >
                        Continuer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Synchronisation */}
        {show("syncIssues") && data.syncIssues.length > 0 && (
          <Section
            title="Synchronisation"
            count={data.syncIssues.length}
            color="bg-slate-200 text-slate-700"
            icon={<WifiOff className="h-4 w-4" />}
            description="Opérations enregistrées hors ligne qui ne sont pas encore parties sur le serveur."
          >
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Opération</th>
                  <th className="px-4 py-3">Appareil</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Tentatives</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.syncIssues.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{s.entityType}</p>
                      {s.errorMessage && <p className="text-[11px] text-red-600">{s.errorMessage}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{s.deviceId}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          s.status === "failed" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {s.status === "failed" ? "Échec" : "En attente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{s.attempts}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-slate-400">
        Dernière actualisation : {formatDateTime(data.generatedAt)}
      </p>
    </div>
  );
}

function Section({
  title,
  count,
  color,
  icon,
  description,
  children,
}: {
  title: string;
  count: number;
  color: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>{icon}</span>
          <div className="min-w-0">
            <h2 className="truncate font-bold text-slate-900">{title}</h2>
            <p className="truncate text-xs text-slate-500">{description}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-black ${color}`}>{count}</span>
      </div>
      <div className="table-scroll">{children}</div>
    </div>
  );
}
