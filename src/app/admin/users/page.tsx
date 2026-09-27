"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { Plus, Users as UsersIcon, Pencil, Trash2, X, Trophy, Eye, TrendingUp, ShoppingCart, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type Role = "admin" | "manager" | "vendor";

type UserRow = {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
};

type Member = {
  id: number;
  fullName: string;
  role: Role;
  active: boolean;
  count: number;
  revenue: number;
  profit: number;
  itemsSold: number;
  avgBasket: number;
  marginPct: number;
  creditGiven: number;
  rank: number | null;
  share: number;
};

type Performance = {
  team: { count: number; revenue: number; profit: number; itemsSold: number; avgBasket: number; marginPct: number };
  members: Member[];
};

const ROLE_LABELS: Record<Role, { label: string; color: string; avatar: string }> = {
  admin: { label: "Administrateur", color: "bg-red-100 text-red-700", avatar: "bg-slate-900" },
  manager: { label: "Gestionnaire", color: "bg-blue-100 text-blue-700", avatar: "bg-blue-600" },
  vendor: { label: "Vendeur", color: "bg-teal-100 text-teal-700", avatar: "bg-green-600" },
};

const PERIODS = [
  { days: 1, label: "Aujourd'hui" },
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 0, label: "Tout" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

const EMPTY_FORM = { fullName: "", username: "", role: "vendor" as Role, pin: "", password: "", phone: "" };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [perf, setPerf] = useState<Performance | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [loadingPerf, setLoadingPerf] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const res = await api.get<UserRow[]>("/api/users");
    if (res.ok && res.data) setUsers(res.data);
    setLoading(false);
  };

  const loadPerf = useCallback(async (d: number) => {
    setLoadingPerf(true);
    const res = await api.get<Performance>(`/api/users/performance?days=${d}`);
    if (res.ok && res.data) setPerf(res.data);
    setLoadingPerf(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadPerf(days);
  }, [days, loadPerf]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await api.post("/api/users", {
      fullName: form.fullName.trim(),
      username: form.username.trim(),
      role: form.role,
      pin: form.pin,
      password: form.password,
      phone: form.phone || null,
    });
    setSaving(false);
    if (res.ok) {
      setForm(EMPTY_FORM);
      setShowCreate(false);
      loadUsers();
      loadPerf(days);
    } else {
      setError(res.error || "Erreur lors de la création");
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (u.id === currentUser?.id) return;
    if (!confirm(`Retirer le compte de "${u.fullName}" ?\n\nS'il a déjà vendu, son compte sera désactivé et son historique conservé.`)) return;
    const res = await api.delete<{ message?: string }>(`/api/users/${u.id}`);
    if (res.ok) {
      alert(res.data?.message || "Opération effectuée");
      loadUsers();
      loadPerf(days);
    } else {
      alert(res.error || "Erreur");
    }
  };

  const chartData = (perf?.members || [])
    .filter((m) => m.count > 0)
    .map((m) => ({
      name: m.fullName.length > 12 ? `${m.fullName.slice(0, 11)}…` : m.fullName,
      CA: Math.round(m.revenue),
      Bénéfice: Math.round(m.profit),
    }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Utilisateurs & Performance</h1>
          <p className="text-sm text-slate-500">Comptes, profils et comparaison des ventes de l&apos;équipe WadAcces</p>
        </div>
        <button
          onClick={() => {
            setShowCreate(!showCreate);
            setError(null);
          }}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" /> Nouvel utilisateur
        </button>
      </div>

      {/* Création */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">Ajouter un collaborateur</h2>
            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-sm font-semibold text-red-700">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Nom complet *</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Ex : Moussa Diop"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Identifiant *</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
                placeholder="Ex : moussa"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Rôle</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="vendor">Vendeur (caisse uniquement)</option>
                <option value="manager">Gestionnaire (bureau limité)</option>
                <option value="admin">Administrateur (accès total)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Code PIN (4 chiffres) {form.role !== "admin" && "*"}
              </label>
              <input
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                inputMode="numeric"
                placeholder="Ex : 4821"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm font-bold tracking-widest"
                required={form.role !== "admin"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Mot de passe {form.role === "admin" ? "*" : "(facultatif)"}
              </label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={form.role === "admin" ? "Obligatoire" : "Le PIN suffit"}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required={form.role === "admin"}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Téléphone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+221 77 000 00 00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Vendeur et gestionnaire se connectent depuis l&apos;accueil avec leur carte + code PIN. Les autres informations
            (e-mail, adresse, notes) se complètent ensuite dans le profil.
          </p>
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
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Création…" : "Créer le compte"}
            </button>
          </div>
        </form>
      )}

      {/* Période */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase text-slate-500">Période :</span>
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => setDays(p.days)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
              days === p.days ? "bg-teal-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Synthèse équipe */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
        {[
          { label: "CA de l'équipe", value: formatCurrency(perf?.team.revenue ?? 0), icon: Wallet, color: "bg-green-500" },
          { label: "Bénéfice", value: formatCurrency(perf?.team.profit ?? 0), icon: TrendingUp, color: "bg-teal-500" },
          { label: "Ventes", value: String(perf?.team.count ?? 0), icon: ShoppingCart, color: "bg-blue-500" },
          { label: "Panier moyen", value: formatCurrency(perf?.team.avgBasket ?? 0), icon: Trophy, color: "bg-amber-500" },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`flex h-6 w-6 items-center justify-center rounded-md ${k.color} text-white`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {k.label}
              </div>
              <p className="mt-2 truncate text-lg font-black text-slate-900 sm:text-xl">{loadingPerf ? "…" : k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Graphique comparatif */}
      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 font-bold text-slate-900">Comparaison des vendeurs</h2>
        {chartData.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucune vente sur cette période</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="CA" fill="#0d9488" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Bénéfice" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Classement */}
      <div className="mb-6 rounded-2xl bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-bold text-slate-900">Classement de l&apos;équipe</h2>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3 text-right">Ventes</th>
                <th className="px-4 py-3 text-right">CA</th>
                <th className="px-4 py-3 text-right">Bénéfice</th>
                <th className="px-4 py-3 text-right">Marge</th>
                <th className="px-4 py-3 text-right">Panier moyen</th>
                <th className="px-4 py-3 text-right">Articles</th>
                <th className="px-4 py-3 text-right">Crédit accordé</th>
                <th className="px-4 py-3">Part du CA</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingPerf ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500">Chargement…</td>
                </tr>
              ) : (
                (perf?.members || []).map((m) => {
                  const meta = ROLE_LABELS[m.role];
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-lg">{m.rank ? MEDALS[m.rank - 1] || `#${m.rank}` : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.avatar} text-sm font-black text-white`}>
                            {m.fullName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{m.fullName}</p>
                            <p className="text-[10px] text-slate-500">
                              {meta.label}
                              {!m.active && " · désactivé"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{m.count}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(m.revenue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(m.profit)}</td>
                      <td className="px-4 py-3 text-right">{m.marginPct.toFixed(1)} %</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(m.avgBasket)}</td>
                      <td className="px-4 py-3 text-right">{m.itemsSold}</td>
                      <td className={`px-4 py-3 text-right ${m.creditGiven > 0 ? "font-semibold text-orange-600" : "text-slate-400"}`}>
                        {formatCurrency(m.creditGiven)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, m.share)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{m.share.toFixed(0)} %</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/users/${m.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100"
                        >
                          <Eye className="h-3.5 w-3.5" /> Profil
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comptes */}
      <div className="rounded-2xl bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <UsersIcon className="h-5 w-5 text-slate-500" />
          <h2 className="font-bold text-slate-900">Comptes utilisateurs</h2>
        </div>
        <div className="table-scroll">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Chargement…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Dernière connexion</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const meta = ROLE_LABELS[u.role];
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {u.fullName}
                          {isCurrent && (
                            <span className="ml-2 rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">Vous</span>
                          )}
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">{u.username}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {u.active ? "Actif" : "Désactivé"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{u.phone || "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Jamais"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100"
                          >
                            <Eye className="h-3.5 w-3.5" /> Profil
                          </Link>
                          <Link
                            href={`/admin/users/${u.id}?edit=1`}
                            className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Modifier
                          </Link>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleDelete(u)}
                              className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
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
      </div>
    </div>
  );
}
