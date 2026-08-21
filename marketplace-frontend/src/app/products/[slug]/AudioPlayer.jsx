'use client';

import { useRef, useState } from 'react';
import { getAudioStreamUrl } from '@/lib/api';

export default function AudioPlayer({ product }) {
  const audioRef = useRef(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function prepareStream() {
    if (streamUrl) {
      audioRef.current?.play();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await getAudioStreamUrl(product._id);
      setStreamUrl(data.streamUrl);
      window.setTimeout(() => audioRef.current?.play(), 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card space-y-3 border border-sky-800/60 bg-sky-950/20" aria-label="Song player">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-sky-400">Listen now</p>
        <h2 className="mt-1 font-bold text-white">{product.title}</h2>
        {product.creator && <p className="text-sm text-gray-400">{product.creator}</p>}
      </div>

      {streamUrl ? (
        <audio
          ref={audioRef}
          src={streamUrl}
          controls
          preload="metadata"
          controlsList="nodownload"
          className="w-full"
        >
          Your browser does not support audio playback.
        </audio>
      ) : (
        <button
          type="button"
          onClick={prepareStream}
          disabled={loading}
          className="w-full rounded-lg bg-sky-600 py-3 font-bold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? 'Preparing song…' : '▶ Play song'}
        </button>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-gray-500">
        Streaming is provided by Mabrig Korie’s secure music library.
      </p>
    </section>
  );
}
