"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  AlertTriangle,
  ArchiveX,
  Ban,
  Box,
  Check,
  ClipboardList,
  Filter,
  PackageMinus,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";

type Movement = {
  id: number;
  productId: number;
  productName: string;
  productSku?: string | null;
  movementType: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceType: string | null;
  referenceId: number | null;
  note: string | null;
  username: string | null;
  createdAt: string;
};

type Product = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  stock: number | string;
  purchasePrice: number | string;
  categoryName?: string | null;
};

type SummaryItem = { quantity: number; operations: number; value: number };
type Summary = Record<string, SummaryItem>;

const TYPE_LABELS: Record<string, { label: string; color: string; icon?: string }> = {
  entry: { label: "Entrée", color: "bg-green-100 text-green-700", icon: "📥" },
  sale: { label: "Vente", color: "bg-blue-100 text-blue-700", icon: "🛒" },
  loss: { label: "Perte", color: "bg-red-100 text-red-700", icon: "❌" },
  damaged: { label: "Endommagé", color: "bg-orange-100 text-orange-700", icon: "⚠️" },
  return_to_supplier: { label: "Retour fournisseur", color: "bg-yellow-100 text-yellow-800", icon: "↩️" },
  internal_use: { label: "Usage interne", color: "bg-purple-100 text-purple-700", icon: "🏪" },
  correction: { label: "Correction", color: "bg-slate-200 text-slate-700", icon: "✏️" },
  inventory: { label: "Inventaire", color: "bg-indigo-100 text-indigo-700", icon: "📋" },
  other: { label: "Autre sortie", color: "bg-slate-100 text-slate-700", icon: "📦" },
};

const OUTGOING_REASONS = [
  {
    value: "damaged",
    label: "Produit endommagé",
    short: "Endommagé",
    description: "Cassé, défectueux ou inutilisable. À mettre physiquement de côté.",
    color: "border-orange-300 bg-orange-50 text-orange-800",
    selected: "ring-2 ring-orange-500",
    icon: ShieldAlert,
  },
  {
    value: "return_to_supplier",
    label: "Retour fournisseur",
    short: "Retour fournisseur",
    description: "Produit renvoyé au fournisseur et sorti du stock de vente.",
    color: "border-yellow-300 bg-yellow-50 text-yellow-900",
    selected: "ring-2 ring-yellow-500",
    icon: RotateCcw,
  },
  {
    value: "loss",
    label: "Perte / Manquant",
    short: "Perte",
    description: "Produit perdu, volé ou introuvable dans la boutique.",
    color: "border-red-300 bg-red-50 text-red-800",
    selected: "ring-2 ring-red-500",
    icon: Ban,
  },
  {
    value: "internal_use",
    label: "Usage interne",
    short: "Usage interne",
    description: "Produit utilisé par la boutique et non vendu à un client.",
    color: "border-purple-300 bg-purple-50 text-purple-800",
    selected: "ring-2 ring-purple-500",
    icon: Box,
  },
  {
    value: "other",
    label: "Autre sortie",
    short: "Autre",
    description: "Toute autre sortie. Une explication sera obligatoire.",
    color: "border-slate-300 bg-slate-50 text-slate-700",
    selected: "ring-2 ring-slate-500",
    icon: ArchiveX,
  },
] as const;

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

const EMPTY_SUMMARY: Summary = {
  damaged: { quantity: 0, operations: 0, value: 0 },
  return_to_supplier: { quantity: 0, operations: 0, value: 0 },
  loss: { quantity: 0, operations: 0, value: 0 },
  internal_use: { quantity: 0, operations: 0, value: 0 },
  other: { quantity: 0, operations: 0, value: 0 },
};

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState("");

  // Formulaire sortie/classification
  const [showAdjust, setShowAdjust] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<string>("damaged");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadMovements = async (overrideType?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "200" });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const filterType = overrideType !== undefined ? overrideType : type;
    if (filterType) params.set("type", filterType);
    const res = await api.get<{ items: Movement[]; summary: Summary }>(`/api/stock-movements?${params}`);
    if (res.ok && res.data) {
      setMovements(res.data.items || []);
      setSummary({ ...EMPTY_SUMMARY, ...(res.data.summary || {}) });
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    const res = await api.get<{ items: Product[] }>("/api/products?pageSize=2000&activeOnly=1");
    if (res.ok && res.data) setProducts(res.data.items || []);
  };

  useEffect(() => {
    loadMovements();
    loadProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.categoryName?.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [products, productSearch]);

  const resetForm = () => {
    setProductSearch("");
    setSelectedProductId(null);
    setQuantity(1);
    setReason("damaged");
    setNote("");
    setFormError(null);
  };

  const openAdjust = () => {
    resetForm();
    setSuccess(null);
    setShowAdjust(true);
  };

  const submitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProduct) {
      setFormError("Choisissez d'abord le produit concerné");
      return;
    }
    if (!quantity || quantity <= 0) {
      setFormError("La quantité doit être supérieure à zéro");
      return;
    }
    if (quantity > toNum(selectedProduct.stock)) {
      setFormError(`Stock insuffisant : il reste seulement ${selectedProduct.stock} unité(s)`);
      return;
    }
    if (reason === "other" && !note.trim()) {
      setFormError("Veuillez expliquer le motif de cette autre sortie");
      return;
    }

    const reasonMeta = OUTGOING_REASONS.find((r) => r.value === reason);
    const after = toNum(selectedProduct.stock) - quantity;
    const ok = confirm(
      `${reasonMeta?.label || reason}\n\n` +
        `Produit : ${selectedProduct.name}\n` +
        `Quantité : ${quantity}\n` +
        `Stock vendable : ${selectedProduct.stock} → ${after}\n\n` +
        `Confirmer cette sortie ?`
    );
    if (!ok) return;

    setSaving(true);
    const res = await api.post<{
      productName: string;
      quantity: number;
      stockBefore: number;
      stock: number;
      label: string;
    }>("/api/stock/adjust", {
      productId: selectedProduct.id,
      quantity,
      reason,
      direction: "out",
      note: note.trim() || null,
    });
    setSaving(false);

    if (!res.ok || !res.data) {
      setFormError(res.error || "Impossible d'enregistrer cette sortie");
      return;
    }

    setSuccess(
      `✅ ${res.data.productName} : ${res.data.quantity} unité(s) classée(s) « ${res.data.label} ». Stock ${res.data.stockBefore} → ${res.data.stock}.`
    );
    setShowAdjust(false);
    resetForm();
    await Promise.all([loadMovements(), loadProducts()]);
    setTimeout(() => setSuccess(null), 7000);
  };

  const filterByCard = (movementType: string) => {
    setType(movementType);
    loadMovements(movementType);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock & Mouvements</h1>
          <p className="text-sm text-slate-500">
            Chaque entrée et sortie est identifiée : vente, endommagé, perte, retour ou usage interne.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdjust}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-orange-700"
        >
          <PackageMinus className="h-4 w-4" /> Classer une sortie
        </button>
      </div>

      {success && (
        <div className="mb-4 rounded-2xl bg-green-100 p-4 text-sm font-bold text-green-800 shadow-sm">
          {success}
        </div>
      )}

      {/* Explication simple du fonctionnement */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-blue-950">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div>
          <p className="font-bold">Comment reconnaître un produit endommagé ou retourné ?</p>
          <p className="mt-1 text-xs leading-relaxed text-blue-800">
            Cliquez sur <strong>« Classer une sortie »</strong>, choisissez le produit et le motif.
            La quantité est retirée du <strong>stock vendable</strong>, puis reste visible ici avec une couleur et une note.
            Exemple : 20 chargeurs en stock, 3 endommagés → le stock vendable devient 17 et l'historique affiche
            « Endommagé : 3 » en orange. Placez physiquement les 3 unités dans une boîte « Endommagés ».
          </p>
        </div>
      </div>

      {/* Synthèse des sorties classées */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {OUTGOING_REASONS.map((r) => {
          const Icon = r.icon;
          const stat = summary[r.value] || { quantity: 0, operations: 0, value: 0 };
          return (
            <button
              type="button"
              key={r.value}
              onClick={() => filterByCard(r.value)}
              className={`min-w-0 rounded-2xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${r.color} ${
                type === r.value ? r.selected : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-2xl font-black">{stat.quantity}</span>
              </div>
              <p className="mt-1 truncate text-xs font-black">{r.short}</p>
              <p className="mt-1 text-[10px] opacity-75">
                {stat.operations} opération(s) · {formatCurrency(stat.value)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filtres historique */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 md:grid-cols-4">
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
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Type de mouvement</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Tous les mouvements</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.icon} {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            onClick={() => loadMovements()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Filter className="h-4 w-4" /> Filtrer
          </button>
          {(type || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setType("");
                setDateFrom("");
                setDateTo("");
                setTimeout(() => loadMovements(""), 0);
              }}
              className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
              title="Réinitialiser"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Historique */}
      <div className="table-scroll rounded-2xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Classification</th>
              <th className="px-4 py-3 text-right">Quantité</th>
              <th className="px-4 py-3 text-right">Avant</th>
              <th className="px-4 py-3 text-right">Après</th>
              <th className="px-4 py-3">Détail / Note</th>
              <th className="px-4 py-3">Utilisateur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center">
                  Chargement…
                </td>
              </tr>
            ) : movements.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  <ClipboardList className="mx-auto mb-2 h-10 w-10" />
                  Aucun mouvement pour ce filtre
                </td>
              </tr>
            ) : (
              movements.map((m) => {
                const meta = TYPE_LABELS[m.movementType] || {
                  label: m.movementType,
                  color: "bg-slate-100 text-slate-700",
                  icon: "📦",
                };
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{m.productName}</p>
                      {m.productSku && <p className="font-mono text-[10px] text-slate-400">{m.productSku}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${m.quantity > 0 ? "text-green-700" : "text-red-700"}`}>
                      {m.quantity > 0 ? "+" : ""}
                      {m.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{m.stockBefore}</td>
                    <td className="px-4 py-3 text-right font-semibold">{m.stockAfter}</td>
                    <td className="max-w-xs px-4 py-3 text-xs text-slate-600">
                      {m.note || (m.referenceType === "sale" ? `Vente #${m.referenceId}` : m.referenceType || "—")}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{m.username || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal classification de sortie */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Classer une sortie de stock</h2>
                <p className="text-xs text-slate-500">La quantité sera retirée du stock disponible à la vente.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjust(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitAdjustment} className="space-y-5 p-4 sm:p-5">
              {formError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">❌ {formError}</div>
              )}

              {/* Produit */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">1. Quel produit ?</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Chercher par nom, SKU ou code-barres…"
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                  {filteredProducts.length === 0 ? (
                    <p className="p-4 text-center text-sm text-slate-400">Aucun produit trouvé</p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(p.id);
                          setProductSearch(p.name);
                        }}
                        className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50 ${
                          selectedProductId === p.id ? "bg-teal-50 ring-1 ring-inset ring-teal-400" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-400">{p.categoryName || "Sans catégorie"} · {p.sku}</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-green-100 px-2 py-1 text-xs font-black text-green-700">
                          Stock {p.stock}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedProduct && (
                <div className="rounded-xl bg-teal-50 p-3">
                  <p className="font-bold text-teal-950">✅ {selectedProduct.name}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-teal-800">
                    <span>Stock vendable actuel : <strong>{selectedProduct.stock}</strong></span>
                    <span>Valeur unitaire : <strong>{formatCurrency(toNum(selectedProduct.purchasePrice))}</strong></span>
                  </div>
                </div>
              )}

              {/* Motif */}
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">2. Pourquoi le produit sort-il ?</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {OUTGOING_REASONS.map((r) => {
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setReason(r.value)}
                        className={`rounded-xl border p-3 text-left transition ${r.color} ${
                          reason === r.value ? r.selected : "opacity-75 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold">
                          <Icon className="h-5 w-5" /> {r.label}
                        </div>
                        <p className="mt-1 text-[11px] leading-snug opacity-80">{r.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantité + note */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-800">3. Combien d'unités ?</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={selectedProduct ? toNum(selectedProduct.stock) : undefined}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-center text-xl font-black"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.min(selectedProduct ? toNum(selectedProduct.stock) : q + 1, q + 1))
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  {selectedProduct && (
                    <p className="mt-2 text-center text-xs text-slate-500">
                      Stock après :{" "}
                      <strong className={toNum(selectedProduct.stock) - quantity < 0 ? "text-red-600" : "text-slate-800"}>
                        {toNum(selectedProduct.stock) - quantity}
                      </strong>
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-bold text-slate-800">
                    Note {reason === "other" ? "*" : "(conseillée)"}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder={
                      reason === "damaged"
                        ? "Ex : Boîte écrasée à la livraison, écran fissuré…"
                        : reason === "return_to_supplier"
                        ? "Ex : Facture FAC-123, renvoyé à Diallo Import…"
                        : "Expliquez brièvement…"
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                    required={reason === "other"}
                  />
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdjust(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedProduct}
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-orange-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {saving ? "Enregistrement…" : "Confirmer la sortie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
