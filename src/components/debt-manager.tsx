"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { X, Plus, Banknote, PencilLine, History, Check } from "lucide-react";

type Kind = "customer" | "supplier";
type Action = "add" | "pay" | "set";

type DebtLog = {
  id: number;
  type: "charge" | "payment";
  amount: string | number;
  note: string | null;
  createdAt: string;
  userName: string | null;
  reference: string | null;
  paymentMethod: string | null;
};

type HistoryData = {
  entity: { id: number; name: string; phone?: string | null; debt: number };
  logs: DebtLog[];
  totals: { charged: number; paid: number };
};

const TEXTS: Record<Kind, { owes: string; none: string; add: string; addHint: string; pay: string; payHint: string; charge: string; payment: string }> = {
  customer: {
    owes: "Le client doit",
    none: "Ce client ne doit rien",
    add: "Ajouter une dette",
    addHint: "Le client prend à crédit ou doit une somme : elle s'ajoute à son solde.",
    pay: "Paiement reçu",
    payHint: "Le client rembourse : la somme est retirée de sa dette.",
    charge: "Dette ajoutée",
    payment: "Paiement reçu",
  },
  supplier: {
    owes: "Vous devez",
    none: "Vous ne devez rien à ce fournisseur",
    add: "Ajouter une dette",
    addHint: "Marchandise reçue à crédit ou somme due : elle s'ajoute au solde.",
    pay: "Paiement effectué",
    payHint: "Vous payez le fournisseur : la somme est retirée de la dette.",
    charge: "Dette ajoutée",
    payment: "Paiement effectué",
  },
};

const METHODS: Array<{ value: string; label: string }> = [
  { value: "cash", label: "💵 Espèces" },
  { value: "mobile_money", label: "📱 Mobile Money" },
  { value: "transfer", label: "🏦 Virement" },
  { value: "other", label: "Autre" },
];

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export function DebtManager({
  kind,
  entityId,
  entityName,
  canCorrect,
  onClose,
  onChanged,
}: {
  kind: Kind;
  entityId: number;
  entityName: string;
  canCorrect: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = TEXTS[kind];
  const base = `/api/${kind}s/${entityId}`;
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<Action>("add");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<HistoryData>(`${base}/debt`);
    if (res.ok && res.data) {
      setData(res.data);
      if (res.data.entity.debt > 0) setAction((a) => (a === "add" ? "pay" : a));
    } else {
      setError(res.error || "Impossible de charger la dette");
    }
    setLoading(false);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  const debt = data?.entity.debt ?? 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const value = parseFloat(amount.replace(/\s/g, "").replace(",", "."));
    if (Number.isNaN(value) || value < 0 || (action !== "set" && value === 0)) {
      setError("Saisissez un montant valide");
      return;
    }
    if (action === "pay" && value > debt + 0.01) {
      setError(`Le paiement dépasse la dette actuelle (${formatCurrency(debt)})`);
      return;
    }

    setSaving(true);
    let res;
    if (action === "add") {
      res = await api.post(`${base}/debt`, { amount: value, note: note.trim() || null });
    } else if (action === "pay") {
      res = await api.post(`${base}/pay`, { amount: value, method, note: note.trim() || null });
    } else {
      res = await api.put(`${base}/debt`, { debt: value, note: note.trim() || null });
    }
    setSaving(false);

    if (!res.ok) {
      setError(res.error || "Opération impossible");
      return;
    }
    setSuccess(
      action === "add"
        ? `✅ ${formatCurrency(value)} ajoutés à la dette`
        : action === "pay"
        ? `✅ Paiement de ${formatCurrency(value)} enregistré`
        : `✅ Dette corrigée à ${formatCurrency(value)}`
    );
    setAmount("");
    setNote("");
    await load();
    onChanged();
  };

  const tabs: Array<{ key: Action; label: string; icon: typeof Plus; show: boolean }> = [
    { key: "add", label: t.add, icon: Plus, show: true },
    { key: "pay", label: t.pay, icon: Banknote, show: debt > 0 },
    { key: "set", label: "Corriger le montant", icon: PencilLine, show: canCorrect },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* En-tête : solde actuel */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dette</p>
            <h3 className="truncate text-lg font-bold text-slate-900">{entityName}</h3>
            {data?.entity.phone && <p className="text-xs text-slate-500">{data.entity.phone}</p>}
          </div>
          <div className="flex items-start gap-2">
            <div className={`rounded-xl px-4 py-2 text-right ${debt > 0 ? "bg-red-50" : "bg-green-50"}`}>
              <p className={`text-[11px] font-bold ${debt > 0 ? "text-red-700" : "text-green-700"}`}>
                {debt > 0 ? t.owes : t.none}
              </p>
              <p className={`text-2xl font-black ${debt > 0 ? "text-red-600" : "text-green-700"}`}>
                {formatCurrency(debt)}
              </p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          {/* Choix de l'action */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {tabs
              .filter((tab) => tab.show)
              .map((tab) => {
                const Icon = tab.icon;
                const active = action === tab.key;
                const tone =
                  tab.key === "add"
                    ? active
                      ? "bg-red-600 text-white"
                      : "bg-red-50 text-red-700 hover:bg-red-100"
                    : tab.key === "pay"
                    ? active
                      ? "bg-green-600 text-white"
                      : "bg-green-50 text-green-700 hover:bg-green-100"
                    : active
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200";
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setAction(tab.key);
                      setError(null);
                      setSuccess(null);
                      setAmount(tab.key === "set" ? String(debt) : "");
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${tone}`}
                  >
                    <Icon className="h-4 w-4" /> {tab.label}
                  </button>
                );
              })}
          </div>

          {/* Formulaire */}
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 p-4">
            <p className="mb-3 text-xs text-slate-500">
              {action === "add"
                ? t.addHint
                : action === "pay"
                ? t.payHint
                : "Indiquez directement le montant exact dû. L'écart est enregistré dans l'historique."}
            </p>

            {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-sm font-bold text-red-700">❌ {error}</p>}
            {success && <p className="mb-3 rounded-lg bg-green-50 p-2.5 text-sm font-bold text-green-700">{success}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  {action === "set" ? "Nouveau montant dû (FCFA)" : "Montant (FCFA)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xl font-black focus:border-teal-500 focus:outline-none"
                  autoFocus
                  required
                />
                {action === "pay" && debt > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(debt))}
                    className="mt-2 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700 hover:bg-green-100"
                  >
                    Tout régler ({formatCurrency(debt)})
                  </button>
                )}
                {action === "set" && (
                  <button
                    type="button"
                    onClick={() => setAmount("0")}
                    className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
                  >
                    Mettre à 0 FCFA
                  </button>
                )}
              </div>

              {action === "pay" ? (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Moyen de paiement</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold"
                  >
                    {METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="hidden sm:block" />
              )}

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-700">Note (facultatif)</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    action === "add"
                      ? "Ex : 10 écrans A12 pris à crédit, à payer vendredi"
                      : action === "pay"
                      ? "Ex : Remboursement partiel en Orange Money"
                      : "Ex : Accord trouvé avec le client"
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {amount && !Number.isNaN(parseFloat(amount)) && (
              <p className="mt-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                Solde après opération :{" "}
                <strong className="text-slate-900">
                  {formatCurrency(
                    action === "add"
                      ? debt + parseFloat(amount)
                      : action === "pay"
                      ? Math.max(0, debt - parseFloat(amount))
                      : parseFloat(amount)
                  )}
                </strong>
              </p>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving || loading}
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-teal-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {saving ? "Enregistrement…" : "Valider"}
              </button>
            </div>
          </form>

          {/* Historique */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <History className="h-4 w-4" /> Historique
              </h4>
              {data && (
                <p className="text-[11px] text-slate-500">
                  Total ajouté <strong className="text-red-600">{formatCurrency(data.totals.charged)}</strong> · Total payé{" "}
                  <strong className="text-green-700">{formatCurrency(data.totals.paid)}</strong>
                </p>
              )}
            </div>
            {loading ? (
              <p className="p-4 text-center text-sm text-slate-500">Chargement…</p>
            ) : !data || data.logs.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400">Aucune opération enregistrée</p>
            ) : (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {data.logs.map((l) => {
                  const isCharge = l.type === "charge";
                  return (
                    <li key={l.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800">
                          {isCharge ? t.charge : t.payment}
                          {l.reference && <span className="ml-1 font-mono text-[11px] text-slate-400">· {l.reference}</span>}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatDateTime(l.createdAt)}
                          {l.userName ? ` · ${l.userName}` : ""}
                          {!isCharge && l.paymentMethod ? ` · ${METHODS.find((m) => m.value === l.paymentMethod)?.label ?? l.paymentMethod}` : ""}
                        </p>
                        {l.note && <p className="mt-0.5 text-xs italic text-slate-500">{l.note}</p>}
                      </div>
                      <span className={`shrink-0 text-sm font-black ${isCharge ? "text-red-600" : "text-green-700"}`}>
                        {isCharge ? "+" : "−"}
                        {formatCurrency(toNum(l.amount))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
