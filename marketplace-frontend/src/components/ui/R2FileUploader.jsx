'use client';

/**
 * R2FileUploader — direct-to-R2 upload component for the admin panel.
 *
 * Flow:
 *  1. Admin picks a file locally (PDF, EPUB, MP3, WAV).
 *  2. We derive a deterministic R2 object key from the product type + filename.
 *  3. POST /api/products/upload-url → server returns a presigned PUT URL.
 *  4. Browser PUTs the file directly to Cloudflare R2 (zero server bandwidth).
 *  5. On success, we call onUploaded(objectKey) so the parent form can store it.
 *
 * This component is intentionally standalone — it owns its own upload state
 * and renders a progress bar. The parent only receives the final object key.
 */

import { useState, useRef } from 'react';
import { getUploadUrl } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';

const ACCEPTED = {
  book:  { mimes: ['application/pdf', 'application/epub+zip'], exts: '.pdf,.epub' },
  audio: { mimes: ['audio/mpeg', 'audio/wav', 'audio/x-wav'],  exts: '.mp3,.wav'  },
};

/**
 * @param {object} props
 * @param {'book'|'audio'} props.productType
 * @param {string}         props.currentKey   — existing secureFileKey (shown when editing)
 * @param {function}       props.onUploaded   — called with the new objectKey on success
 */
export default function R2FileUploader({ productType, currentKey, onUploaded }) {
  const inputRef            = useRef(null);
  const [file, setFile]     = useState(null);
  const [progress, setProgress] = useState(0);   // 0-100
  const [status, setStatus] = useState('idle');  // idle | uploading | done | error
  const [error, setError]   = useState('');
  const [uploadedKey, setUploadedKey] = useState(currentKey ?? '');

  const accepted = ACCEPTED[productType] ?? ACCEPTED.book;

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!accepted.mimes.includes(f.type)) {
      setError(`Invalid file type. Allowed: ${accepted.exts}`);
      return;
    }
    setError('');
    setFile(f);
    setStatus('idle');
    setProgress(0);
  }

  async function handleUpload() {
    if (!file) return;
    setError('');
    setStatus('uploading');
    setProgress(0);

    // Derive a safe, predictable object key
    const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folder    = productType === 'audio' ? 'products/audio' : 'products/books';
    const objectKey = `${folder}/${Date.now()}_${safeName}`;

    try {
      // Step 1 — get presigned PUT URL from our backend
      const { uploadUrl } = await getUploadUrl(objectKey, file.type);

      // Step 2 — PUT directly to R2 with XHR so we can track progress
      await uploadWithProgress(uploadUrl, file, (pct) => setProgress(pct));

      // Step 3 — notify parent
      setUploadedKey(objectKey);
      setStatus('done');
      onUploaded(objectKey);
    } catch (e) {
      setError(e.message || 'Upload failed. Please try again.');
      setStatus('error');
    }
  }

  return (
    <div className="space-y-3">
      {/* Current key display */}
      {uploadedKey && (
        <div className="flex items-center gap-2 rounded-lg bg-green-900/20 border
                         border-green-800 px-3 py-2 text-xs text-green-400 font-mono">
          <span className="shrink-0">✓</span>
          <span className="truncate">{uploadedKey}</span>
        </div>
      )}

      {/* File picker */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-secondary text-sm !py-2"
        >
          {file ? 'Change File' : 'Choose File'}
        </button>

        {file && (
          <span className="text-sm text-gray-400 truncate">
            {file.name} ({formatFileSize(file.size)})
          </span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accepted.exts}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Progress bar */}
      {status === 'uploading' && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-brand-500 transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{progress}% uploaded…</p>
        </div>
      )}

      {status === 'done' && (
        <p className="text-xs text-green-400">Upload complete.</p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Upload button — only shown when a new file is chosen */}
      {file && status !== 'uploading' && status !== 'done' && (
        <button
          type="button"
          onClick={handleUpload}
          className="btn-primary text-sm !py-2"
        >
          Upload to R2
        </button>
      )}
    </div>
  );
}

// ── XHR upload with progress ─────────────────────────────────────────────
function uploadWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      // R2 returns 200 on success
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 upload failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')));

    xhr.send(file);
  });
}
