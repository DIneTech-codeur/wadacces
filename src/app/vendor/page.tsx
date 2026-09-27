"use client";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { ShoppingCart, Package, Download, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { isOnline, onNetworkChange } from "@/lib/offline-db";
import { pendingCount, syncPending, pullCatalog } from "@/lib/sync-client";
import { speak } from "@/lib/utils";

export default function VendorHome() {
  const { user } = useAuth();
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    return onNetworkChange(setOnline);
  }, []);

  useEffect(() => {
    pendingCount().then(setPending);
    pullCatalog().catch(() => {});
  }, []);

  const doSync = async () => {
    if (!online) {
      setFlash("Pas de réseau");
      speak("Pas de réseau", true);
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    setSyncing(true);
    const result = await syncPending();
    setPending(await pendingCount());
    setFlash(result.message);
    speak(result.ok ? "Données synchronisées" : result.message, true);
    setSyncing(false);
    setTimeout(() => setFlash(null), 2500);
  };

  return (
    <div>
      <div className="mb-4 rounded-3xl bg-white p-4 text-center shadow">
        <p className="text-sm text-slate-500">Bonjour</p>
        <p className="text-2xl font-black text-slate-900">{user?.fullName}</p>
        <p className={`mt-1 text-base font-bold ${online ? "text-green-600" : "text-orange-600"}`}>
          {online ? "🟢 En ligne" : "🟠 Hors ligne"}
        </p>
      </div>

      {flash && (
        <div className="mb-3 rounded-2xl bg-teal-600 p-4 text-center text-lg font-black text-white">{flash}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/vendor/sell"
          className="flex min-h-[170px] flex-col items-center justify-center rounded-[2rem] bg-green-500 p-4 text-white shadow-lg active:scale-95"
        >
          <ShoppingCart className="mb-2 h-16 w-16" strokeWidth={2.4} />
          <span className="text-3xl font-black">VENDRE</span>
        </Link>
        <Link
          href="/vendor/stock"
          className="flex min-h-[170px] flex-col items-center justify-center rounded-[2rem] bg-blue-600 p-4 text-white shadow-lg active:scale-95"
        >
          <Package className="mb-2 h-16 w-16" strokeWidth={2.4} />
          <span className="text-3xl font-black">STOCK</span>
        </Link>
        <Link
          href="/vendor/receive"
          className="flex min-h-[170px] flex-col items-center justify-center rounded-[2rem] bg-amber-500 p-4 text-white shadow-lg active:scale-95"
        >
          <Download className="mb-2 h-16 w-16" strokeWidth={2.4} />
          <span className="text-3xl font-black">ENTRÉE</span>
        </Link>
        <button
          type="button"
          onClick={doSync}
          disabled={syncing}
          className="flex min-h-[170px] flex-col items-center justify-center rounded-[2rem] bg-purple-600 p-4 text-white shadow-lg active:scale-95 disabled:opacity-70"
        >
          <RefreshCw className={`mb-2 h-16 w-16 ${syncing ? "animate-spin" : ""}`} strokeWidth={2.4} />
          <span className="text-3xl font-black">SYNCHRO</span>
          {pending > 0 && (
            <span className="mt-1 rounded-full bg-white px-3 py-0.5 text-sm font-black text-purple-700">{pending}</span>
          )}
        </button>
      </div>
    </div>
  );
}
