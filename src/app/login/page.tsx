"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type Portal } from "@/components/auth-provider";
import { Numpad } from "@/components/numpad";
import { api } from "@/lib/client-api";
import { ShoppingCart, ArrowLeft, User as UserIcon, ClipboardList, ShieldCheck } from "lucide-react";

type Profile = { id: number; fullName: string; role: string };
type Step = "choice" | "admin" | "pick" | "pin";

const PORTAL_META: Record<Portal, { title: string; question: string; empty: string; color: string; avatar: string; tile: string }> = {
  vendor: {
    title: "Vendeur",
    question: "Qui vend ?",
    empty: "Aucun vendeur. L'administrateur doit en créer un.",
    color: "bg-green-600",
    avatar: "bg-green-600",
    tile: "bg-green-50",
  },
  manager: {
    title: "Gestionnaire",
    question: "Quel gestionnaire ?",
    empty: "Aucun gestionnaire. L'administrateur doit en créer un.",
    color: "bg-blue-600",
    avatar: "bg-blue-600",
    tile: "bg-blue-50",
  },
};

export default function LoginPage() {
  const { user, login, loginWithPin, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("choice");
  const [portal, setPortal] = useState<Portal>("vendor");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSetup, setIsSetup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [picked, setPicked] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (user) {
      router.replace(user.role === "vendor" ? "/vendor" : "/admin");
    }
  }, [user, router]);

  const openPortal = async (p: Portal) => {
    setError(null);
    setPortal(p);
    setPicked(null);
    setPin("");
    setStep("pick");
    setLoadingProfiles(true);
    const res = await api.get<Profile[]>(`/api/auth/vendors?role=${p}`);
    setProfiles(res.ok && res.data ? res.data : []);
    setLoadingProfiles(false);
  };

  const handleAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(username.trim(), password, isSetup, isSetup ? fullName : undefined, "admin");
      if (!res.ok) setError(res.error || "Identifiants incorrects");
    } finally {
      setSubmitting(false);
    }
  };

  const submitPin = async (value: string) => {
    if (!picked || value.length < 4) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await loginWithPin(picked.id, value, portal);
      if (!res.ok) {
        setError(res.error === "Code incorrect" || !res.error ? "Code incorrect" : res.error);
        setPin("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-800">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  const meta = PORTAL_META[portal];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-teal-800 to-teal-950 p-4">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-4xl shadow-xl">
            📱
          </div>
          <h1 className="text-4xl font-black tracking-tight">WadAcces</h1>
          <p className="mt-1 text-teal-100">Accessoires téléphone</p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-red-500 p-4 text-center text-lg font-bold text-white">{error}</div>
        )}

        {step === "choice" && (
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => openPortal("vendor")}
              className="flex min-h-[150px] flex-col items-center justify-center rounded-[2rem] bg-green-500 p-6 text-white shadow-2xl active:scale-95"
            >
              <ShoppingCart className="mb-2 h-16 w-16" strokeWidth={2.5} />
              <span className="text-4xl font-black">VENDRE</span>
              <span className="mt-1 text-lg font-semibold text-green-50">Caisse</span>
            </button>

            <button
              type="button"
              onClick={() => openPortal("manager")}
              className="flex min-h-[110px] flex-col items-center justify-center rounded-[2rem] bg-blue-600 p-5 text-white shadow-2xl active:scale-95"
            >
              <ClipboardList className="mb-1.5 h-11 w-11" />
              <span className="text-2xl font-black">GESTIONNAIRE</span>
              <span className="mt-0.5 text-sm text-blue-100">Stock · clients · rapports</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("admin");
              }}
              className="flex min-h-[96px] flex-col items-center justify-center rounded-[2rem] bg-slate-900 p-5 text-white shadow-2xl active:scale-95"
            >
              <ShieldCheck className="mb-1.5 h-10 w-10" />
              <span className="text-2xl font-black">ADMINISTRATEUR</span>
              <span className="mt-0.5 text-sm text-slate-300">Accès complet</span>
            </button>
          </div>
        )}

        {step === "pick" && (
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setStep("choice");
                setError(null);
              }}
              className="mb-3 flex items-center gap-2 text-slate-600"
            >
              <ArrowLeft className="h-5 w-5" /> Retour
            </button>
            <p className="mb-3 text-center text-xl font-bold text-slate-800">{meta.question}</p>
            <div className="grid gap-3">
              {loadingProfiles && <p className="py-6 text-center text-slate-500">Chargement…</p>}
              {!loadingProfiles && profiles.length === 0 && (
                <p className="py-6 text-center text-slate-500">{meta.empty}</p>
              )}
              {profiles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setPicked(v);
                    setPin("");
                    setError(null);
                    setStep("pin");
                  }}
                  className={`flex min-h-[88px] items-center gap-4 rounded-2xl ${meta.tile} px-4 py-3 text-left active:scale-95`}
                >
                  <div
                    className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${meta.avatar} text-3xl font-black text-white`}
                  >
                    {v.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-2xl font-black text-slate-900">{v.fullName}</p>
                    <p className="text-sm text-slate-500">{meta.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "pin" && picked && (
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setStep("pick");
                setPin("");
                setError(null);
              }}
              className="mb-3 flex items-center gap-2 text-slate-600"
            >
              <ArrowLeft className="h-5 w-5" /> Retour
            </button>
            <div className="mb-3 text-center">
              <div
                className={`mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl ${meta.avatar} text-2xl font-black text-white`}
              >
                {picked.fullName.charAt(0).toUpperCase()}
              </div>
              <p className="text-xl font-black">{picked.fullName}</p>
              <p className="text-slate-500">Entrez le code</p>
              <div className="mt-3 flex justify-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-4 w-4 rounded-full ${pin.length > i ? meta.avatar : "bg-slate-200"}`}
                  />
                ))}
              </div>
            </div>
            <Numpad
              onDigit={(d) => {
                if (submitting) return;
                const next = (pin + d).slice(0, 4);
                setPin(next);
                if (next.length === 4) submitPin(next);
              }}
              onBackspace={() => setPin((p) => p.slice(0, -1))}
              onOk={() => submitPin(pin)}
            />
            {submitting && <p className="mt-3 text-center text-slate-500">Vérification…</p>}
          </div>
        )}

        {step === "admin" && (
          <div className="rounded-3xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setStep("choice");
                setError(null);
              }}
              className="mb-3 flex items-center gap-2 text-slate-600"
            >
              <ArrowLeft className="h-5 w-5" /> Retour
            </button>
            <h2 className="mb-4 text-center text-2xl font-black">Administrateur</h2>
            <form onSubmit={handleAdmin} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  <UserIcon className="mr-1 inline h-4 w-4" /> Nom d&apos;utilisateur
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                  autoComplete="current-password"
                  required
                />
              </div>
              {isSetup && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Votre nom</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
                    required
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-lg font-bold text-white disabled:opacity-60"
              >
                {submitting ? "Connexion…" : isSetup ? "Configurer" : "Entrer"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setIsSetup(!isSetup);
                setError(null);
              }}
              className="mt-4 w-full text-center text-sm text-teal-700"
            >
              {isSetup ? "← Retour" : "Première utilisation ?"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
