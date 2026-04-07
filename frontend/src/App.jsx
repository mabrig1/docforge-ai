import { useState, useCallback, useRef, useMemo } from 'react';
import { parseInstruction, formatDocument, generateCitations, exportDocument } from './utils/api.js';

const PRESETS = [
  { id: 'apa', name: 'APA Academic', desc: 'Double-spaced, serif, APA 7th', accent: '#C4956A',
    instruction: 'Times New Roman, 12pt body, double spacing (2.0). Heading 1: bold, 14pt, flush left. Heading 2: bold italic, 12pt. Justified alignment. 1-inch margins. APA 7th edition referencing.' },
  { id: 'mla', name: 'MLA Essay', desc: 'Double-spaced, Works Cited', accent: '#7A8B7A',
    instruction: 'Times New Roman, 12pt body, double spacing (2.0). Heading 1: bold, 12pt, centered. Heading 2: bold, 12pt, flush left. Left alignment. 1-inch margins. MLA 9th edition referencing.' },
  { id: 'report', name: 'Business Report', desc: 'Clean sans-serif, tight spacing', accent: '#5B7FA5',
    instruction: 'Calibri, 11pt body, 1.15 line spacing. Heading 1: bold, 18pt, color #1B2A4A. Heading 2: bold, 13pt, color #2D4A6F. Justified alignment. 1-inch margins. No referencing.' },
  { id: 'ieee', name: 'IEEE Conference', desc: '10pt, numbered refs', accent: '#8B6FA5',
    instruction: 'Times New Roman, 10pt body, single spacing (1.0). Heading 1: bold, 10pt, small caps, centered. Heading 2: bold italic, 10pt, flush left. Justified alignment. 0.75-inch margins. IEEE numbered referencing.' },
];

const SAMPLE = `Introduction to Machine Learning

Background

Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed (Bishop, 2006).

Types of Machine Learning

Supervised Learning

In supervised learning, algorithms learn from labeled training data to make predictions. According to Murphy (2012), this paradigm accounts for approximately 70% of practical ML applications.

Unsupervised Learning

Unsupervised learning deals with unlabeled data (Hastie et al., 2009).

Conclusion

Machine learning continues to evolve rapidly.

References

Bishop, C. M. (2006). Pattern Recognition and Machine Learning. Springer.
Hastie, T., Tibshirani, R., & Friedman, J. (2009). The Elements of Statistical Learning. Springer.
Murphy, K. P. (2012). Machine Learning: A Probabilistic Perspective. MIT Press.`;

const wc = (t) => t ? t.trim().split(/\s+/).filter(Boolean).length : 0;
const sz = (s) => parseInt(String(s).replace(/[^0-9.]/g, '')) || 12;

export default function App() {
  const [doc, setDoc] = useState('');
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [rules, setRules] = useState(null);
  const [error, setError] = useState(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [tab, setTab] = useState('paste');
  const [view, setView] = useState('preview');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const abortRef = useRef(null);

  const busy = ['parsing', 'structuring', 'citations', 'exporting'].includes(status);
  const words = useMemo(() => wc(doc), [doc]);

  const cancel = useCallback(() => { abortRef.current?.abort(); abortRef.current = null; setStatus('idle'); }, []);

  const readFile = useCallback((file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => setDoc(e.target.result);
    r.readAsText(file);
  }, []);

  const handleFormat = useCallback(async () => {
    if (!doc.trim() || !instruction.trim()) { setError('Provide both a document and instructions.'); return; }
    setError(null); setResult(null); setRules(null); setUsedFallback(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      setStatus('parsing');
      const parsed = await parseInstruction(instruction, ctrl.signal);
      const r = parsed.rules;
      setRules(r);
      if (parsed.used_fallback) setUsedFallback(true);

      setStatus('structuring');
      const formatted = await formatDocument(doc, r, ctrl.signal);
      let structured = formatted.structured_document;

      const ref = (r.referencing || 'none').toLowerCase();
      if (ref !== 'none') {
        setStatus('citations');
        const cited = await generateCitations(structured, r.referencing, ctrl.signal);
        structured = cited.document;
      }
      setResult(structured);
      setStatus('done');
    } catch (err) {
      if (err.name === 'AbortError') { setStatus('idle'); return; }
      setError(err.message); setStatus('error');
    } finally { abortRef.current = null; }
  }, [doc, instruction]);

  const handleExport = useCallback(async (fmt) => {
    if (!result || !rules) return;
    try {
      setStatus('exporting');
      await exportDocument(result, rules, fmt);
      setStatus('done');
    } catch (err) { setError(err.message); setStatus('error'); }
  }, [result, rules]);

  const clear = useCallback(() => { cancel(); setDoc(''); setInstruction(''); setResult(null); setRules(null); setError(null); setUsedFallback(false); setView('preview'); }, [cancel]);

  const renderPreview = () => {
    if (!result) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#999' }}>Formatted document appears here</div>;
    const font = rules?.font || 'Times New Roman';
    const bSz = sz(rules?.body_size);
    const lh = parseFloat(rules?.line_spacing || '1.5') + 0.25;
    const align = (rules?.alignment || 'justified').replace('justified', 'justify');
    const h1 = rules?.heading_1 || {};
    const h2 = rules?.heading_2 || {};
    const h3 = rules?.heading_3 || {};

    return result.split('\n').filter(l => l.trim()).map((raw, i) => {
      const m = raw.trim().match(/^\[([A-Z0-9]+)\]\s*(.*)/s);
      const tag = m?.[1]; const text = m?.[2]?.trim() || raw.trim();
      const base = { fontFamily: font, fontSize: bSz, lineHeight: lh, color: '#2b2b2b' };
      if (tag === 'TITLE') return <h1 key={i} style={{ ...base, fontSize: sz(h1.size) + 6, fontWeight: 700, textAlign: 'center', marginBottom: 24, borderBottom: '1.5px solid #ddd', paddingBottom: 16 }}>{text}</h1>;
      if (tag === 'H1') return <h2 key={i} style={{ ...base, fontSize: sz(h1.size), fontWeight: 700, color: h1.color || '#1a1a1a', marginTop: 28, marginBottom: 10 }}>{text}</h2>;
      if (tag === 'H2') return <h3 key={i} style={{ ...base, fontSize: sz(h2.size), fontWeight: h2.bold ? 600 : 400, fontStyle: h2.italic ? 'italic' : 'normal', color: h2.color || '#333', marginTop: 20, marginBottom: 8 }}>{text}</h3>;
      if (tag === 'H3') return <h4 key={i} style={{ ...base, fontSize: sz(h3.size) || bSz, fontWeight: h3.bold ? 500 : 400, fontStyle: h3.italic ? 'italic' : 'normal', color: h3.color || '#555', marginTop: 14, marginBottom: 6 }}>{text}</h4>;
      if (tag === 'REFERENCES') return <h2 key={i} style={{ ...base, fontSize: sz(h1.size), fontWeight: 700, marginTop: 32, paddingTop: 20, borderTop: '1.5px solid #ddd' }}>{text || 'References'}</h2>;
      if (tag === 'REF') return <p key={i} style={{ ...base, paddingLeft: 36, textIndent: -36, marginBottom: 5 }}>{text}</p>;
      return <p key={i} style={{ ...base, textAlign: align, marginBottom: 10 }}>{text}</p>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0C0E11', color: '#E8E6E1', fontFamily: "'Outfit',system-ui,sans-serif", display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600;700&family=Outfit:wght@400;500;600;700&family=Fira+Code:wght@400&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
        *{box-sizing:border-box;margin:0;padding:0}
        textarea:focus{outline:none;border-color:#C4956A !important}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
      `}</style>

      <header style={{ padding: '12px 24px', borderBottom: '1px solid #23272E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 16, fontFamily: "'Newsreader',serif" }}>DocForge<span style={{ color: '#C4956A', fontWeight: 400, marginLeft: 3 }}>AI</span></h1>
        <span style={{ fontSize: 11, color: status === 'error' ? '#D4665A' : '#585653' }}>
          {busy ? status + '…' : status === 'done' ? 'Complete' : status === 'error' ? 'Error' : 'Ready'}
        </span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #23272E', overflow: 'hidden' }}>
          <div style={{ padding: '10px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['paste', 'upload'].map(k => (
                <button key={k} onClick={() => setTab(k)} style={{ padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer', background: tab === k ? '#1A1D23' : 'transparent', color: tab === k ? '#E8E6E1' : '#585653', fontSize: 11, fontWeight: 600 }}>{k === 'paste' ? 'Paste' : 'Upload'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {words > 0 && <span style={{ fontSize: 10, color: '#585653', fontFamily: "'Fira Code',monospace" }}>{words} words</span>}
              <button onClick={() => { setDoc(SAMPLE); setInstruction(PRESETS[0].instruction); }} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid #23272E', background: 'transparent', color: '#585653', fontSize: 10, cursor: 'pointer' }}>Sample</button>
            </div>
          </div>

          <div style={{ flex: 1, padding: '8px 18px', display: 'flex' }}>
            {tab === 'paste' ? (
              <textarea value={doc} onChange={e => setDoc(e.target.value)} placeholder="Paste document here…" style={{ flex: 1, background: '#13161B', border: '1px solid #23272E', borderRadius: 8, padding: 14, color: '#E8E6E1', fontSize: 12, lineHeight: 1.7, resize: 'none', fontFamily: "'Fira Code',monospace" }} />
            ) : (
              <div onClick={() => fileRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer?.files?.[0]); }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#13161B', border: `2px dashed ${dragOver ? '#C4956A' : '#23272E'}`, borderRadius: 8, cursor: 'pointer' }}>
                <input ref={fileRef} type="file" accept=".txt,.md" onChange={e => readFile(e.target.files?.[0])} style={{ display: 'none' }} />
                <p style={{ color: '#585653', fontSize: 13 }}>Drop file or click to browse</p>
              </div>
            )}
          </div>

          <div style={{ padding: '0 18px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => setInstruction(p.instruction)} style={{ padding: '7px 10px', borderRadius: 6, border: `1.5px solid ${instruction === p.instruction ? p.accent : '#23272E'}`, background: instruction === p.instruction ? p.accent + '0D' : '#13161B', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: instruction === p.instruction ? p.accent : '#E8E6E1' }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: '#585653' }}>{p.desc}</div>
                </button>
              ))}
            </div>
            <textarea value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="Custom instructions…" rows={2} style={{ width: '100%', background: '#13161B', border: '1px solid #23272E', borderRadius: 6, padding: '8px 12px', color: '#E8E6E1', fontSize: 12, lineHeight: 1.5, resize: 'none' }} />
            {error && <div style={{ marginTop: 6, padding: '6px 10px', background: '#D4665A12', border: '1px solid #D4665A30', borderRadius: 6, color: '#D4665A', fontSize: 11 }}>{error}</div>}
            {usedFallback && !error && <div style={{ marginTop: 6, padding: '6px 10px', background: '#C4956A12', border: '1px solid #C4956A40', borderRadius: 6, color: '#C4956A', fontSize: 11 }}>Could not parse your instructions — default formatting rules were applied.</div>}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={busy ? cancel : handleFormat} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer', background: busy ? '#1A1D23' : 'linear-gradient(135deg,#C4956A,#A07A55)', color: busy ? '#A8A5A0' : '#fff', fontSize: 13, fontWeight: 700 }}>{busy ? 'Cancel' : 'Format Document'}</button>
              <button onClick={clear} style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid #23272E', background: 'transparent', color: '#585653', fontSize: 12, cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#13161B' }}>
          <div style={{ padding: '8px 18px', borderBottom: '1px solid #23272E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {['preview', 'json', 'raw'].map(k => (
                <button key={k} onClick={() => setView(k)} style={{ padding: '3px 11px', borderRadius: 4, border: 'none', cursor: 'pointer', background: view === k ? '#1A1D23' : 'transparent', color: view === k ? '#E8E6E1' : '#585653', fontSize: 10, fontWeight: 600 }}>{k}</button>
              ))}
            </div>
            {result && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => handleExport('docx')} style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid #23272E', background: 'transparent', color: '#585653', fontSize: 10, cursor: 'pointer' }}>.docx</button>
                <button onClick={() => handleExport('pdf')} style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid #23272E', background: 'transparent', color: '#585653', fontSize: 10, cursor: 'pointer' }}>.pdf</button>
                <button onClick={() => navigator.clipboard?.writeText(result)} style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid #23272E', background: 'transparent', color: '#585653', fontSize: 10, cursor: 'pointer' }}>Copy</button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', justifyContent: 'center' }}>
            {view === 'json' && rules ? (
              <pre style={{ width: '100%', maxWidth: 560, background: '#0C0E11', borderRadius: 8, padding: 20, border: '1px solid #23272E', color: '#C4956A', fontSize: 12, fontFamily: "'Fira Code',monospace", lineHeight: 1.8, overflow: 'auto' }}>{JSON.stringify(rules, null, 2)}</pre>
            ) : view === 'raw' && result ? (
              <pre style={{ width: '100%', background: '#0C0E11', borderRadius: 8, padding: 20, border: '1px solid #23272E', color: '#A8A5A0', fontSize: 11, fontFamily: "'Fira Code',monospace", lineHeight: 1.8, whiteSpace: 'pre-wrap', overflow: 'auto' }}>{result}</pre>
            ) : (
              <div style={{ width: '100%', maxWidth: 640, background: '#FAF8F5', borderRadius: 3, padding: '44px 48px', minHeight: 400, boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.03)' }}>
                {renderPreview()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
