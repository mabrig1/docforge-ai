'use client';

/**
 * /admin — Admin panel
 *
 * Tabs:
 *  1. Products — list all products, create/edit/toggle publish
 *  2. Orders   — list all transactions
 *
 * Access: admin role only. Non-admin users are redirected.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  listProducts, createProduct, updateProduct,
  getAllOrders, getUploadUrl,
} from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const TABS = ['Products', 'Orders'];

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('Products');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <span className="text-xs text-gray-500">Logged in as {user.email}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 pb-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium rounded-t-lg transition
              ${tab === t
                ? 'bg-gray-800 text-white border border-b-transparent border-gray-700'
                : 'text-gray-500 hover:text-gray-300'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Products' && <ProductsTab />}
      {tab === 'Orders'   && <OrdersTab />}
    </div>
  );
}

// ── Products tab ────────────────────────────────────────────────────────────
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null);  // null = hidden, {} = new, product = edit
  const [error, setError]       = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    listProducts()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function togglePublish(product) {
    try {
      await updateProduct(product._id, { isPublished: !product.isPublished });
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">{products.length} products</p>
        <button onClick={() => setEditing({})} className="btn-primary text-sm">
          + New Product
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">NGN</th>
                <th className="px-4 py-3 text-left">Sales</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {products.map((p) => (
                <tr key={p._id} className="hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 text-gray-100 max-w-[200px] truncate">{p.title}</td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{p.productType}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {p.pricing?.ngn != null ? formatCurrency(p.pricing.ngn, 'NGN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{p.salesCount ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${p.isPublished
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-gray-700 text-gray-400'}`}>
                      {p.isPublished ? 'Live' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => setEditing(p)}
                      className="text-xs text-brand-400 hover:underline">
                      Edit
                    </button>
                    <button
                      onClick={() => togglePublish(p)}
                      className="text-xs text-gray-400 hover:text-white">
                      {p.isPublished ? 'Unpublish' : 'Publish'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <ProductFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ── Product create / edit modal ─────────────────────────────────────────────
function ProductFormModal({ initial, onClose, onSaved }) {
  const isNew = !initial._id;
  const [form, setForm] = useState({
    title:         initial.title         ?? '',
    description:   initial.description   ?? '',
    productType:   initial.productType   ?? 'book',
    coverImageUrl: initial.coverImageUrl ?? '',
    secureFileKey: initial.secureFileKey ?? '',
    creator:       initial.creator       ?? '',
    trackList:     (initial.trackList ?? []).join('\n'),
    price_ngn:     initial.pricing?.ngn  ?? '',
    price_usd:     initial.pricing?.usd  ?? '',
    price_gbp:     initial.pricing?.gbp  ?? '',
    price_eur:     initial.pricing?.eur  ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function handle(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        title:         form.title,
        description:   form.description,
        productType:   form.productType,
        coverImageUrl: form.coverImageUrl,
        secureFileKey: form.secureFileKey,
        creator:       form.creator || undefined,
        trackList:     form.trackList
                         ? form.trackList.split('\n').map((t) => t.trim()).filter(Boolean)
                         : undefined,
        pricing: {
          ngn: form.price_ngn ? Number(form.price_ngn) : null,
          usd: form.price_usd ? Number(form.price_usd) : null,
          gbp: form.price_gbp ? Number(form.price_gbp) : null,
          eur: form.price_eur ? Number(form.price_eur) : null,
        },
      };

      if (isNew) {
        await createProduct(payload);
      } else {
        await updateProduct(initial._id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900
                       overflow-y-auto max-h-[90vh] p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">
            {isNew ? 'New Product' : 'Edit Product'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title">
            <input className="input" name="title" value={form.title} onChange={handle} required />
          </Field>

          <Field label="Description">
            <textarea className="input min-h-[80px]" name="description"
              value={form.description} onChange={handle} required />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Product Type">
              <select className="input" name="productType" value={form.productType} onChange={handle}>
                <option value="book">Book</option>
                <option value="audio">Audio Album</option>
              </select>
            </Field>
            <Field label="Creator (author / artist)">
              <input className="input" name="creator" value={form.creator} onChange={handle} />
            </Field>
          </div>

          <Field label="Cover Image URL">
            <input className="input" name="coverImageUrl" value={form.coverImageUrl}
              onChange={handle} placeholder="https://…" required />
          </Field>

          <Field label="R2 Secure File Key" hint="e.g. products/books/shadows-of-the-north.pdf">
            <input className="input" name="secureFileKey" value={form.secureFileKey}
              onChange={handle} required />
          </Field>

          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pricing</p>
          <div className="grid grid-cols-2 gap-4">
            {[['price_ngn','NGN (₦)'], ['price_usd','USD ($)'], ['price_gbp','GBP (£)'], ['price_eur','EUR (€)']].map(([name, label]) => (
              <Field key={name} label={label}>
                <input className="input" name={name} type="number" min="0"
                  value={form[name]} onChange={handle} placeholder="Leave blank if N/A" />
              </Field>
            ))}
          </div>

          {form.productType === 'audio' && (
            <Field label="Track Listing (one track per line)">
              <textarea className="input min-h-[80px] font-mono text-xs"
                name="trackList" value={form.trackList} onChange={handle}
                placeholder="Track 1 title&#10;Track 2 title" />
            </Field>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : isNew ? 'Create Product' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Orders tab ──────────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAllOrders()
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">{orders.length} transactions</p>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Buyer</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Currency</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 text-gray-300">
                    <div>{o.buyer?.name}</div>
                    <div className="text-xs text-gray-500">{o.buyer?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-[160px] truncate">
                    {o.product?.title}
                  </td>
                  <td className="px-4 py-3 text-gray-100 font-medium">
                    {formatCurrency(o.amountCharged, o.currency)}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{o.currency}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${o.status === 'completed'
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-yellow-900/50 text-yellow-400'}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Helper component ────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
        {hint && <span className="ml-1 text-xs text-gray-500 font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
