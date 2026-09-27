"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { api } from "@/lib/client-api";
import { formatCurrency } from "@/lib/utils";
import {
  Plus,
  Tags,
  Pencil,
  Trash2,
  X,
  Check,
  Eye,
  Package,
  ArrowLeft,
  ShieldCheck,
  Lock,
} from "lucide-react";

type Category = {
  id: number;
  name: string;
  description?: string | null;
  productCount?: number;
};

type ProductRow = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  stock: number | string;
  minStock: number | string;
  retailPrice: string | number;
  wholesalePrice: string | number;
  purchasePrice: string | number;
  active: boolean;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function CategoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Création
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modification
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Vue produits
  const [viewing, setViewing] = useState<Category | null>(null);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.get<Category[]>("/api/categories?include_counts=1");
    if (res.ok && res.data) setCats(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newName.trim()) return;
    setSaving(true);
    const res = await api.post("/api/categories", { name: newName.trim(), description: newDesc || null });
    setSaving(false);
    if (res.ok) {
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      load();
    } else {
      setFormError(res.error || "Erreur lors de la création");
    }
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setEditError(null);
    setEditName(c.name);
    setEditDesc(c.description || "");
    setEditActive(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setEditError(null);
    const res = await api.put(`/api/categories/${editing.id}`, {
      name: editName.trim(),
      description: editDesc || null,
      active: editActive,
    });
    setSavingEdit(false);
    if (res.ok) {
      setEditing(null);
      load();
    } else {
      setEditError(res.error || "Erreur lors de la modification");
    }
  };

  const removeCategory = async (c: Category) => {
    const count = c.productCount ?? 0;
    const msg =
      count > 0
        ? `${count} produit(s) sont rattachés à "${c.name}".\n\nLa catégorie sera désactivée (jamais supprimée) pour préserver l'historique. Continuer ?`
        : `Voulez-vous vraiment supprimer la catégorie "${c.name}" ?`;
    if (!confirm(msg)) return;

    const res = await api.delete<{ message?: string }>(`/api/categories/${c.id}`);
    if (res.ok) {
      alert(res.data?.message || "Opération effectuée");
      load();
    } else {
      alert(res.error || "Erreur");
    }
  };

  const openProducts = async (c: Category) => {
    setViewing(c);
    setLoadingItems(true);
    const res = await api.get<{ items: ProductRow[] }>(`/api/categories/${c.id}`);
    if (res.ok && res.data) setItems(res.data.items);
    else setItems([]);
    setLoadingItems(false);
  };

  const totalProducts = cats.reduce((s, c) => s + (c.productCount ?? 0), 0);

  return (
    <div>
      <style jsx global>{`
        .cat-fade {
          animation: catFade 0.18s ease-out;
        }
        @keyframes catFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catégories</h1>
          <p className="text-sm text-slate-500">
            {cats.length} catégorie(s) · {totalProducts} produit(s) classés
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <span className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
              <Lock className="h-3.5 w-3.5" /> Lecture seule
            </span>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                setShowCreate(!showCreate);
                setFormError(null);
              }}
              className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" /> Nouvelle catégorie
            </button>
          )}
        </div>
      </div>

      {/* Bandeau explicatif pour le rôle admin */}
      {isAdmin && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            En tant qu'administrateur, vous pouvez créer, renommer et retirer des catégories.
            Une catégorie qui contient des produits est <strong>désactivée</strong> et non supprimée,
            afin de ne jamais perturber l'historique des ventes.
          </p>
        </div>
      )}

      {/* Formulaire de création */}
      {showCreate && isAdmin && (
        <form onSubmit={addCategory} className="cat-fade mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Ajouter une catégorie</h2>
            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          {formError && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700">{formError}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nom de la catégorie *</label>
              <input
                placeholder="Ex : Écrans, Chargeurs, Câbles…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Description (facultatif)</label>
              <input
                placeholder="Ex : Pièces de réparation"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* Liste des catégories */}
      <div className="rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement…</div>
        ) : cats.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Tags className="mx-auto mb-2 h-10 w-10" />
            Aucune catégorie
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {cats.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500">
                    {c.productCount ?? 0} produit(s)
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openProducts(c)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                >
                  <Eye className="h-3.5 w-3.5" /> Voir les produits
                </button>

                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCategory(c)}
                      className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Retirer
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Vue : produits de la catégorie */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
          <div className="cat-fade w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  className="shrink-0 rounded-lg bg-slate-100 p-2 hover:bg-slate-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-slate-900">{viewing.name}</h3>
                  <p className="text-xs text-slate-500">Produits classés dans cette catégorie</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              {loadingItems ? (
                <div className="p-8 text-center text-slate-500">Chargement…</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Package className="mx-auto mb-2 h-10 w-10" />
                  Aucun produit dans cette catégorie
                </div>
              ) : (
                <div className="table-scroll rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Produit</th>
                        <th className="px-3 py-2.5 text-right">Stock</th>
                        <th className="px-3 py-2.5 text-right">Prix détail</th>
                        <th className="px-3 py-2.5 text-right">Prix gros</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((p) => {
                        const stock = toNum(p.stock);
                        const min = toNum(p.minStock);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-slate-800">{p.name}</p>
                              <p className="font-mono text-[11px] text-slate-400">{p.sku}</p>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                  stock === 0
                                    ? "bg-red-100 text-red-700"
                                    : stock <= min
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {stock}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-teal-700">
                              {formatCurrency(toNum(p.retailPrice))}
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-600">
                              {formatCurrency(toNum(p.wholesalePrice))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal : modification catégorie */}
      {editing && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Modifier la catégorie</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{editError}</p>
            )}

            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Nom *</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Description</label>
                <input
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-4 w-4 rounded text-teal-600"
                  />
                  <span>Catégorie visible et utilisable</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:opacity-50"
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
