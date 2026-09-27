"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatCurrency } from "@/lib/utils";
import { DebtManager } from "@/components/debt-manager";
import { useAuth } from "@/components/auth-provider";
import { Plus, Truck, Phone, Search, Pencil, Trash2, X, Check, Building2, MapPin } from "lucide-react";

type Supplier = {
  id: number;
  name: string;
  phone?: string | null;
  company?: string | null;
  address?: string | null;
  email?: string | null;
  notes?: string | null;
  totalPurchases: string | number;
  debt: string | number;
  active: boolean;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [debtTarget, setDebtTarget] = useState<Supplier | null>(null);

  // Formulaire création
  const [form, setForm] = useState({
    name: "",
    phone: "",
    company: "",
    address: "",
    notes: "",
    initialDebt: "",
  });

  // Formulaire modification
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    company: "",
    address: "",
    notes: "",
    active: true,
  });

  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await api.get<any>(`/api/suppliers?q=${encodeURIComponent(q)}&pageSize=200`);
    if (res.ok && res.data) setItems(res.data.items || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const res = await api.post("/api/suppliers", { ...form, initialDebt: Number(form.initialDebt) || 0 });
    if (res.ok) {
      setForm({ name: "", phone: "", company: "", address: "", notes: "", initialDebt: "" });
      setShowForm(false);
      load();
    } else {
      alert(res.error || "Erreur lors de la création");
    }
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setEditError(null);
    setEditForm({
      name: s.name,
      phone: s.phone || "",
      company: s.company || "",
      address: s.address || "",
      notes: s.notes || "",
      active: s.active,
    });
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await api.put(`/api/suppliers/${editingSupplier.id}`, editForm);
      if (!res.ok) {
        setEditError(res.error || "Erreur lors de la modification");
        return;
      }
      setEditingSupplier(null);
      load();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (s: Supplier) => {
    const debt = toNum(s.debt);
    if (debt > 0) {
      if (!confirm(`Attention : nous devons ${formatCurrency(debt)} à ce fournisseur. Voulez-vous vraiment le désactiver ?`)) {
        return;
      }
    } else if (!confirm(`Voulez-vous retirer le fournisseur "${s.name}" ?`)) {
      return;
    }
    const res = await api.delete<{ message?: string }>(`/api/suppliers/${s.id}`);
    if (res.ok) {
      alert(res.data?.message || "Fournisseur retiré");
      load();
    } else {
      alert(res.error || "Erreur lors de la suppression");
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fournisseurs</h1>
          <p className="text-sm text-slate-500">
            Gestion des fournisseurs d'accessoires et suivi des dettes fournisseurs.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" /> Nouveau fournisseur
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitCreate} className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Ajouter un nouveau fournisseur</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nom du contact / Fournisseur *</label>
              <input
                placeholder="Ex : Ets Diallo Import"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Téléphone</label>
              <input
                placeholder="Ex : +221 77 512 40 18"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Société / Entreprise</label>
              <input
                placeholder="Ex : Diallo & Frères SARL"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Adresse / Ville</label>
              <input
                placeholder="Ex : Marché Sandaga, Dakar"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Montant que vous lui devez (FCFA)</label>
              <input
                type="number"
                min="0"
                step="50"
                placeholder="0 = aucune dette"
                value={form.initialDebt}
                onChange={(e) => setForm({ ...form, initialDebt: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Annuler
            </button>
            <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow">
              Enregistrer le fournisseur
            </button>
          </div>
        </form>
      )}

      {/* Barre de recherche */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Rechercher par nom, téléphone, société…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>
        <button onClick={load} className="rounded-xl bg-slate-800 px-5 text-sm font-semibold text-white">
          Rechercher
        </button>
      </div>

      {/* Liste fournisseurs */}
      <div className="table-scroll rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Truck className="mx-auto mb-2 h-10 w-10" />
            Aucun fournisseur
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Fournisseur</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Société / Adresse</th>
                <th className="px-4 py-3 text-right">Total achats</th>
                <th className="px-4 py-3 text-right">Dette fournisseur</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((s) => {
                const debt = toNum(s.debt);
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {s.name}
                      {!s.active && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          Désactivé
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.phone ? (
                        <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-slate-600 hover:text-teal-700">
                          <Phone className="h-3.5 w-3.5 text-slate-400" /> {s.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.company && (
                        <div className="flex items-center gap-1 font-medium">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" /> {s.company}
                        </div>
                      )}
                      {s.address && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3" /> {s.address}
                        </div>
                      )}
                      {!s.company && !s.address && "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatCurrency(toNum(s.totalPurchases))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <span className={`font-black ${debt > 0 ? "text-red-600" : "text-slate-400"}`}>
                          {formatCurrency(debt)}
                        </span>
                        {debt > 0 ? (
                          <span className="rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                            Vous devez
                          </span>
                        ) : (
                          <span className="rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700">
                            Aucune dette
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setDebtTarget(s)}
                          className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                          title="Ajouter une dette, enregistrer un paiement, voir l'historique"
                        >
                          {debt > 0 ? "Gérer la dette" : "+ Ajouter une dette"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          title="Modifier les coordonnées"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Modifier
                        </button>
                        {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                          title="Retirer ce fournisseur"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Retirer
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Modification Fournisseur */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Modifier : {editingSupplier.name}
                </h3>
                <p className="text-xs text-slate-500">Fournisseur #{editingSupplier.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSupplier(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{editError}</p>
            )}

            <form onSubmit={submitEdit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Nom du fournisseur *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Téléphone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Société / Entreprise</label>
                  <input
                    type="text"
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Adresse / Ville / Pays</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Notes / Conditions de livraison</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                    className="h-4 w-4 rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Fournisseur actif</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
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
                  {savingEdit ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {debtTarget && (
        <DebtManager
          kind="supplier"
          entityId={debtTarget.id}
          entityName={debtTarget.name}
          canCorrect={isAdmin}
          onClose={() => setDebtTarget(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
