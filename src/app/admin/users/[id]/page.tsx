"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  X,
  Check,
  Phone,
  Mail,
  MapPin,
  StickyNote,
  CalendarDays,
  LogIn,
  KeyRound,
  Trophy,
  Package,
  ClipboardList,
  Download,
  PackageMinus,
  WifiOff,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type Role = "admin" | "manager" | "vendor";

type Profile = {
  id: number;
  username: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  hasPin: boolean;
};

type Stats = {
  period: { days: number; monthly: boolean };
  summary: {
    count: number;
    revenue: number;
    profit: number;
    itemsSold: number;
    avgBasket: number;
    marginPct: number;
    creditGiven: number;
    creditCount: number;
    offlineCount: number;
    wholesaleCount: number;
    lastSaleAt: string | null;
    share: number;
  };
  series: Array<{ bucket: string; revenue: number; profit: number; count: number }>;
  topProducts: Array<{ name: string; qty: number; revenue: number; profit: number }>;
  payments: Array<{ method: string; count: number; revenue: number }>;
  recentSales: Array<{
    id: number;
    saleNumber: string;
    totalAmount: string | number;
    profit: string | number;
    paymentMethod: string;
    paymentStatus: string;
    customerName: string | null;
    createdAt: string;
  }>;
  activity: { receptions: number; receptionsTotal: number; adjustments: number; adjustedUnits: number; inventories: number };
  team: { revenue: number; rank: number | null; sellers: number };
};

const ROLE_META: Record<Role, { label: string; color: string; avatar: string; rights: string[] }> = {
  admin: {
    label: "Administrateur",
    color: "bg-red-100 text-red-700",
    avatar: "bg-slate-900",
    rights: ["Accès total au bureau", "Gère les utilisateurs et les paramètres", "Peut tout supprimer"],
  },
  manager: {
    label: "Gestionnaire",
    color: "bg-blue-100 text-blue-700",
    avatar: "bg-blue-600",
    rights: [
      "Stock, inventaire, produits, clients, fournisseurs, dettes, rapports",
      "Ne peut rien supprimer",
      "Pas d'accès aux utilisateurs ni aux paramètres",
    ],
  },
  vendor: {
    label: "Vendeur",
    color: "bg-teal-100 text-teal-700",
    avatar: "bg-green-600",
    rights: ["Caisse : vendre, voir le stock, réceptionner", "Aucun accès au bureau"],
  },
};

const PERIODS = [
  { days: 1, label: "Aujourd'hui" },
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
  { days: 0, label: "Tout" },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "💵 Espèces",
  mobile_money: "📱 Mobile Money",
  transfer: "🏦 Virement",
  credit: "📝 Crédit",
  other: "Autre",
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

function bucketLabel(bucket: string, monthly: boolean): string {
  const parts = bucket.split("-");
  return monthly ? `${parts[1]}/${parts[0]}` : `${parts[2]}/${parts[1]}`;
}

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const id = parseInt(params.id, 10);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    role: "vendor" as Role,
    phone: "",
    email: "",
    address: "",
    notes: "",
    pin: "",
    password: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = currentUser?.id === id;

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const res = await api.get<Profile>(`/api/users/${id}`);
    if (res.ok && res.data) setProfile(res.data);
    setLoading(false);
  }, [id]);

  const loadStats = useCallback(
    async (d: number) => {
      setLoadingStats(true);
      const res = await api.get<Stats>(`/api/users/${id}/stats?days=${d}`);
      if (res.ok && res.data) setStats(res.data);
      setLoadingStats(false);
    },
    [id]
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadStats(days);
  }, [days, loadStats]);

  const openEdit = useCallback(() => {
    if (!profile) return;
    setError(null);
    setForm({
      fullName: profile.fullName,
      username: profile.username,
      role: profile.role,
      phone: profile.phone || "",
      email: profile.email || "",
      address: profile.address || "",
      notes: profile.notes || "",
      pin: "",
      password: "",
      active: profile.active,
    });
    setEditing(true);
  }, [profile]);

  // Ouverture directe de l'éditeur via le bouton « Modifier » de la liste.
  useEffect(() => {
    if (profile && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edit") === "1") {
      openEdit();
      window.history.replaceState(null, "", `/admin/users/${id}`);
    }
  }, [profile, openEdit, id]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      username: form.username.trim(),
      role: form.role,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    };
    if (form.pin) payload.pin = form.pin;
    if (form.password) payload.password = form.password;
    const res = await api.put(`/api/users/${id}`, payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.error || "Erreur lors de l'enregistrement");
      return;
    }
    setEditing(false);
    loadProfile();
    loadStats(days);
  };

  const remove = async () => {
    if (!profile || isSelf) return;
    if (!confirm(`Retirer le compte de "${profile.fullName}" ?\n\nS'il a déjà vendu, son compte sera désactivé et son historique conservé.`)) return;
    const res = await api.delete<{ message?: string }>(`/api/users/${id}`);
    if (res.ok) {
      alert(res.data?.message || "Opération effectuée");
      router.push("/admin/users");
    } else {
      alert(res.error || "Erreur");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-slate-600">Utilisateur introuvable</p>
        <Link href="/admin/users" className="mt-3 inline-block text-teal-700 hover:underline">
          ← Retour aux utilisateurs
        </Link>
      </div>
    );
  }

  const meta = ROLE_META[profile.role];
  const s = stats?.summary;
  const monthly = stats?.period.monthly ?? false;
  const chartData = (stats?.series || []).map((p) => ({
    label: bucketLabel(p.bucket, monthly),
    CA: Math.round(p.revenue),
    Bénéfice: Math.round(p.profit),
  }));
  const maxTopQty = Math.max(1, ...(stats?.topProducts || []).map((p) => p.qty));
  const paymentTotal = (stats?.payments || []).reduce((sum, p) => sum + p.revenue, 0);

  const kpis = [
    { label: "Ventes", value: String(s?.count ?? 0) },
    { label: "Chiffre d'affaires", value: formatCurrency(s?.revenue ?? 0) },
    { label: "Bénéfice", value: formatCurrency(s?.profit ?? 0), tone: "text-green-700" },
    { label: "Marge", value: `${(s?.marginPct ?? 0).toFixed(1)} %` },
    { label: "Panier moyen", value: formatCurrency(s?.avgBasket ?? 0) },
    { label: "Articles vendus", value: String(s?.itemsSold ?? 0) },
    {
      label: "Crédit accordé",
      value: formatCurrency(s?.creditGiven ?? 0),
      tone: (s?.creditGiven ?? 0) > 0 ? "text-orange-600" : undefined,
    },
    {
      label: "Place dans l'équipe",
      value: stats?.team.rank ? `${stats.team.rank}ᵉ / ${stats.team.sellers}` : "—",
      sub: `${(s?.share ?? 0).toFixed(0)} % du CA`,
    },
  ];

  return (
    <div>
      {/* En-tête */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/admin/users" className="shrink-0 rounded-lg bg-white p-2 shadow hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${meta.avatar} text-2xl font-black text-white`}>
          {profile.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">{profile.fullName}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.color}`}>{meta.label}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                profile.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              {profile.active ? "Actif" : "Désactivé"}
            </span>
            {isSelf && <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">Vous</span>}
          </div>
          <p className="font-mono text-xs text-slate-500">@{profile.username}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={openEdit}
            className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-sm font-bold text-white shadow hover:bg-teal-700"
          >
            <Pencil className="h-4 w-4" /> Modifier
          </button>
          {!isSelf && (
            <button
              type="button"
              onClick={remove}
              className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3.5 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
            >
              <Trash2 className="h-4 w-4" /> Retirer
            </button>
          )}
        </div>
      </div>

      {/* Fiche + droits */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:col-span-2 sm:p-5">
          <h2 className="mb-3 font-bold text-slate-900">Fiche collaborateur</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[
              { icon: Phone, label: "Téléphone", value: profile.phone },
              { icon: Mail, label: "E-mail", value: profile.email },
              { icon: MapPin, label: "Adresse", value: profile.address },
              { icon: KeyRound, label: "Code PIN caisse", value: profile.hasPin ? "Défini ✓" : "Non défini" },
              { icon: CalendarDays, label: "Compte créé le", value: formatDateTime(profile.createdAt) },
              { icon: LogIn, label: "Dernière connexion", value: profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : "Jamais" },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase text-slate-500">{row.label}</dt>
                    <dd className="break-words font-semibold text-slate-800">{row.value || "—"}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
          {profile.notes && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="whitespace-pre-line">{profile.notes}</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 font-bold text-slate-900">Droits du rôle</h2>
          <ul className="space-y-2">
            {meta.rights.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> {r}
              </li>
            ))}
          </ul>
          {s?.lastSaleAt && (
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              Dernière vente sur la période : <strong>{formatDateTime(s.lastSaleAt)}</strong>
            </p>
          )}
        </div>
      </div>

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

      {/* Indicateurs */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 [&>*]:min-w-0">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase text-slate-500">{k.label}</p>
            <p className={`mt-1 truncate text-lg font-black sm:text-xl ${k.tone || "text-slate-900"}`}>
              {loadingStats ? "…" : k.value}
            </p>
            {k.sub && !loadingStats && <p className="text-[11px] text-slate-500">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Évolution */}
      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 font-bold text-slate-900">Évolution des ventes</h2>
        {chartData.length === 0 || (s?.count ?? 0) === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Aucune vente sur cette période</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="CA" stroke="#0d9488" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Bénéfice" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        {/* Produits */}
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-slate-900">
            <Trophy className="h-4 w-4 text-amber-500" /> Produits les plus vendus
          </h2>
          {(stats?.topProducts || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucun produit vendu</p>
          ) : (
            <ul className="space-y-3">
              {stats!.topProducts.map((p) => (
                <li key={p.name}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-semibold text-slate-800">{p.name}</span>
                    <span className="shrink-0 font-black text-slate-900">×{p.qty}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${(p.qty / maxTopQty) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatCurrency(p.revenue)} · bénéfice {formatCurrency(p.profit)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Paiements */}
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 font-bold text-slate-900">Moyens de paiement</h2>
          {(stats?.payments || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Aucun paiement</p>
          ) : (
            <ul className="space-y-3">
              {stats!.payments.map((p) => {
                const pct = paymentTotal > 0 ? (p.revenue / paymentTotal) * 100 : 0;
                return (
                  <li key={p.method}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-semibold text-slate-800">{PAYMENT_LABELS[p.method] || p.method}</span>
                      <span className="text-xs font-bold text-slate-600">{pct.toFixed(0)} %</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {p.count} vente(s) · {formatCurrency(p.revenue)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Autres activités */}
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 font-bold text-slate-900">Autres activités</h2>
          <ul className="space-y-2.5 text-sm">
            {[
              { icon: Download, label: "Réceptions de marchandise", value: `${stats?.activity.receptions ?? 0} · ${formatCurrency(stats?.activity.receptionsTotal ?? 0)}` },
              { icon: PackageMinus, label: "Sorties classées (casse, perte…)", value: `${stats?.activity.adjustments ?? 0} · ${stats?.activity.adjustedUnits ?? 0} unité(s)` },
              { icon: ClipboardList, label: "Inventaires créés", value: String(stats?.activity.inventories ?? 0) },
              { icon: Package, label: "Ventes en gros", value: String(s?.wholesaleCount ?? 0) },
              { icon: WifiOff, label: "Ventes faites hors ligne", value: String(s?.offlineCount ?? 0) },
            ].map((row) => {
              const Icon = row.icon;
              return (
                <li key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="shrink-0 font-bold text-slate-900">{loadingStats ? "…" : row.value}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Dernières ventes */}
      <div className="rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="font-bold text-slate-900">Dernières ventes</h2>
        </div>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">N°</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Paiement</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Bénéfice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(stats?.recentSales || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">Aucune vente sur cette période</td>
                </tr>
              ) : (
                stats!.recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold">
                      <Link href={`/admin/sales/${sale.id}`} className="text-teal-700 hover:underline">
                        {sale.saleNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(sale.createdAt)}</td>
                    <td className="px-4 py-3">{sale.customerName || "—"}</td>
                    <td className="px-4 py-3 text-xs">{PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(toNum(sale.totalAmount))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(toNum(sale.profit))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Éditeur complet */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Modifier le profil</h3>
                <p className="text-xs text-slate-500">{profile.fullName}</p>
              </div>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={save} className="space-y-5 p-4 sm:p-5">
              {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

              <div>
                <p className="mb-2 text-xs font-bold uppercase text-slate-500">Identité</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Nom complet *</label>
                    <input
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Identifiant *</label>
                    <input
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase text-slate-500">Coordonnées</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Téléphone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+221 77 000 00 00"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">E-mail</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-slate-700">Adresse</label>
                    <input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-slate-700">Notes internes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      rows={2}
                      placeholder="Ex : Horaires, points forts, remarques…"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase text-slate-500">Accès</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Rôle</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                      disabled={isSelf}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold disabled:bg-slate-100"
                    >
                      <option value="vendor">Vendeur</option>
                      <option value="manager">Gestionnaire</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Nouveau PIN</label>
                    <input
                      value={form.pin}
                      onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      inputMode="numeric"
                      placeholder="Inchangé"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm font-bold tracking-widest"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Inchangé"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                {form.role !== "admin" && !profile.hasPin && !form.pin && (
                  <p className="mt-2 text-xs font-semibold text-orange-600">
                    Ce rôle se connecte avec un code PIN : définissez-en un (4 chiffres).
                  </p>
                )}
                <label className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={form.active}
                    disabled={isSelf}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="h-4 w-4 rounded text-teal-600"
                  />
                  Compte actif (autorisé à se connecter)
                </label>
                {isSelf && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Votre propre rôle et votre statut ne peuvent pas être modifiés.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-teal-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
