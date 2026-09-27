"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";

type Log = {
  id: number;
  username: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  note: string | null;
};

export default function HistoryPage() {
  const [items, setItems] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api.get<{ items: Log[] }>("/api/audit-logs?pageSize=100");
      if (res.ok && res.data) setItems(res.data.items);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Historique</h1>
      <div className="table-scroll rounded-2xl bg-white shadow">
        {loading ? (
          <div className="p-8 text-center">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Aucun événement</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Élément</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{l.username || "—"}</td>
                  <td className="px-4 py-3">{l.action}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {l.entityType} {l.entityId || ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{l.note || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
