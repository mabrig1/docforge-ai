'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react';

const STORE_ORIGIN = process.env.NEXT_PUBLIC_STORE_URL || 'https://store.mabrigkorie.org';

export default function ShareButtons({ product, compact = false }) {
  const [copied, setCopied] = useState(false);
  const url = `${STORE_ORIGIN}/products/${product.slug}`;
  const message = product.isFree
    ? `Download ${product.title} free from Mabrig Korie's Store`
    : `Discover ${product.title} by ${product.creator || 'Mabrig Korie'}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedMessage = encodeURIComponent(message);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this product link:', url);
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: product.title, text: message, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await copyLink();
  }

  const base = compact
    ? 'inline-flex h-9 w-9 items-center justify-center rounded-full border transition'
    : 'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition';

  return (
    <div className="space-y-2" aria-label="Share this product">
      {compact ? null : (
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Share this product</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`https://wa.me/?text=${encodedMessage}%20${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Share on WhatsApp"
          className={`${base} border-emerald-700 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50`}
        >
          <MessageCircle size={16} />{compact ? null : 'WhatsApp'}
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Share on Facebook"
          className={`${base} border-blue-700 bg-blue-950/30 text-blue-300 hover:bg-blue-900/50`}
        >
          <span className="font-black" aria-hidden="true">f</span>{compact ? null : 'Facebook'}
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Share on X"
          className={`${base} border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700`}
        >
          <span className="font-black" aria-hidden="true">𝕏</span>{compact ? null : 'Share'}
        </a>
        <button
          type="button"
          onClick={nativeShare}
          aria-label="Open phone sharing menu"
          className={`${base} border-purple-700 bg-purple-950/30 text-purple-300 hover:bg-purple-900/50`}
        >
          <Share2 size={16} />{compact ? null : 'More'}
        </button>
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy product link"
          className={`${base} border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800`}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {compact ? null : copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
