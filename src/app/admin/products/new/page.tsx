"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { ArrowLeft, Save, Sparkles, RefreshCw, QrCode as QrIcon } from "lucide-react";
import { generateBarcode, generateSku } from "@/lib/codes";
import { QrCode } from "@/components/qr-code";

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-génération automatique immédiate : l'utilisateur n'a rien à inventer
  const [barcode, setBarcode] = useState<string>("");
  const [sku, setSku] = useState<string>("");

  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    supplierId: "",
    brand: "",
    model: "",
    compatibility: "",
    description: "",
    purchasePrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
    minStock: 5,
    stock: 0,
    location: "",
    active: true,
  });

  // Initialisation des codes au chargement de la page
  useEffect(() => {
    const initialBarcode = generateBarcode();
    const initialSku = generateSku("PRODUIT");
    setBarcode(initialBarcode);
    setSku(initialSku);

    api.get<any>("/api/categories").then((r) => r.ok && setCategories(r.data || []));
    api.get<any>("/api/suppliers").then((r) => {
      if (r.ok && r.data?.items) setSuppliers(r.data.items);
    });
  }, []);

  const update = (k: string, v: any) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // Mise à jour douce du SKU dès que le nom change
      if (k === "name" && v && v.trim().length >= 2) {
        setSku(generateSku(v));
      }
      return next;
    });
  };

  const regenerateCodes = () => {
    setBarcode(generateBarcode());
    setSku(generateSku(form.name || "PRODUIT"));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Veuillez indiquer le nom du produit");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name.trim(),
        sku: sku || generateSku(form.name),
        barcode: barcode || generateBarcode(),
        categoryId: form.categoryId ? parseInt(form.categoryId, 10) : null,
        supplierId: form.supplierId ? parseInt(form.supplierId, 10) : null,
        brand: form.brand || null,
        model: form.model || null,
        compatibility: form.compatibility || null,
        description: form.description || null,
        purchasePrice: Number(form.purchasePrice) || 0,
        retailPrice: Number(form.retailPrice) || 0,
        wholesalePrice: Number(form.wholesalePrice) || Number(form.retailPrice) || 0,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 5,
        location: form.location || null,
        active: form.active,
      };
      const res = await api.post<{ id: number }>("/api/products", payload);
      if (!res.ok) throw new Error(res.error || "Erreur lors de l'enregistrement");
      router.push("/admin/products");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/products" className="rounded-lg bg-white p-2 shadow hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nouveau produit</h1>
          <p className="text-sm text-slate-500">
            Remplissez simplement le nom et les prix — les codes QR et SKU sont générés automatiquement.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        {/* Encadré QR Code généré automatiquement */}
        <div className="rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/60 p-4 sm:p-5">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {barcode && (
                <div className="flex flex-col items-center rounded-xl bg-white p-2 shadow-sm">
                  <QrCode value={barcode} size={96} alt="QR Code généré" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-teal-600" />
                  <span className="font-bold text-teal-950">Code QR & Code-barres automatiques</span>
                </div>
                <p className="mt-1 text-xs text-teal-800">
                  Pas besoin de les inventer ni de les taper : ils sont prêts et scannables.
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-white px-2 py-1 font-mono font-semibold text-slate-700 shadow-sm">
                    Code: {barcode}
                  </span>
                  <span className="rounded-md bg-white px-2 py-1 font-mono font-semibold text-slate-700 shadow-sm">
                    SKU: {sku}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={regenerateCodes}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-teal-800 shadow-sm hover:bg-teal-100"
              title="Générer un autre code"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Changer le code
            </button>
          </div>
        </div>

        {/* Section 1 : Information principale */}
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900">1. Qu'est-ce qu'on ajoute ?</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-bold text-slate-800">
                Nom du produit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Ex : Écran iPhone 13, Chargeur Samsung 25W, Coque Tecno Spark 10…"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-semibold focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Catégorie</label>
              <select
                value={form.categoryId}
                onChange={(e) => update("categoryId", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base"
              >
                <option value="">— Choisir une catégorie —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Fournisseur</label>
              <select
                value={form.supplierId}
                onChange={(e) => update("supplierId", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base"
              >
                <option value="">— Aucun fournisseur particulier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2 : Les Prix */}
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900">2. Prix (en FCFA)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <label className="mb-1 block text-xs font-bold text-slate-600">Prix d'achat</label>
              <input
                type="number"
                min="0"
                step="50"
                value={form.purchasePrice || ""}
                onChange={(e) => update("purchasePrice", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg font-bold text-slate-800 focus:border-teal-500 focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-slate-400">Ce que ça vous a coûté</span>
            </div>

            <div className="rounded-xl bg-teal-50/60 p-3">
              <label className="mb-1 block text-xs font-bold text-teal-800">Prix de vente détail *</label>
              <input
                type="number"
                min="0"
                step="50"
                value={form.retailPrice || ""}
                onChange={(e) => update("retailPrice", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-lg border border-teal-300 bg-white px-3 py-2 text-lg font-bold text-teal-800 focus:border-teal-500 focus:outline-none"
                required
              />
              <span className="mt-1 block text-[11px] text-teal-700">Prix pour 1 client</span>
            </div>

            <div className="rounded-xl bg-blue-50/60 p-3">
              <label className="mb-1 block text-xs font-bold text-blue-800">Prix grossiste</label>
              <input
                type="number"
                min="0"
                step="50"
                value={form.wholesalePrice || ""}
                onChange={(e) => update("wholesalePrice", parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-lg font-bold text-blue-800 focus:border-blue-500 focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-blue-700">Prix en quantité</span>
            </div>
          </div>
        </div>

        {/* Section 3 : Stock initial */}
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-base font-bold text-slate-900">3. Combien en magasin ?</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-800">Quantité en stock maintenant</label>
              <input
                type="number"
                min="0"
                value={form.stock || ""}
                onChange={(e) => update("stock", parseInt(e.target.value, 10) || 0)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-xl font-black text-slate-900 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Alerte stock bas quand il reste :</label>
              <input
                type="number"
                min="1"
                value={form.minStock}
                onChange={(e) => update("minStock", parseInt(e.target.value, 10) || 5)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Section 4 (facultatif) : Détails supplémentaires */}
        <details className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <summary className="cursor-pointer font-bold text-slate-700 hover:text-teal-700">
            ➕ Plus de détails (Marque, Modèle, Emplacement, Description facultatifs)
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Marque</label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => update("brand", e.target.value)}
                placeholder="Ex : Apple, Samsung, Oraimo, Baseus…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Modèle</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => update("model", e.target.value)}
                placeholder="Ex : iPhone 13, A12…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Emplacement en boutique</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="Ex : Vitrine A1, Rayon B2, Tiroir 3…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Compatibilité / Note</label>
              <textarea
                value={form.compatibility}
                onChange={(e) => update("compatibility", e.target.value)}
                rows={2}
                placeholder="Ex : Compatible iPhone 13 et iPhone 13 Pro…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </details>

        {/* Boutons d'action */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-600 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-teal-700 active:scale-[0.99] disabled:opacity-50"
          >
            <Save className="h-5 w-5" />
            {saving ? "Enregistrement en cours…" : "✅ Enregistrer le produit"}
          </button>
          <Link
            href="/admin/products"
            className="flex items-center justify-center rounded-2xl bg-slate-200 px-6 py-4 font-bold text-slate-700 hover:bg-slate-300"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
