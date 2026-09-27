"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { Plus, Pencil, Search, Package, Trash2, AlertTriangle, Upload, QrCode as QrIcon } from "lucide-react";

type Product = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  categoryName?: string | null;
  supplierName?: string | null;
  purchasePrice: string | number;
  retailPrice: string | number;
  wholesalePrice: string | number;
  stock: number | string;
  minStock: number | string;
  active: boolean;
};

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(String(v)) || 0;
}

export default function AdminProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  const load = async (p = 1, query = "") => {
    setLoading(true);
    const res = await api.get<any>(
      `/api/products?page=${p}&pageSize=${pageSize}&q=${encodeURIComponent(query)}`
    );
    if (res.ok && res.data) {
      setProducts(res.data.items);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
      setPage(p);
    }
    setLoading(false);
  };

  useEffect(() => {
    load(1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, q);
  };

  const softDelete = async (id: number) => {
    if (!confirm("Supprimer ce produit ?")) return;
    await api.delete(`/api/products/${id}`);
    load(page, q);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Produits</h1>
          <p className="text-sm text-slate-500">{total} produit(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-700">
            <Upload className="h-4 w-4" /> Import CSV
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const XLSX = await import("xlsx");
                  const buf = await file.arrayBuffer();
                  const wb = XLSX.read(buf, { type: "array" });
                  const sheet = wb.Sheets[wb.SheetNames[0]];
                  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
                  const items = rows.map((r) => ({
                    name: String(r.nom || r.name || r.Nom || ""),
                    sku: r.sku || r.SKU || null,
                    barcode: r.barcode || r["code-barres"] || r.codebarres || null,
                    category: r.categorie || r.category || r.Catégorie || null,
                    brand: r.marque || r.brand || null,
                    model: r.modele || r.model || null,
                    purchasePrice: Number(r.prixAchat || r.purchasePrice || r["prix achat"] || 0),
                    retailPrice: Number(r.prixVente || r.retailPrice || r["prix vente"] || 0),
                    wholesalePrice: Number(r.prixGros || r.wholesalePrice || r["prix gros"] || 0),
                    stock: Number(r.stock || r["stock initial"] || 0),
                    minStock: Number(r.seuil || r.minStock || 5),
                  })).filter((i) => i.name);
                  if (items.length === 0) {
                    alert("Aucune ligne valide. Colonnes attendues : nom, sku, barcode, categorie, prixAchat, prixVente, prixGros, stock, seuil");
                    return;
                  }
                  const preview = await api.post<{ valid: number; issues: Array<{ row: number; message: string }> }>("/api/products/import", { items, dryRun: true });
                  if (!preview.ok || !preview.data) {
                    alert(preview.error || "Fichier illisible");
                    return;
                  }
                  const warn = preview.data.issues?.length ? `\n${preview.data.issues.length} ligne(s) en erreur.` : "";
                  if (!confirm(`Importer ${preview.data.valid} produit(s) ?${warn}`)) return;
                  const done = await api.post<{ imported: number }>("/api/products/import", { items, dryRun: false });
                  if (!done.ok) alert(done.error || "Erreur d'import");
                  else {
                    alert(`${done.data?.imported || 0} produit(s) importé(s)`);
                    load(1, q);
                  }
                } catch (err) {
                  console.error(err);
                  alert("Impossible de lire ce fichier");
                }
              }}
            />
          </label>
          <Link
            href="/admin/products/labels"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
          >
            <QrIcon className="h-4 w-4" /> Étiquettes QR
          </Link>
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" /> Nouveau produit
          </Link>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (nom, SKU, code-barres)…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 focus:border-teal-500 focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-xl bg-slate-800 px-4 py-2 text-white">
          Rechercher
        </button>
      </form>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow">
          <Package className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">Aucun produit</p>
        </div>
      ) : (
        <>
          <div className="table-scroll rounded-2xl bg-white shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Produit</th>
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Prix achat</th>
                  <th className="px-4 py-3 text-right">Prix vente</th>
                  <th className="px-4 py-3 text-right">Prix gros</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const stock = toNum(p.stock);
                  const min = toNum(p.minStock);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.barcode && (
                            <span className="ml-1 font-mono text-slate-600">· {p.barcode}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.categoryName || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-bold ${
                            stock === 0
                              ? "bg-red-100 text-red-700"
                              : stock <= min
                              ? "bg-orange-100 text-orange-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {stock <= min && stock > 0 && <AlertTriangle className="h-3 w-3" />}
                          {stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(toNum(p.purchasePrice))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-teal-700">{formatCurrency(toNum(p.retailPrice))}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(toNum(p.wholesalePrice))}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                          {isAdmin && (
                          <button
                            onClick={() => softDelete(p.id)}
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => load(page - 1, q)}
                disabled={page <= 1}
                className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="text-sm">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => load(page + 1, q)}
                disabled={page >= totalPages}
                className="rounded-lg bg-white px-3 py-2 shadow disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
