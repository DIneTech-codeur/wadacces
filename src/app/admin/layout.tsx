"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Download,
  Users,
  UserCircle2,
  Truck,
  ClipboardList,
  TrendingUp,
  Settings,
  Menu,
  X,
  LogOut,
  Store,
  History,
  Boxes,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client-api";

const NAV = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/alerts", label: "Alertes", icon: BellRing, badge: true },
  { href: "/admin/sales", label: "Ventes", icon: ShoppingCart },
  { href: "/admin/purchases", label: "Achats", icon: Download },
  { href: "/admin/products", label: "Produits", icon: Package },
  { href: "/admin/categories", label: "Catégories", icon: Tags },
  { href: "/admin/stock", label: "Stock & Mouvements", icon: Boxes },
  { href: "/admin/customers", label: "Clients", icon: Users },
  { href: "/admin/suppliers", label: "Fournisseurs", icon: Truck },
  { href: "/admin/inventory", label: "Inventaire", icon: ClipboardList },
  { href: "/admin/reports", label: "Rapports", icon: TrendingUp },
  { href: "/admin/history", label: "Historique", icon: History },
  { href: "/admin/users", label: "Utilisateurs", icon: UserCircle2, adminOnly: true },
  { href: "/admin/settings", label: "Paramètres", icon: Settings, adminOnly: true },
];

// Pages réservées à l'administrateur (le gestionnaire est redirigé vers un message clair).
const ADMIN_ONLY_PATHS = ["/admin/users", "/admin/settings"];

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrateur", color: "bg-red-500/20 text-red-200" },
  manager: { label: "Gestionnaire", color: "bg-blue-500/20 text-blue-200" },
  vendor: { label: "Vendeur", color: "bg-green-500/20 text-green-200" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  // Compteur d'alertes, rafraîchi à la navigation et toutes les 2 minutes.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const res = await api.get<{ counts?: { total?: number } }>("/api/alerts");
      if (active && res.ok && res.data?.counts) setAlertCount(res.data.counts.total ?? 0);
    };
    load();
    const timer = setInterval(load, 120000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, pathname]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (user && user.role === "vendor") router.replace("/vendor");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  const visibleNav = NAV.filter((n) => !n.adminOnly || user.role === "admin");
  const isRestricted =
    user.role !== "admin" && ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const roleBadge = ROLE_BADGE[user.role] || ROLE_BADGE.manager;

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-teal-700 px-3 py-3 text-white shadow md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-2 hover:bg-teal-800"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-6 w-6" />
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-base font-bold">
          WadAcces · Bureau
        </span>
        <div className="flex items-center gap-2">
          <Link href="/admin/alerts" className="relative rounded-lg p-2 hover:bg-teal-800" title="Alertes">
            <BellRing className="h-5 w-5" />
            {alertCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black">
                {alertCount}
              </span>
            )}
          </Link>
          <Link href="/vendor" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-bold" title="Caisse vendeur">
            🛒
          </Link>
        </div>
      </div>

      <div className="flex min-h-screen md:min-h-0">
        {/* Sidebar — flex column : header / nav scrollable / footer fixe, jamais mélangés */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 flex w-72 max-w-[85vw] transform flex-col bg-slate-900 text-slate-100 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-4">
            <Link href="/admin" className="flex min-w-0 items-center gap-2" onClick={() => setSidebarOpen(false)}>
              <Store className="h-6 w-6 shrink-0 text-teal-400" />
              <span className="truncate text-lg font-bold">WadAcces</span>
            </Link>
            <button
              className="rounded-lg p-2 hover:bg-slate-800 md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Caisse button — visible, séparé du menu */}
          <div className="shrink-0 px-3 pt-3">
            <Link
              href="/vendor"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-3 py-3 text-sm font-bold text-white shadow hover:bg-green-500 active:scale-[0.98]"
            >
              🛒 Caisse vendeur
            </Link>
          </div>

          {/* Nav — zone scrollable indépendante */}
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
            {visibleNav.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-teal-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && alertCount > 0 && (
                    <span className="ml-auto shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                      {alertCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer — toujours en bas, jamais par-dessus le menu */}
          <div className="shrink-0 border-t border-slate-800 bg-slate-900 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-slate-400">
                Connecté : <span className="font-semibold text-slate-200">{user.fullName}</span>
              </span>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${roleBadge.color}`}>
                {roleBadge.label}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-red-600 hover:text-white active:scale-[0.98]"
            >
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main — pas de débordement horizontal */}
        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">
          <div className="mx-auto w-full max-w-7xl">
            {isRestricted ? (
              <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
                  🔒
                </div>
                <h1 className="text-xl font-bold text-slate-900">Accès réservé à l&apos;administrateur</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Votre rôle de gestionnaire ne permet pas de gérer les utilisateurs ni les paramètres de la boutique.
                </p>
                <Link
                  href="/admin"
                  className="mt-5 inline-block rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
                >
                  Retour au tableau de bord
                </Link>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
