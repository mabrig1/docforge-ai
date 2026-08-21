'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  listAdminProducts, createProduct, updateProduct,
  getAllOrders, getAdminStats, getAdminUsers, toggleUser,
} from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import R2FileUploader from '@/components/ui/R2FileUploader';

const TABS = ['Stats', 'Products', 'Orders', 'Users'];

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('Stats');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) router.push('/');
  }, [authLoading, user, router]);

  if (authLoading || !user) return null;

  return (
    <div className="page-shell space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <span className="text-xs text-gray-500">{user.email}</span>
      </div>

      <div className="flex gap-1 border-b border-gray-800">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium rounded-t-lg transition
              ${tab === t
                ? 'bg-gray-800 text-white border border-b-transparent border-gray-700'
                : 'text-gray-500 hover:text-gray-300'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Stats'    && <StatsTab />}
      {tab === 'Products' && <ProductsTab />}
      {tab === 'Orders'   && <OrdersTab />}
      {tab === 'Users'    && <UsersTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// STATS TAB
// ══════════════════════════════════════════════════════════════════════
function StatsTab() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    getAdminStats()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500 text-sm">Loading stats…</p>;
  if (error)   return <p className="text-red-400 text-sm">{error}</p>;
  if (!data)   return null;

  const { summary, topProducts, recentOrders, dailySales } = data;

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Orders"  value={summary.totalOrders}  />
        <KpiCard label="Total Buyers"  value={summary.totalBuyers}  />
        {summary.revenueByCurrency.map((r) => (
          <KpiCard key={r._id}
            label={`Revenue (${r._id})`}
            value={formatCurrency(r.revenue, r._id)}
            sub={`${r.orders} orders`}
          />
        ))}
      </div>

      {/* Revenue by provider */}
      <Section title="Orders by Provider">
        <div className="flex gap-4 flex-wrap">
          {summary.revenueByProvider.map((p) => (
            <div key={p._id} className="card flex-1 min-w-[140px] text-center">
              <p className="text-2xl font-bold text-white">{p.totalOrders}</p>
              <p className="text-sm text-gray-400 capitalize mt-1">{p._id ?? 'unknown'}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Daily sales sparkline (simple bar chart) */}
      {dailySales.length > 0 && (
        <Section title="Daily Sales — Last 30 Days">
          <DailySalesChart data={dailySales} />
        </Section>
      )}

      {/* Top products */}
      {topProducts.length > 0 && (
        <Section title="Top Products by Sales">
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3 text-right">Revenue breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {topProducts.map((p) => {
                  const revenueMap = p.revenues.reduce((acc, r) => {
                    acc[r.currency] = (acc[r.currency] || 0) + r.amount;
                    return acc;
                  }, {});
                  return (
                    <tr key={p._id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-100 font-medium max-w-[200px] truncate">
                        {p.product.title}
                      </td>
                      <td className="px-4 py-3 text-gray-400 capitalize">{p.product.productType}</td>
                      <td className="px-4 py-3 text-right text-brand-400 font-bold">{p.salesCount}</td>
                      <td className="px-4 py-3 text-right text-gray-300 text-xs">
                        {Object.entries(revenueMap).map(([c, v]) =>
                          formatCurrency(v, c)
                        ).join(' · ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <Section title="Recent Orders">
          <div className="space-y-2">
            {recentOrders.map((o) => (
              <div key={o._id} className="card flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-100 truncate">{o.product?.title}</p>
                  <p className="text-xs text-gray-500">{o.buyer?.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-brand-400">
                    {formatCurrency(o.amountCharged, o.currency)}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }) {
  return (
    <div className="card space-y-1">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-extrabold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

function DailySalesChart({ data }) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);
  return (
    <div className="flex items-end gap-1 h-24 w-full">
      {data.map((d) => (
        <div key={d._id} className="flex-1 flex flex-col items-center gap-1 group">
          <div
            className="w-full bg-brand-700 group-hover:bg-brand-500 transition-colors rounded-sm"
            style={{ height: `${(d.orders / maxOrders) * 100}%`, minHeight: '2px' }}
            title={`${d._id}: ${d.orders} orders`}
          />
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// PRODUCTS TAB
// ══════════════════════════════════════════════════════════════════════
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null);
  const [error, setError]       = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    listAdminProducts()
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function togglePublish(product) {
    try {
      await updateProduct(product._id, { isPublished: !product.isPublished });
      refresh();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-400">{products.length} products</p>
        <button onClick={() => setEditing({})} className="btn-primary text-sm">+ New Product</button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p._id} product={p}
              onEdit={() => setEditing(p)}
              onTogglePublish={() => togglePublish(p)} />
          ))}
        </div>
      )}
      {editing !== null && (
        <ProductFormModal initial={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

// ── Product create / edit modal ─────────────────────────────────────────────
function ProductCard({ product: p, onEdit, onTogglePublish }) {
  const [copied, setCopied] = useState(false);

  function share() {
    const url = `${window.location.origin}/products/${p.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-hidden flex flex-col">
      {/* Cover image */}
      {p.coverImageUrl ? (
        <img src={p.coverImageUrl} alt={p.title}
          className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-gray-800 flex items-center justify-center text-gray-600 text-xs">
          No cover
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Title + badges */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">{p.title}</h3>
          <StatusBadge active={p.isPublished} trueLabel="Live" falseLabel="Draft" />
        </div>

        {/* Description */}
        {p.description && (
          <p className="text-xs text-gray-400 line-clamp-3">{p.description}</p>
        )}

        {/* Meta row */}
        <div className="flex gap-2 text-xs text-gray-500 flex-wrap">
          <span className="capitalize">{p.productType}</span>
          <span>·</span>
          <span>{p.isFree ? 'FREE' : p.pricing?.ngn != null ? formatCurrency(p.pricing.ngn, 'NGN') : '—'}</span>
          <span>·</span>
          <span>{p.salesCount ?? 0} sales</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-2 border-t border-gray-800">
          <button onClick={onEdit}
            className="flex-1 text-xs py-1.5 rounded-lg bg-gray-800 text-brand-400 hover:bg-gray-700 transition">
            Edit
          </button>
          <button onClick={onTogglePublish}
            className={`flex-1 text-xs py-1.5 rounded-lg transition ${
              p.isPublished
                ? 'bg-gray-800 text-red-400 hover:bg-gray-700'
                : 'bg-brand-600 text-white hover:bg-brand-500'
            }`}>
            {p.isPublished ? 'Unpublish' : 'Publish'}
          </button>
          {p.isPublished && (
            <button onClick={share} title="Copy link"
              className="px-3 text-xs py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition">
              {copied ? '✓' : '🔗'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductFormModal({ initial, onClose, onSaved }) {
  const isNew = !initial._id;
  const [form, setForm] = useState({
    title:           initial.title          ?? '',
    description:     initial.description    ?? '',
    productType:     initial.productType    ?? 'book',
    coverImageUrl:   initial.coverImageUrl  ?? '',
    deliveryMethod:  initial.deliveryMethod ?? 'r2',
    secureFileKey:   initial.secureFileKey  ?? '',
    googleDriveUrl:  initial.googleDriveUrl ?? '',
    isFree:          initial.isFree         ?? false,
    allowStreaming:  initial.allowStreaming ?? false,
    creator:         initial.creator        ?? '',
    trackList:       (initial.trackList ?? []).join('\n'),
    price_ngn:       initial.pricing?.ngn   ?? '',
    price_usd:       initial.pricing?.usd   ?? '',
    price_gbp:       initial.pricing?.gbp   ?? '',
    price_eur:       initial.pricing?.eur   ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function handle(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Validate delivery fields
    if (form.deliveryMethod === 'r2' && !form.secureFileKey) {
      setError('Please upload a product file to R2 first.'); return;
    }
    if (form.deliveryMethod === 'google_drive' && !form.googleDriveUrl) {
      setError('Please enter the Google Drive share URL.'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title, description: form.description,
        productType: form.productType, coverImageUrl: form.coverImageUrl,
        deliveryMethod: form.deliveryMethod,
        secureFileKey:  form.deliveryMethod === 'r2'           ? form.secureFileKey  : undefined,
        googleDriveUrl: form.deliveryMethod === 'google_drive' ? form.googleDriveUrl : undefined,
        isFree: Boolean(form.isFree),
        allowStreaming: form.productType === 'audio' && Boolean(form.allowStreaming),
        creator: form.creator || undefined,
        trackList: form.trackList
          ? form.trackList.split('\n').map((t) => t.trim()).filter(Boolean)
          : undefined,
        pricing: {
          ngn: form.price_ngn ? Number(form.price_ngn) : null,
          usd: form.price_usd ? Number(form.price_usd) : null,
          gbp: form.price_gbp ? Number(form.price_gbp) : null,
          eur: form.price_eur ? Number(form.price_eur) : null,
        },
      };
      isNew ? await createProduct(payload) : await updateProduct(initial._id, payload);
      onSaved();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900
                       overflow-y-auto max-h-[90vh] p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">{isNew ? 'New Product' : 'Edit Product'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Title"><input className="input" name="title" value={form.title} onChange={handle} required /></Field>
          <Field label="Description"><textarea className="input min-h-[80px]" name="description" value={form.description} onChange={handle} required /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Product Type">
              <select className="input" name="productType" value={form.productType} onChange={handle}>
                <option value="book">Book</option>
                <option value="audio">Audio Album</option>
              </select>
            </Field>
            <Field label="Creator"><input className="input" name="creator" value={form.creator} onChange={handle} /></Field>
          </div>
          <Field label="Cover Image URL"><input className="input" name="coverImageUrl" value={form.coverImageUrl} onChange={handle} placeholder="https://…" required /></Field>

          {/* ── Delivery method ──────────────────────────────────────────── */}
          <Field label="File Delivery Method">
            <div className="grid grid-cols-2 gap-3 mt-1">
              {[
                { value: 'r2',           label: '☁️ Upload to R2',      desc: 'Direct secure download (recommended)' },
                { value: 'google_drive', label: '📂 Google Drive Link',  desc: 'Link to a Google Drive file' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex flex-col gap-0.5 border rounded-xl p-3 cursor-pointer transition
                    ${form.deliveryMethod === opt.value
                      ? 'border-brand-500 bg-brand-900/20 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                >
                  <input
                    type="radio" name="deliveryMethod" value={opt.value}
                    checked={form.deliveryMethod === opt.value}
                    onChange={handle}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-xs text-gray-500">{opt.desc}</span>
                </label>
              ))}
            </div>
          </Field>

          {/* ── File source depending on delivery method ─────────────────── */}
          {form.deliveryMethod === 'r2' ? (
            <Field label="Product File (R2)" hint="PDF/EPUB for books · MP3/WAV for audio">
              <R2FileUploader
                productType={form.productType}
                currentKey={form.secureFileKey}
                onUploaded={(key) => setForm((f) => ({ ...f, secureFileKey: key }))}
              />
              {form.secureFileKey && (
                <p className="text-xs text-green-400 mt-1">
                  ✓ Uploaded: <span className="font-mono">{form.secureFileKey}</span>
                </p>
              )}
            </Field>
          ) : (
            <Field
              label="Google Drive Share URL"
              hint="Use 'Anyone with the link can view'"
            >
              <input
                className="input"
                name="googleDriveUrl"
                value={form.googleDriveUrl}
                onChange={handle}
                placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
              />
              <p className="text-xs text-gray-500 mt-1">
                Buyers receive this link only after a confirmed purchase.
              </p>
            </Field>
          )}

          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
            form.isFree
              ? 'border-emerald-500 bg-emerald-950/30'
              : 'border-gray-700 bg-gray-800/40'
          }`}>
            <input
              type="checkbox"
              name="isFree"
              checked={form.isFree}
              onChange={handle}
              className="mt-1 h-4 w-4 accent-emerald-500"
            />
            <span>
              <span className="block text-sm font-bold text-white">Free download</span>
              <span className="block text-xs text-gray-400">
                Visitors can download this published product without payment or an account.
              </span>
            </span>
          </label>

          {form.productType === 'audio' && (
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
              form.allowStreaming
                ? 'border-sky-500 bg-sky-950/30'
                : 'border-gray-700 bg-gray-800/40'
            }`}>
              <input
                type="checkbox"
                name="allowStreaming"
                checked={form.allowStreaming}
                onChange={handle}
                className="mt-1 h-4 w-4 accent-sky-500"
              />
              <span>
                <span className="block text-sm font-bold text-white">Allow public streaming</span>
                <span className="block text-xs text-gray-400">
                  Adds an audio player so everyone can listen. R2 upload is required.
                </span>
              </span>
            </label>
          )}

          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pricing</p>
          <div className="grid grid-cols-2 gap-4">
            {[['price_ngn','NGN (₦)'],['price_usd','USD ($)'],['price_gbp','GBP (£)'],['price_eur','EUR (€)']].map(([name, label]) => (
              <Field key={name} label={label}>
                <input className="input" name={name} type="number" min="0" value={form[name]} onChange={handle} placeholder="Leave blank if N/A" />
              </Field>
            ))}
          </div>
          {form.productType === 'audio' && (
            <Field label="Track Listing (one per line)">
              <textarea className="input min-h-[80px] font-mono text-xs" name="trackList"
                value={form.trackList} onChange={handle} placeholder="Track 1&#10;Track 2" />
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

// ══════════════════════════════════════════════════════════════════════
// ORDERS TAB
// ══════════════════════════════════════════════════════════════════════
function OrdersTab() {
  const [orders, setOrders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

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
      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Buyer</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Amount</th>
                <th className="px-4 py-3 text-left">Provider</th>
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
                  <td className="px-4 py-3 text-gray-300 max-w-[160px] truncate">{o.product?.title}</td>
                  <td className="px-4 py-3 text-gray-100 font-medium">{formatCurrency(o.amountCharged, o.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs capitalize px-2 py-0.5 rounded-full
                      ${o.provider === 'paystack'
                        ? 'bg-emerald-900/40 text-emerald-400'
                        : 'bg-orange-900/40 text-orange-400'}`}>
                      {o.provider ?? 'flutterwave'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <StatusBadge active={o.status === 'completed'} trueLabel="Completed" falseLabel={o.status} />
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

// ══════════════════════════════════════════════════════════════════════
// USERS TAB
// ══════════════════════════════════════════════════════════════════════
function UsersTab() {
  const [data, setData]       = useState({ users: [], total: 0, pages: 1 });
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback((p) => {
    setLoading(true);
    getAdminUsers(p)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  async function handleToggle(user) {
    try {
      const updated = await toggleUser(user._id);
      setData((d) => ({
        ...d,
        users: d.users.map((u) => u._id === updated._id ? { ...u, isActive: updated.isActive } : u),
      }));
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">{data.total} users</p>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.users.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3 text-gray-100">{u.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize
                        ${u.role === 'admin'
                          ? 'bg-brand-900/50 text-brand-400'
                          : 'bg-gray-700 text-gray-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{u.orderCount}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={u.isActive} trueLabel="Active" falseLabel="Disabled" />
                    </td>
                    <td className="px-4 py-3">
                      {u.role !== 'admin' && (
                        <button onClick={() => handleToggle(u)}
                          className={`text-xs hover:underline
                            ${u.isActive ? 'text-red-400' : 'text-green-400'}`}>
                          {u.isActive ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex justify-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-40">← Prev</button>
              <span className="text-sm text-gray-400 self-center">
                Page {page} of {data.pages}
              </span>
              <button disabled={page === data.pages} onClick={() => setPage((p) => p + 1)}
                className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared helpers ──────────────────────────────────────────────────────────
function StatusBadge({ active, trueLabel, falseLabel }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium
      ${active ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
      {active ? trueLabel : falseLabel}
    </span>
  );
}

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
