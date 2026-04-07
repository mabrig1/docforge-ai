import { useState, useCallback, useRef, useMemo } from 'react';
import { formatDocument, generateCitations, exportDocument, extractText } from './utils/api.js';

// ─── Options ────────────────────────────────────────────────────────────────

const FONTS = ['Times New Roman', 'Calibri', 'Arial', 'Georgia', 'Garamond', 'Helvetica Neue'];
const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt'];
const SPACINGS = [
  { label: 'Single (1.0)', value: '1.0' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Double (2.0)', value: '2.0' },
];
const ALIGNMENTS = [
  { label: 'Justify', value: 'justified' },
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];
const INDENTATIONS = [
  { label: 'None', value: 'none' },
  { label: 'First line 0.5"', value: '0.5 inch' },
  { label: 'First line 1"', value: '1 inch' },
  { label: 'Hanging 0.5"', value: 'hanging 0.5 inch' },
];
const REFERENCES = [
  { label: 'APA 7th', value: 'APA' },
  { label: 'MLA 9th', value: 'MLA' },
  { label: 'Chicago', value: 'Chicago' },
  { label: 'Harvard', value: 'Harvard' },
  { label: 'IEEE', value: 'IEEE' },
  { label: 'None', value: 'none' },
];

// ─── Defaults & Presets ─────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  font: 'Times New Roman',
  fontSize: '12pt',
  spacing: '2.0',
  alignment: 'justified',
  indentation: '0.5 inch',
  referencing: 'APA',
};

const PRESETS = [
  {
    id: 'apa', name: 'APA Academic', desc: 'Double-spaced · APA 7th', accent: '#C4956A',
    settings: { font: 'Times New Roman', fontSize: '12pt', spacing: '2.0', alignment: 'justified', indentation: '0.5 inch', referencing: 'APA' },
  },
  {
    id: 'mla', name: 'MLA Essay', desc: 'Double-spaced · Works Cited', accent: '#7A8B7A',
    settings: { font: 'Times New Roman', fontSize: '12pt', spacing: '2.0', alignment: 'left', indentation: '0.5 inch', referencing: 'MLA' },
  },
  {
    id: 'report', name: 'Business Report', desc: 'Sans-serif · 1.15 spacing', accent: '#5B7FA5',
    settings: { font: 'Calibri', fontSize: '11pt', spacing: '1.15', alignment: 'justified', indentation: 'none', referencing: 'none' },
  },
  {
    id: 'ieee', name: 'IEEE Conference', desc: '10pt · Numbered refs', accent: '#8B6FA5',
    settings: { font: 'Times New Roman', fontSize: '10pt', spacing: '1.0', alignment: 'justified', indentation: 'none', referencing: 'IEEE' },
  },
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

// ─── Helpers ────────────────────────────────────────────────────────────────

const wc = (t) => t ? t.trim().split(/\s+/).filter(Boolean).length : 0;
const sz = (s) => parseInt(String(s).replace(/[^0-9.]/g, '')) || 12;

const buildRules = (s) => {
  const bodyPt = sz(s.fontSize);
  return {
    font: s.font,
    body_size: s.fontSize,
    line_spacing: s.spacing,
    paragraph_spacing_after: '8pt',
    heading_1: { size: `${bodyPt + 2}pt`, bold: true, italic: false, color: '#000000', alignment: 'left', caps: false },
    heading_2: { size: `${bodyPt}pt`, bold: true, italic: true, color: '#333333' },
    heading_3: { size: `${bodyPt}pt`, bold: false, italic: true, color: '#555555' },
    alignment: s.alignment,
    referencing: s.referencing,
    margins: '1 inch',
    first_line_indent: s.indentation,
  };
};

// ─── Reusable setting field ──────────────────────────────────────────────────

const selStyle = {
  width: '100%', background: '#0C0E11', border: '1px solid #2A2E37',
  borderRadius: 5, color: '#C8C5BF', fontSize: 11, padding: '5px 8px',
  cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23585653'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  paddingRight: 24,
};

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: '#585653', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────

export default function App() {
  const [doc, setDoc] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activePreset, setActivePreset] = useState('apa');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [rules, setRules] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('paste');
  const [view, setView] = useState('preview');
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);   // { name, size }
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef(null);
  const abortRef = useRef(null);

  const busy = ['structuring', 'citations', 'exporting'].includes(status);
  const words = useMemo(() => wc(doc), [doc]);

  const setSetting = useCallback((key, val) => {
    setSettings(s => ({ ...s, [key]: val }));
    setActivePreset(null);
  }, []);

  const applyPreset = useCallback((preset) => {
    setSettings(preset.settings);
    setActivePreset(preset.id);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
  }, []);

  const readFile = useCallback(async (file) => {
    if (!file) return;
    setUploadedFile({ name: file.name, size: file.size });
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'md') {
      const reader = new FileReader();
      reader.onload = (e) => setDoc(e.target.result);
      reader.readAsText(file);
    } else {
      // .docx or .pdf — send to backend for extraction
      setExtracting(true);
      setError(null);
      try {
        const res = await extractText(file);
        setDoc(res.text);
      } catch (err) {
        setError(err.message);
        setUploadedFile(null);
      } finally {
        setExtracting(false);
      }
    }
  }, []);

  const handleFormat = useCallback(async () => {
    if (!doc.trim()) { setError('Paste or upload a document first.'); return; }
    setError(null); setResult(null); setRules(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = buildRules(settings);
      setRules(r);

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
      setError(err.message);
      setStatus('error');
    } finally { abortRef.current = null; }
  }, [doc, settings]);

  const handleExport = useCallback(async (fmt) => {
    if (!result || !rules) return;
    try {
      setStatus('exporting');
      await exportDocument(result, rules, fmt);
      setStatus('done');
    } catch (err) { setError(err.message); setStatus('error'); }
  }, [result, rules]);

  const clear = useCallback(() => {
    cancel();
    setDoc('');
    setSettings(DEFAULT_SETTINGS);
    setActivePreset('apa');
    setResult(null);
    setRules(null);
    setError(null);
    setView('preview');
    setUploadedFile(null);
    setExtracting(false);
    if (fileRef.current) fileRef.current.value = '';
  }, [cancel]);

  const renderPreview = () => {
    if (!result) return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#999' }}>
        Formatted document appears here
      </div>
    );
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
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box;margin:0;padding:0}
        select:focus{outline:none;border-color:#C4956A !important}
        textarea:focus{outline:none;border-color:#C4956A !important}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
        select option{background:#0C0E11;color:#C8C5BF}
      `}</style>

      {/* Header */}
      <header style={{ padding: '12px 24px', borderBottom: '1px solid #23272E', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontFamily: "'Newsreader',serif" }}>DocForge<span style={{ color: '#C4956A', fontWeight: 400, marginLeft: 3 }}>AI</span></h1>
        <span style={{ fontSize: 11, color: status === 'error' ? '#D4665A' : '#585653' }}>
          {busy ? status + '…' : status === 'done' ? 'Complete' : status === 'error' ? 'Error' : 'Ready'}
        </span>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', flex: 1, overflow: 'hidden' }}>

        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #23272E', overflow: 'hidden' }}>

          {/* Tab bar */}
          <div style={{ padding: '10px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['paste', 'upload'].map(k => (
                <button key={k} onClick={() => setTab(k)} style={{ padding: '4px 12px', borderRadius: 5, border: 'none', cursor: 'pointer', background: tab === k ? '#1A1D23' : 'transparent', color: tab === k ? '#E8E6E1' : '#585653', fontSize: 11, fontWeight: 600 }}>
                  {k === 'paste' ? 'Paste' : 'Upload'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {words > 0 && <span style={{ fontSize: 10, color: '#585653', fontFamily: "'Fira Code',monospace" }}>{words} words</span>}
              <button onClick={() => { setDoc(SAMPLE); applyPreset(PRESETS[0]); }}
                style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid #23272E', background: 'transparent', color: '#585653', fontSize: 10, cursor: 'pointer' }}>
                Sample
              </button>
            </div>
          </div>

          {/* Document input */}
          <div style={{ flex: 1, padding: '8px 18px', display: 'flex', minHeight: 0 }}>
            {tab === 'paste' ? (
              <textarea value={doc} onChange={e => setDoc(e.target.value)} placeholder="Paste document here…"
                style={{ flex: 1, background: '#13161B', border: '1px solid #23272E', borderRadius: 8, padding: 14, color: '#E8E6E1', fontSize: 12, lineHeight: 1.7, resize: 'none', fontFamily: "'Fira Code',monospace" }} />
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Drop zone */}
                <div
                  onClick={() => !extracting && fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer?.files?.[0]); }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#13161B', border: `2px dashed ${dragOver ? '#C4956A' : uploadedFile ? '#3A4A3A' : '#23272E'}`, borderRadius: 8, cursor: extracting ? 'default' : 'pointer', transition: 'border-color 0.15s' }}>
                  <input ref={fileRef} type="file" accept=".txt,.md,.docx,.pdf" onChange={e => readFile(e.target.files?.[0])} style={{ display: 'none' }} />
                  {extracting ? (
                    <>
                      <div style={{ width: 20, height: 20, border: '2px solid #C4956A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      <span style={{ color: '#C4956A', fontSize: 12 }}>Extracting text…</span>
                    </>
                  ) : uploadedFile ? (
                    <>
                      <div style={{ fontSize: 22 }}>📄</div>
                      <span style={{ color: '#A8C8A8', fontSize: 12, fontWeight: 600 }}>{uploadedFile.name}</span>
                      <span style={{ color: '#585653', fontSize: 10 }}>{(uploadedFile.size / 1024).toFixed(1)} KB · {words} words extracted</span>
                      <span style={{ color: '#585653', fontSize: 10 }}>Click to replace</span>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 22 }}>⬆</div>
                      <span style={{ color: '#585653', fontSize: 13 }}>Drop file or click to browse</span>
                      <span style={{ color: '#3A3E47', fontSize: 10 }}>.txt · .md · .docx · .pdf</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Formatting Settings ──────────────────────────────────────── */}
          <div style={{ flexShrink: 0, padding: '0 18px', borderTop: '1px solid #23272E' }}>

            {/* Settings header + presets */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#585653', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Formatting Settings
              </span>
              <div style={{ display: 'flex', gap: 3 }}>
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => applyPreset(p)}
                    title={p.desc}
                    style={{
                      padding: '2px 7px', borderRadius: 4,
                      border: `1px solid ${activePreset === p.id ? p.accent : '#2A2E37'}`,
                      background: activePreset === p.id ? p.accent + '18' : 'transparent',
                      color: activePreset === p.id ? p.accent : '#585653',
                      fontSize: 9, cursor: 'pointer', fontWeight: 600,
                    }}>
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 1: Font · Size · Spacing */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 110px', gap: 8, marginBottom: 8 }}>
              <Field label="Font">
                <select value={settings.font} onChange={e => setSetting('font', e.target.value)} style={selStyle}>
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Size">
                <select value={settings.fontSize} onChange={e => setSetting('fontSize', e.target.value)} style={selStyle}>
                  {FONT_SIZES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Line Spacing">
                <select value={settings.spacing} onChange={e => setSetting('spacing', e.target.value)} style={selStyle}>
                  {SPACINGS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>

            {/* Row 2: Alignment · Indentation · References */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <Field label="Alignment">
                <select value={settings.alignment} onChange={e => setSetting('alignment', e.target.value)} style={selStyle}>
                  {ALIGNMENTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Indentation">
                <select value={settings.indentation} onChange={e => setSetting('indentation', e.target.value)} style={selStyle}>
                  {INDENTATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="References">
                <select value={settings.referencing} onChange={e => setSetting('referencing', e.target.value)} style={selStyle}>
                  {REFERENCES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>

            {/* Banners */}
            {error && (
              <div style={{ marginBottom: 8, padding: '6px 10px', background: '#D4665A12', border: '1px solid #D4665A30', borderRadius: 6, color: '#D4665A', fontSize: 11 }}>
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <button onClick={busy ? cancel : handleFormat}
                style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer', background: busy ? '#1A1D23' : 'linear-gradient(135deg,#C4956A,#A07A55)', color: busy ? '#A8A5A0' : '#fff', fontSize: 13, fontWeight: 700 }}>
                {busy ? 'Cancel' : 'Format Document'}
              </button>
              <button onClick={clear}
                style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid #23272E', background: 'transparent', color: '#585653', fontSize: 12, cursor: 'pointer' }}>
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#13161B' }}>
          <div style={{ padding: '8px 18px', borderBottom: '1px solid #23272E', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              {['preview', 'json', 'raw'].map(k => (
                <button key={k} onClick={() => setView(k)}
                  style={{ padding: '3px 11px', borderRadius: 4, border: 'none', cursor: 'pointer', background: view === k ? '#1A1D23' : 'transparent', color: view === k ? '#E8E6E1' : '#585653', fontSize: 10, fontWeight: 600 }}>
                  {k}
                </button>
              ))}
            </div>
            {result && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#3A3E47', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 2 }}>Download</span>
                <button onClick={() => handleExport('docx')} title="Download as Word document"
                  style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid #2A2E37', background: '#1A1D23', color: '#A8C8D8', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                  .docx
                </button>
                <button onClick={() => handleExport('pdf')} title="Download as PDF"
                  style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid #2A2E37', background: '#1A1D23', color: '#D4A8A8', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                  .pdf
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([result], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'formatted.txt'; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  title="Download as plain text"
                  style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid #2A2E37', background: '#1A1D23', color: '#A8C8A8', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                  .txt
                </button>
                <div style={{ width: 1, height: 14, background: '#23272E', margin: '0 2px' }} />
                <button onClick={() => navigator.clipboard?.writeText(result)} title="Copy to clipboard"
                  style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid #23272E', background: 'transparent', color: '#585653', fontSize: 10, cursor: 'pointer' }}>
                  Copy
                </button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', justifyContent: 'center' }}>
            {view === 'json' && rules ? (
              <pre style={{ width: '100%', maxWidth: 560, background: '#0C0E11', borderRadius: 8, padding: 20, border: '1px solid #23272E', color: '#C4956A', fontSize: 12, fontFamily: "'Fira Code',monospace", lineHeight: 1.8, overflow: 'auto' }}>
                {JSON.stringify(rules, null, 2)}
              </pre>
            ) : view === 'raw' && result ? (
              <pre style={{ width: '100%', background: '#0C0E11', borderRadius: 8, padding: 20, border: '1px solid #23272E', color: '#A8A5A0', fontSize: 11, fontFamily: "'Fira Code',monospace", lineHeight: 1.8, whiteSpace: 'pre-wrap', overflow: 'auto' }}>
                {result}
              </pre>
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
