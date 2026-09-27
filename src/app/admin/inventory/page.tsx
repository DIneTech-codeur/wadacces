"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import {
  Plus,
  ClipboardList,
  Pencil,
  Trash2,
  Archive,
  X,
  Check,
  Eye,
  Info,
  ArchiveRestore,
  RotateCcw,
} from "lucide-react";

type InventoryStats = {
  total: number;
  counted: number;
  remaining: number;
  withDiff: number;
  diffUnits: number;
  diffValue: number;
  progress: number;
};

type Inventory = {
  id: number;
  inventoryNumber: string;
  label: string | null;
  status: "draft" | "completed" | "archived";
  notes: string | null;
  categoryName: string | null;
  username: string | null;
  createdAt: string;
  completedAt: string | null;
  stats: InventoryStats;
};

type Category = { id: number; name: string; productCount?: number };

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: "En cours", color: "bg-orange-100 text-orange-700" },
  completed: { label: "Terminé", color: "bg-green-100 text-green-700" },
  archived: { label: "Archivé", color: "bg-slate-200 text-slate-600" },
};

const STEPS = [
  {
    n: "1",
    title: "Créer l'inventaire",
    text: "L'application photographie le stock qu'elle croit avoir. Vous pouvez compter toute la boutique ou une seule catégorie.",
  },
  {
    n: "2",
    title: "Compter en boutique",
    text: "Saisissez ce que vous voyez sur l'étagère. Astuce : le bouton ⚡ remplit tout avec le stock connu, vous ne corrigez que les différences.",
  },
  {
    n: "3",
    title: "Voir les écarts",
    text: "L'application calcule : Réel − Système. Exemple : système 50, compté 47 → écart −3.",
  },
  {
    n: "4",
    title: "Finaliser",
    text: "Le stock est corrigé automatiquement et chaque écart est enregistré dans l'historique. Rien n'est modifié en silence.",
  },
];

export default function InventoryListPage() {
  const [items, setItems] = useState<Inventory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // Création
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modification
  const [editing, setEditing] = useState<Inventory | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [deleting, setDeleting] = useState<Inventory | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.get<Inventory[]>("/api/inventory");
    if (res.ok && res.data) setItems(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    api.get<Category[]>("/api/categories?include_counts=1").then((r) => {
      if (r.ok && r.data) setCategories(r.data);
    });
  }, []);

  const createInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const res = await api.post<{ id: number; productsCount: number }>("/api/inventory", {
      label: label.trim() || null,
      categoryId: categoryId ? parseInt(categoryId, 10) : null,
      notes: notes.trim() || null,
    });
    setCreating(false);
    if (res.ok && res.data) {
      window.location.href = `/admin/inventory/${res.data.id}`;
    } else {
      setCreateError(res.error || "Erreur lors de la création");
    }
  };

  const openEdit = (inv: Inventory) => {
    setEditing(inv);
    setEditError(null);
    setEditLabel(inv.label || "");
    setEditNotes(inv.notes || "");
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setEditError(null);
    const res = await api.put(`/api/inventory/${editing.id}`, {
      label: editLabel.trim() || null,
      notes: editNotes.trim() || null,
    });
    setSavingEdit(false);
    if (res.ok) {
      setEditing(null);
      load();
    } else {
      setEditError(res.error || "Erreur lors de la modification");
    }
  };

  const confirmDelete = async (revert: boolean) => {
    if (!deleting) return;
    setDeletingBusy(true);
    const res = await api.delete<{ message?: string }>(
      `/api/inventory/${deleting.id}${revert ? "?revert=1" : ""}`
    );
    setDeletingBusy(false);
    if (res.ok) {
      setDeleting(null);
      alert(res.data?.message || "Inventaire supprimé");
      load();
    } else {
      alert(res.error || "Erreur");
    }
  };

  const toggleArchive = async (inv: Inventory) => {
    const res = await api.put(`/api/inventory/${inv.id}`, { archived: inv.status !== "archived" });
    if (res.ok) load();
    else alert(res.error || "Erreur");
  };

  const visible = showArchived ? items : items.filter((i) => i.status !== "archived");
  const archivedCount = items.filter((i) => i.status === "archived").length;
  const draftsCount = items.filter((i) => i.status === "draft").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventaire</h1>
          <p className="text-sm text-slate-500">
            Compter physiquement la boutique et corriger le stock automatiquement
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                showArchived ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Archive className="h-4 w-4" /> Archives ({archivedCount})
            </button>
          )}
          <button
            onClick={() => {
              setShowCreate(!showCreate);
              setCreateError(null);
            }}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" /> Nouvel inventaire
          </button>
        </div>
      </div>

      {/* Mode d'emploi */}
      <div className="mb-5 rounded-2xl bg-blue-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-5 w-5 shrink-0 text-blue-600" />
          <h2 className="font-bold text-blue-950">Comment fonctionne l'inventaire ?</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl bg-white/70 p-3">
              <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                {s.n}
              </div>
              <p className="text-sm font-bold text-slate-900">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-lg bg-white/70 p-2.5 text-xs text-blue-900">
          <strong>Conseil :</strong> faites un inventaire complet une fois par mois, et un inventaire
          partiel chaque semaine sur les produits coûteux (écrans, batteries, powerbanks).
          {draftsCount > 0 && (
            <span className="mt-1 block font-semibold text-orange-700">
              ⚠️ Vous avez {draftsCount} inventaire(s) en cours non finalisé(s).
            </span>
          )}
        </p>
      </div>

      {/* Formulaire de création */}
      {showCreate && (
        <form onSubmit={createInventory} className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Démarrer un inventaire</h2>
            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {createError && (
            <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{createError}</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Titre (facultatif)
              </label>
              <input
                placeholder="Ex : Comptage mensuel septembre"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Portée du comptage</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Toute la boutique</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.productCount ?? 0} produit{c.productCount === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-slate-700">Notes (facultatif)</label>
              <input
                placeholder="Ex : Comptage réalisé par Amadou, vitrine A seulement"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-50"
            >
              {creating ? "Création…" : "Démarrer le comptage"}
            </button>
          </div>
        </form>
      )}

      {/* Liste */}
      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">Chargement…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-slate-400 shadow-sm">
          <ClipboardList className="mx-auto mb-3 h-12 w-12" />
          <p className="font-semibold text-slate-600">
            {showArchived ? "Aucun inventaire archivé" : "Aucun inventaire"}
          </p>
          <p className="mt-1 text-sm">
            Cliquez sur « Nouvel inventaire » pour démarrer votre premier comptage.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((inv) => {
            const meta = STATUS_META[inv.status] || STATUS_META.draft;
            const hasLoss = inv.stats.diffUnits < 0;
            return (
              <div key={inv.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/inventory/${inv.id}`}
                        className="truncate font-bold text-slate-900 hover:text-teal-700 hover:underline"
                      >
                        {inv.label || inv.inventoryNumber}
                      </Link>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.color}`}>
                        {meta.label}
                      </span>
                      {inv.categoryName && (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                          {inv.categoryName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {inv.inventoryNumber} · créé le {formatDateTime(inv.createdAt)}
                      {inv.username ? ` par ${inv.username}` : ""}
                      {inv.completedAt ? ` · terminé le ${formatDateTime(inv.completedAt)}` : ""}
                    </p>
                    {inv.notes && <p className="mt-1 text-xs italic text-slate-500">« {inv.notes} »</p>}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      href={`/admin/inventory/${inv.id}`}
                      className="flex items-center gap-1 rounded-lg bg-teal-50 px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {inv.status === "draft" ? "Continuer" : "Consulter"}
                    </Link>
                    {inv.status !== "archived" && (
                      <button
                        type="button"
                        onClick={() => openEdit(inv)}
                        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        title="Modifier le titre et les notes"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {inv.status !== "draft" && (
                      <button
                        type="button"
                        onClick={() => toggleArchive(inv)}
                        className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        title={inv.status === "archived" ? "Sortir des archives" : "Archiver"}
                      >
                        {inv.status === "archived" ? (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {(inv.status === "draft" || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => setDeleting(inv)}
                        className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                        title="Supprimer cet inventaire"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progression et écarts */}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Comptés</p>
                    <p className="text-lg font-black text-slate-900">
                      {inv.stats.counted}
                      <span className="text-xs font-semibold text-slate-400"> / {inv.stats.total}</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Restants</p>
                    <p
                      className={`text-lg font-black ${
                        inv.stats.remaining > 0 ? "text-orange-600" : "text-green-600"
                      }`}
                    >
                      {inv.stats.remaining}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Écarts</p>
                    <p
                      className={`text-lg font-black ${
                        inv.stats.withDiff > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {inv.stats.withDiff}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Valeur écart</p>
                    <p
                      className={`truncate text-sm font-black ${
                        inv.stats.diffValue < 0 ? "text-red-600" : "text-green-700"
                      }`}
                    >
                      {hasLoss ? "−" : ""}
                      {formatCurrency(Math.abs(inv.stats.diffValue))}
                    </p>
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Progression du comptage</span>
                    <span>{inv.stats.progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        inv.stats.progress === 100 ? "bg-green-500" : "bg-teal-500"
                      }`}
                      style={{ width: `${inv.stats.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal modification */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Modifier l'inventaire</h3>
                <p className="text-xs text-slate-500">{editing.inventoryNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{editError}</p>
            )}

            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Titre</label>
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Ex : Comptage mensuel septembre"
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
                  onClick={() => setEditing(null)}
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

      {/* Fenêtre de suppression */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900">Supprimer l&apos;inventaire</h3>
                <p className="truncate text-xs text-slate-500">
                  {deleting.label || deleting.inventoryNumber} · {STATUS_META[deleting.status]?.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {deleting.status === "draft" ? (
              <>
                <p className="text-sm text-slate-600">
                  Cet inventaire est en cours : {deleting.stats.counted} comptage(s) saisi(s) seront perdus.{" "}
                  <strong>Le stock n&apos;a pas encore été modifié.</strong>
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleting(null)}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(false)}
                    disabled={deletingBusy}
                    className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Cet inventaire a déjà été appliqué au stock ({deleting.stats.withDiff} produit(s) avec écart).
                  Que voulez-vous faire ?
                </p>
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => confirmDelete(false)}
                    disabled={deletingBusy}
                    className="w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 disabled:opacity-50"
                  >
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Trash2 className="h-4 w-4" /> Supprimer seulement la fiche
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Le stock reste tel qu&apos;il a été corrigé. Les corrections restent visibles dans Stock &amp; Mouvements.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(true)}
                    disabled={deletingBusy}
                    className="w-full rounded-xl border border-red-200 bg-red-50 p-3 text-left hover:bg-red-100 disabled:opacity-50"
                  >
                    <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                      <RotateCcw className="h-4 w-4" /> Supprimer et annuler les corrections
                    </p>
                    <p className="mt-0.5 text-xs text-red-600">
                      Le stock revient à son niveau d&apos;avant l&apos;inventaire. Les ventes réalisées depuis sont conservées.
                    </p>
                  </button>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleting(null)}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
