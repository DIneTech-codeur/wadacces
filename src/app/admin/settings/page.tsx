"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Save, Store, Download, PackagePlus, BookOpen } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [productCount, setProductCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api.get<any>("/api/store-settings");
      if (res.ok && res.data) setSettings(res.data);
      const count = await api.get<{ productCount: number }>("/api/admin/seed-catalog");
      if (count.ok && count.data) setProductCount(count.data.productCount);
      setLoading(false);
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await api.put("/api/store-settings", settings);
    setSaving(false);
    if (res.ok) {
      setMessage("✅ Paramètres enregistrés");
    } else {
      setMessage(res.error || "Erreur");
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-sm text-slate-500">Configuration de la boutique</p>
      </div>

      {message && (
        <div className="mb-4 rounded-xl bg-teal-50 p-3 text-center font-medium text-teal-800">
          {message}
        </div>
      )}

      <form onSubmit={save} className="max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <Store className="h-6 w-6 text-teal-600" />
          <h2 className="text-lg font-semibold">Informations boutique</h2>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Nom de la boutique</label>
          <input
            type="text"
            value={settings.storeName}
            onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Devise</label>
            <input
              type="text"
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Téléphone</label>
            <input
              type="text"
              value={settings.phone || ""}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Adresse</label>
          <input
            type="text"
            value={settings.address || ""}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Seuil d'alerte stock bas (défaut)</label>
          <input
            type="number"
            value={settings.lowStockThreshold}
            onChange={(e) => setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value) || 5 })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.enableVoiceFeedback}
            onChange={(e) => setSettings({ ...settings, enableVoiceFeedback: e.target.checked })}
          />
          <span>Retour vocal activé (sur les appareils compatibles)</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white shadow hover:bg-teal-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      <div className="mt-6 max-w-xl rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">Catalogue de démarrage</h2>
        <p className="mb-4 text-sm text-slate-500">
          Charge les produits, fournisseurs et clients de la boutique, avec leur stock initial.
          Chaque produit reçoit automatiquement un code-barres et un QR code scannable.
          {productCount !== null && (
            <span className="mt-1 block font-semibold text-slate-700">
              Actuellement : {productCount} produit(s) en base.
            </span>
          )}
        </p>
        <button
          type="button"
          disabled={seeding}
          onClick={async () => {
            if (!confirm("Charger le catalogue WadAcces ? Les produits déjà présents ne seront pas dupliqués.")) return;
            setSeeding(true);
            setMessage(null);
            const res = await api.post<{ products: number; suppliers: number; customers: number; skipped: number }>(
              "/api/admin/seed-catalog"
            );
            setSeeding(false);
            if (res.ok && res.data) {
              setMessage(
                `✅ ${res.data.products} produit(s), ${res.data.suppliers} fournisseur(s), ${res.data.customers} client(s) ajoutés.` +
                  (res.data.skipped ? ` ${res.data.skipped} déjà présent(s).` : "")
              );
              const count = await api.get<{ productCount: number }>("/api/admin/seed-catalog");
              if (count.ok && count.data) setProductCount(count.data.productCount);
            } else {
              setMessage(res.error || "Erreur");
            }
            setTimeout(() => setMessage(null), 6000);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          <PackagePlus className="h-4 w-4" /> {seeding ? "Chargement…" : "Charger le catalogue WadAcces"}
        </button>
      </div>

      <div className="mt-6 max-w-xl rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">Guide de mise en production</h2>
        <p className="mb-4 text-sm text-slate-500">
          Document PDF de 10 pages : déploiement GitHub + Vercel + Neon, sauvegardes, sécurité, installation sur les appareils et check-list de livraison.
        </p>
        <a
          href="/guide-deploiement-wadacces.pdf"
          download="GUIDE-DEPLOIEMENT-WADACCES.pdf"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          <BookOpen className="h-4 w-4" /> Télécharger le guide (PDF)
        </a>
      </div>

      <div className="mt-6 max-w-xl rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">Sauvegarde</h2>
        <p className="mb-4 text-sm text-slate-500">
          Téléchargez une copie JSON des produits, ventes, clients et paramètres. Conservez ce fichier en lieu sûr.
        </p>
        <a
          href="/api/backup"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          <Download className="h-4 w-4" /> Télécharger la sauvegarde
        </a>
      </div>
    </div>
  );
}
