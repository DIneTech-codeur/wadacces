"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { ArrowLeft, Save, Package, Download } from "lucide-react";
import { QrCode, downloadQrPng } from "@/components/qr-code";
import { formatCurrency } from "@/lib/utils";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = parseInt(params.id, 10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name: string }>>([]);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [productRes, catsRes, supsRes] = await Promise.all([
        api.get<any>(`/api/products/${id}`),
        api.get<any>("/api/categories"),
        api.get<any>("/api/suppliers"),
      ]);
      if (productRes.ok && productRes.data) {
        setForm({
          ...productRes.data,
          purchasePrice: Number(productRes.data.purchasePrice) || 0,
          retailPrice: Number(productRes.data.retailPrice) || 0,
          wholesalePrice: Number(productRes.data.wholesalePrice) || 0,
          specialPrice: productRes.data.specialPrice ? Number(productRes.data.specialPrice) : "",
          promotionalPrice: productRes.data.promotionalPrice ? Number(productRes.data.promotionalPrice) : "",
          minStock: Number(productRes.data.minStock) || 0,
        });
      }
      if (catsRes.ok) setCategories(catsRes.data || []);
      if (supsRes.ok) setSuppliers(supsRes.data?.items || []);
      setLoading(false);
    })();
  }, [id]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name,
        sku: form.sku || null,
        barcode: form.barcode || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        brand: form.brand || null,
        model: form.model || null,
        compatibility: form.compatibility || null,
        description: form.description || null,
        purchasePrice: Number(form.purchasePrice) || 0,
        retailPrice: Number(form.retailPrice) || 0,
        wholesalePrice: Number(form.wholesalePrice) || 0,
        specialPrice: form.specialPrice ? Number(form.specialPrice) : null,
        promotionalPrice: form.promotionalPrice ? Number(form.promotionalPrice) : null,
        minStock: Number(form.minStock) || 0,
        location: form.location || null,
        active: form.active,
      };
      const res = await api.put(`/api/products/${id}`, payload);
      if (!res.ok) throw new Error(res.error || "Erreur");
      router.push("/admin/products");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }
  if (!form) return <div>Produit introuvable</div>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/products" className="rounded-lg bg-white p-2 shadow">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Modifier le produit</h1>
          <p className="text-sm text-slate-500">{form.name}</p>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</div>}

      <div className="mb-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Package className="h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <p className="text-sm text-slate-500">Stock actuel</p>
              <p className="text-lg font-bold">
                {form.stock} {form.stock <= form.minStock && <span className="text-orange-600">⚠️ Bas</span>}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-slate-500">Valeur stock</p>
              <p className="font-semibold">{formatCurrency(Number(form.stock) * Number(form.purchasePrice))}</p>
            </div>
          </div>
        </div>

        {form.barcode && (
          <div className="flex flex-col items-center rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              QR code produit
            </p>
            <QrCode value={form.barcode} size={132} alt={`QR ${form.name}`} />
            <p className="mt-2 font-mono text-xs text-slate-600">{form.barcode}</p>
            <button
              type="button"
              onClick={() => downloadQrPng(form.barcode, `qr-${form.barcode}.png`)}
              className="mt-2 flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Download className="h-3 w-3" /> Télécharger
            </button>
          </div>
        )}
      </div>

      <form onSubmit={save} className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6 md:grid-cols-2">
        <Field label="Nom *" value={form.name} onChange={(v) => update("name", v)} required />
        <Field label="SKU" value={form.sku || ""} onChange={(v) => update("sku", v)} />
        <Field label="Code-barres" value={form.barcode || ""} onChange={(v) => update("barcode", v)} />
        <Field label="Marque" value={form.brand || ""} onChange={(v) => update("brand", v)} />
        <Field label="Modèle" value={form.model || ""} onChange={(v) => update("model", v)} />
        <Field label="Emplacement" value={form.location || ""} onChange={(v) => update("location", v)} />

        <div>
          <label className="mb-1 block text-sm font-medium">Catégorie</label>
          <select
            value={form.categoryId || ""}
            onChange={(e) => update("categoryId", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Fournisseur</label>
          <select
            value={form.supplierId || ""}
            onChange={(e) => update("supplierId", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <Field label="Prix achat" type="number" value={String(form.purchasePrice)} onChange={(v) => update("purchasePrice", v)} />
        <Field label="Prix vente détail" type="number" value={String(form.retailPrice)} onChange={(v) => update("retailPrice", v)} />
        <Field label="Prix gros" type="number" value={String(form.wholesalePrice)} onChange={(v) => update("wholesalePrice", v)} />
        <Field label="Prix spécial" type="number" value={String(form.specialPrice || "")} onChange={(v) => update("specialPrice", v)} />
        <Field label="Seuil d'alerte" type="number" value={String(form.minStock)} onChange={(v) => update("minStock", v)} />

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Compatibilité / Description</label>
          <textarea
            value={form.compatibility || ""}
            onChange={(e) => update("compatibility", e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update("active", e.target.checked)}
          />
          <span>Actif</span>
        </label>

        <div className="flex gap-2 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white shadow hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
          <Link href="/admin/products" className="rounded-xl bg-slate-200 px-5 py-3 font-medium">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label}
        {required && " *"}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
      />
    </div>
  );
}
