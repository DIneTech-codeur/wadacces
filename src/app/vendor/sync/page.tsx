"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CheckCircle, Clock, Wifi, WifiOff } from "lucide-react";
import { offlineDB, isOnline, onNetworkChange } from "@/lib/offline-db";
import { syncPending } from "@/lib/sync-client";
import { formatCurrency, formatDateTime, speak } from "@/lib/utils";

type PendingItem = {
  localId: string;
  type: "sale" | "purchase";
  total?: number;
  itemsCount?: number;
  createdAt: string;
  synced?: boolean;
};

export default function VendorSyncPage() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return onNetworkChange(setOnline);
  }, []);

  const loadPending = useCallback(async () => {
    const sales = await offlineDB.getPendingSales();
    const purchases = await offlineDB.getPendingPurchases();
    const items: PendingItem[] = [
      ...sales.map((s) => ({
        localId: s.localId,
        type: "sale" as const,
        total: s.items?.reduce((sum: number, i: { unitPrice: number; quantity: number }) => sum + i.unitPrice * i.quantity, 0) || 0,
        itemsCount: s.items?.length || 0,
        createdAt: s.createdAt,
        synced: s.synced,
      })),
      ...purchases.map((p) => ({
        localId: p.localId,
        type: "purchase" as const,
        total: p.items?.reduce((sum: number, i: { unitCost: number; quantity: number }) => sum + i.unitCost * i.quantity, 0) || 0,
        itemsCount: p.items?.length || 0,
        createdAt: p.createdAt,
        synced: p.synced,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setPending(items);
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const syncNow = async () => {
    if (!online) {
      setMessage("Pas de réseau");
      speak("Pas de réseau", true);
      setTimeout(() => setMessage(null), 2000);
      return;
    }
    setSyncing(true);
    const result = await syncPending();
    setMessage(result.message);
    speak(result.ok ? "Données synchronisées" : result.message, true);
    await loadPending();
    setSyncing(false);
    setTimeout(() => setMessage(null), 2500);
  };

  const unsynced = pending.filter((p) => !p.synced).length;

  return (
    <div>
      <div className={`mb-3 rounded-3xl p-6 text-center text-white ${online ? "bg-green-600" : "bg-orange-500"}`}>
        <div className="flex items-center justify-center gap-2 text-3xl font-black">
          {online ? <Wifi className="h-8 w-8" /> : <WifiOff className="h-8 w-8" />}
          {online ? "EN LIGNE" : "HORS LIGNE"}
        </div>
        {unsynced > 0 && <p className="mt-2 text-lg font-bold">{unsynced} en attente</p>}
      </div>

      {message && <div className="mb-3 rounded-3xl bg-teal-600 p-4 text-center text-xl font-black text-white">{message}</div>}

      <button
        type="button"
        onClick={syncNow}
        disabled={syncing || !online}
        className="mb-4 flex w-full min-h-[96px] items-center justify-center gap-3 rounded-3xl bg-purple-600 text-3xl font-black text-white shadow-lg active:scale-95 disabled:opacity-50"
      >
        <RefreshCw className={`h-10 w-10 ${syncing ? "animate-spin" : ""}`} />
        SYNCHRO
      </button>

      <div className="rounded-3xl bg-white p-3 shadow">
        {pending.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="mx-auto mb-2 h-16 w-16 text-green-500" />
            <p className="text-xl font-black">Tout est à jour</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.localId} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                {p.synced ? <CheckCircle className="h-8 w-8 text-green-600" /> : <Clock className="h-8 w-8 text-orange-500" />}
                <div>
                  <p className="text-lg font-black">{p.type === "sale" ? "🛒 Vente" : "📥 Entrée"}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(p.createdAt)}</p>
                  {p.total !== undefined && <p className="font-black text-teal-700">{formatCurrency(p.total)}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
