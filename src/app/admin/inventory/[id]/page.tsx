"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Save,
  Search,
  Pencil,
  X,
  Undo2,
  AlertTriangle,
  ClipboardCheck,
  Package,
  TrendingDown,
  TrendingUp,
  Zap,
  RotateCcw,
} from "lucide-react";

type Item = {
  id: number;
  productId: number;
  productName: string;
  productSku?: string | null;
  categoryName?: string | null;
  currentStock: number | string;
  purchasePrice: string | number;
  systemStock: number;
  countedStock: number | null;
  difference: number | null;
  note: string | null;
};

type Correction = {
  id: number;
  productName: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  note: string | null;
  createdAt: string;
};

type Stats = {
  total: number;
  counted: number;
  remaining: number;
  withDiff: number;
  diffUnits: number;
  diffValue: number;
  progress: number;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

type FilterMode = "all" | "remaining" | "diff" | "ok";

export default function InventoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);

  const [inventory, setInventory] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Modification titre/notes
  const [showEdit, setShowEdit] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [filling, setFilling] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.get<any>(`/api/inventory/${id}`);
    if (res.ok && res.data) {
      setInventory(res.data.inventory);
      setItems(res.data.items || []);
      setStats(res.data.stats);
      setCorrections(res.data.corrections || []);
      setEditLabel(res.data.inventory.label || "");
      setEditNotes(res.data.inventory.notes || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const flash = (type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const isDraft = inventory?.status === "draft";

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((i) => {
      if (query) {
        const match =
          i.productName.toLowerCase().includes(query) ||
          i.productSku?.toLowerCase().includes(query) ||
          i.categoryName?.toLowerCase().includes(query);
        if (!match) return false;
      }
      if (filter === "remaining") return i.countedStock === null;
      if (filter === "diff") return i.countedStock !== null && Number(i.difference) !== 0;
      if (filter === "ok") return i.countedStock !== null && Number(i.difference) === 0;
      return true;
    });
  }, [items, q, filter]);

  const saveCount = async (item: Item, value: string) => {
    const parsed = value.trim() === "" ? null : parseInt(value, 10);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      flash("err", "Saisissez un nombre valide");
      return;
    }
    setSavingId(item.productId);
    const res = await api.post(`/api/inventory/${id}/count`, {
      productId: item.productId,
      countedStock: parsed,
    });
    setSavingId(null);
    if (!res.ok) {
      flash("err", res.error || "Erreur lors de l'enregistrement");
      return;
    }
    setDrafts((d) => {
      const next = { ...d };
      delete next[item.productId];
      return next;
    });
    load();
  };

  const resetCount = async (item: Item) => {
    if (!confirm(`Effacer le comptage de « ${item.productName} » ?`)) return;
    setSavingId(item.productId);
    const res = await api.post(`/api/inventory/${id}/count`, {
      productId: item.productId,
      countedStock: null,
    });
    setSavingId(null);
    if (!res.ok) {
      flash("err", res.error || "Erreur");
      return;
    }
    load();
  };

  const fillAll = async (mode: "fill" | "reset") => {
    if (!stats) return;
    const text =
      mode === "fill"
        ? `Remplir les ${stats.remaining} produit(s) non comptés avec leur stock système ?\n\nVous n'aurez ensuite qu'à corriger ceux qui diffèrent. Les comptages déjà saisis ne sont pas modifiés.`
        : `Effacer les ${stats.counted} comptage(s) déjà saisis ?\n\nLe stock n'est pas modifié.`;
    if (!confirm(text)) return;
    setFilling(true);
    const res = await api.post<{ affected: number }>(`/api/inventory/${id}/fill`, { mode });
    setFilling(false);
    if (!res.ok) {
      flash("err", res.error || "Erreur");
      return;
    }
    setDrafts({});
    flash(
      "ok",
      mode === "fill"
        ? `⚡ ${res.data?.affected ?? 0} produit(s) remplis avec le stock système. Corrigez maintenant ceux qui diffèrent.`
        : `${res.data?.affected ?? 0} comptage(s) effacé(s).`
    );
    load();
  };

  const complete = async () => {
    if (!stats) return;
    if (stats.counted === 0) {
      flash("err", "Aucun produit compté. Saisissez au moins un comptage.");
      return;
    }
    const missing = stats.remaining;
    const confirmText =
      `Finaliser l'inventaire ${inventory.inventoryNumber} ?\n\n` +
      `Produits comptés : ${stats.counted} / ${stats.total}\n` +
      (missing > 0 ? `Non comptés (seront ignorés) : ${missing}\n` : "") +
      `Produits avec écart : ${stats.withDiff}\n` +
      `Écart total : ${stats.diffUnits > 0 ? "+" : ""}${stats.diffUnits} unité(s)\n` +
      `Valeur : ${formatCurrency(stats.diffValue)}\n\n` +
      `Le stock sera corrigé automatiquement et chaque écart enregistré dans l'historique.\n\nContinuer ?`;

    if (!confirm(confirmText)) return;

    setCompleting(true);
    const res = await api.post<{ corrected: number; warnings: string[] }>(
      `/api/inventory/${id}/complete`
    );
    setCompleting(false);
    if (!res.ok) {
      flash("err", res.error || "Erreur lors de la finalisation");
      return;
    }
    const warn = res.data?.warnings?.length
      ? `\n\nAttention : ${res.data.warnings.length} produit(s) ont vu leur stock changer pendant le comptage.\n${res.data.warnings
          .slice(0, 5)
          .map((w) => `• ${w}`)
          .join("\n")}`
      : "";
    alert(`✅ Inventaire finalisé.\n${res.data?.corrected ?? 0} correction(s) de stock appliquée(s).${warn}`);
    load();
  };

  const saveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    const res = await api.put(`/api/inventory/${id}`, {
      label: editLabel.trim() || null,
      notes: editNotes.trim() || null,
    });
    setSavingEdit(false);
    if (res.ok) {
      setShowEdit(false);
      flash("ok", "Informations mises à jour");
      load();
    } else {
      flash("err", res.error || "Erreur");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!inventory || !stats) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-slate-600">Inventaire introuvable</p>
        <Link href="/admin/inventory" className="mt-3 inline-block text-teal-700 hover:underline">
          ← Retour aux inventaires
        </Link>
      </div>
    );
  }

  const statusLabel =
    inventory.status === "draft" ? "En cours" : inventory.status === "completed" ? "Terminé" : "Archivé";
  const statusColor =
    inventory.status === "draft"
      ? "bg-orange-100 text-orange-700"
      : inventory.status === "completed"
      ? "bg-green-100 text-green-700"
      : "bg-slate-200 text-slate-600";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/admin/inventory" className="shrink-0 rounded-lg bg-white p-2 shadow hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
              {inventory.label || inventory.inventoryNumber}
            </h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusColor}`}>{statusLabel}</span>
            {inventory.categoryName && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {inventory.categoryName}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500">
            {inventory.inventoryNumber} · {formatDateTime(inventory.createdAt)}
            {inventory.completedAt ? ` · terminé ${formatDateTime(inventory.completedAt)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {inventory.status !== "archived" && (
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              <Pencil className="h-4 w-4" /> Modifier
            </button>
          )}
          {isDraft && (
            <button
              type="button"
              onClick={complete}
              disabled={completing}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-green-700 disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              {completing ? "Finalisation…" : "Finaliser"}
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-2xl p-4 text-sm font-bold ${
            message.type === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Récapitulatif */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-500">Comptés</p>
          <p className="text-2xl font-black text-slate-900">
            {stats.counted}
            <span className="text-sm font-semibold text-slate-400"> / {stats.total}</span>
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${stats.progress === 100 ? "bg-green-500" : "bg-teal-500"}`}
              style={{ width: `${stats.progress}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-500">Restants</p>
          <p className={`text-2xl font-black ${stats.remaining > 0 ? "text-orange-600" : "text-green-600"}`}>
            {stats.remaining}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-500">Écarts</p>
          <p className={`text-2xl font-black ${stats.withDiff > 0 ? "text-red-600" : "text-green-600"}`}>
            {stats.withDiff}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-500">Écart unités</p>
          <p
            className={`flex items-center gap-1 text-2xl font-black ${
              stats.diffUnits < 0 ? "text-red-600" : stats.diffUnits > 0 ? "text-blue-600" : "text-slate-400"
            }`}
          >
            {stats.diffUnits < 0 ? (
              <TrendingDown className="h-5 w-5" />
            ) : stats.diffUnits > 0 ? (
              <TrendingUp className="h-5 w-5" />
            ) : null}
            {stats.diffUnits > 0 ? "+" : ""}
            {stats.diffUnits}
          </p>
        </div>
        <div className="col-span-2 rounded-2xl bg-white p-3 shadow-sm lg:col-span-1">
          <p className="text-[10px] font-bold uppercase text-slate-500">Valeur écart</p>
          <p
            className={`truncate text-xl font-black ${
              stats.diffValue < 0 ? "text-red-600" : "text-green-700"
            }`}
          >
            {formatCurrency(stats.diffValue)}
          </p>
        </div>
      </div>

      {/* Avertissement si non terminé et écarts détectés */}
      {isDraft && stats.withDiff > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl bg-orange-50 p-4 text-sm text-orange-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <p>
            <strong>{stats.withDiff} produit(s) présentent un écart.</strong> Le stock ne sera corrigé
            qu'après avoir cliqué sur <strong>« Finaliser »</strong>. Vous pouvez continuer à compter
            et revenir plus tard.
          </p>
        </div>
      )}

      {/* Comptage rapide */}
      {isDraft && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-teal-300 bg-teal-50/60 px-3 py-2.5">
          <p className="min-w-0 flex-1 text-xs text-teal-900">
            <strong>Comptage rapide :</strong> remplissez d&apos;un coup les produits non comptés avec le stock
            connu, puis corrigez seulement ceux qui diffèrent.
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {stats.remaining > 0 && (
              <button
                type="button"
                onClick={() => fillAll("fill")}
                disabled={filling}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-teal-700 shadow-sm ring-1 ring-teal-200 hover:bg-teal-100 disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5" /> Tout compter = stock système ({stats.remaining})
              </button>
            )}
            {stats.counted > 0 && (
              <button
                type="button"
                onClick={() => fillAll("reset")}
                disabled={filling}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recherche et filtres */}
      {isDraft && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Chercher un produit à compter…"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { k: "all", label: `Tous (${stats.total})` },
                { k: "remaining", label: `À compter (${stats.remaining})` },
                { k: "diff", label: `Avec écart (${stats.withDiff})` },
                { k: "ok", label: `Conformes (${stats.counted - stats.withDiff})` },
              ] as Array<{ k: FilterMode; label: string }>
            ).map((f) => (
              <button
                key={f.k}
                type="button"
                onClick={() => setFilter(f.k)}
                className={`rounded-xl px-3 py-2 text-xs font-bold ${
                  filter === f.k ? "bg-teal-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tableau de comptage */}
      <div className="table-scroll rounded-2xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3 text-right">Stock système</th>
              <th className="px-4 py-3 text-right">Stock compté</th>
              <th className="px-4 py-3 text-right">Écart</th>
              {isDraft && <th className="px-4 py-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isDraft ? 5 : 4} className="py-10 text-center text-slate-400">
                  <Package className="mx-auto mb-2 h-10 w-10" />
                  Aucun produit à afficher
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const draftValue = drafts[item.productId] ?? (item.countedStock !== null ? String(item.countedStock) : "");
                const diff = item.countedStock !== null ? Number(item.difference) : null;
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.productName}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.categoryName || "Sans catégorie"}
                        {item.productSku ? ` · ${item.productSku}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{item.systemStock}</td>
                    <td className="px-4 py-3 text-right">
                      {isDraft ? (
                        <input
                          type="number"
                          min="0"
                          value={draftValue}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [item.productId]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveCount(item, drafts[item.productId] ?? "");
                            }
                          }}
                          placeholder="—"
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right font-bold focus:border-teal-500 focus:outline-none"
                        />
                      ) : (
                        <span className="font-black text-slate-900">
                          {item.countedStock !== null ? item.countedStock : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {diff === null ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-black ${
                            diff === 0
                              ? "bg-green-100 text-green-700"
                              : diff < 0
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                          <span className="ml-1 font-semibold opacity-70">
                            ({formatCurrency(diff * toNum(item.purchasePrice))})
                          </span>
                        </span>
                      )}
                    </td>
                    {isDraft && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => saveCount(item, drafts[item.productId] ?? "")}
                            disabled={
                              savingId === item.productId || drafts[item.productId] === undefined
                            }
                            className="flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40"
                            title="Enregistrer ce comptage"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                          {item.countedStock !== null && (
                            <button
                              type="button"
                              onClick={() => resetCount(item)}
                              className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                              title="Effacer ce comptage"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Corrections appliquées */}
      {corrections.length > 0 && (
        <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <ClipboardCheck className="h-5 w-5 text-green-600" />
            Corrections de stock appliquées ({corrections.length})
          </h2>
          <div className="table-scroll rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Produit</th>
                  <th className="px-3 py-2.5 text-right">Avant</th>
                  <th className="px-3 py-2.5 text-right">Après</th>
                  <th className="px-3 py-2.5 text-right">Correction</th>
                  <th className="px-3 py-2.5">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {corrections.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{c.productName}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{c.stockBefore}</td>
                    <td className="px-3 py-2.5 text-right font-bold">{c.stockAfter}</td>
                    <td
                      className={`px-3 py-2.5 text-right font-black ${
                        c.quantity > 0 ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {c.quantity > 0 ? "+" : ""}
                      {c.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{c.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Ces corrections sont également visibles dans <strong>Stock &amp; Mouvements</strong> avec la
            classification « Inventaire ».
          </p>
        </div>
      )}

      {/* Modal modification titre/notes */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Modifier l'inventaire</h3>
                <p className="text-xs text-slate-500">{inventory.inventoryNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveMeta} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Titre</label>
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-teal-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {savingEdit ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
