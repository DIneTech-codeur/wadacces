"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { LogOut, Home, Wifi, WifiOff, ShoppingCart, Package, Download, Briefcase, RefreshCw } from "lucide-react";
import { isOnline, onNetworkChange } from "@/lib/offline-db";
import { pendingCount, syncPending } from "@/lib/sync-client";
import { speak } from "@/lib/utils";

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [online, setOnline] = useState<boolean>(isOnline());
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    return onNetworkChange((state) => setOnline(state));
  }, []);

  useEffect(() => {
    const refresh = async () => setPending(await pendingCount());
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [pathname]);

  useEffect(() => {
    if (!online) return;
    (async () => {
      const count = await pendingCount();
      if (count === 0) return;
      const result = await syncPending();
      setPending(await pendingCount());
      if (result.ok && result.synced > 0) speak("Données synchronisées", true);
    })();
  }, [online]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-teal-800">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-white border-t-transparent" />
      </div>
    );
  }

  const nav = [
    { href: "/vendor", label: "ACCUEIL", icon: Home },
    { href: "/vendor/sell", label: "VENDRE", icon: ShoppingCart },
    { href: "/vendor/stock", label: "STOCK", icon: Package },
    { href: "/vendor/receive", label: "ENTRÉE", icon: Download },
  ];

  return (
    <div className="min-h-screen bg-slate-100 pb-28">
      <header className="sticky top-0 z-20 bg-teal-700 px-2 py-2.5 text-white shadow-md sm:px-3 sm:py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-1">
          <Link href="/vendor" className="flex min-w-0 shrink items-center gap-1.5">
            <span className="text-xl sm:text-2xl">📱</span>
            <span className="truncate text-base font-black sm:text-xl">WadAcces</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div
              className={`flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-bold sm:h-10 sm:px-3 ${
                online ? "bg-green-500 text-white" : "bg-orange-500 text-white"
              }`}
            >
              {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {pending > 0 && <span>{pending}</span>}
            </div>
            {user.role !== "vendor" && (
              <Link href="/admin" className="rounded-full bg-slate-900 p-2" title="Bureau">
                <Briefcase className="h-5 w-5" />
              </Link>
            )}
            <Link href="/vendor/sync" className="rounded-full bg-teal-800 p-2">
              <RefreshCw className="h-5 w-5" />
            </Link>
            <button
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="rounded-full bg-teal-800 p-2"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-3">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {nav.map((item) => {
            const active = item.href === "/vendor" ? pathname === "/vendor" : pathname.startsWith(item.href);
            const Icon = item.icon;
            const color =
              item.href === "/vendor/sell"
                ? "text-green-600"
                : item.href === "/vendor/stock"
                ? "text-blue-600"
                : item.href === "/vendor/receive"
                ? "text-amber-600"
                : "text-teal-700";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-3 text-xs font-black ${
                  active ? color : "text-slate-400"
                }`}
              >
                <Icon className={`h-7 w-7 ${active ? "" : ""}`} strokeWidth={active ? 2.6 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
