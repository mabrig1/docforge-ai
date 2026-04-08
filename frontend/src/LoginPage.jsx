import { useState } from 'react';
import { loginUser, registerUser } from './utils/api.js';
import { setToken } from './utils/auth.js';

const inputStyle = {
  width: '100%', background: '#13161B', border: '1px solid #2A2E37',
  borderRadius: 7, padding: '10px 14px', color: '#E8E6E1', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

export default function LoginPage({ onAuth }) {
  const [mode, setMode] = useState('login');   // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = mode === 'login'
        ? await loginUser(email, password)
        : await registerUser(email, name, password);
      setToken(data.token);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0C0E11', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600;700&family=Outfit:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input:focus{outline:none;border-color:#C4956A !important}
      `}</style>

      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontFamily: "'Newsreader',serif", color: '#E8E6E1' }}>
            DocForge<span style={{ color: '#C4956A', fontWeight: 400 }}>AI</span>
          </h1>
          <p style={{ marginTop: 8, color: '#585653', fontSize: 13 }}>
            AI-powered academic document formatter
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#13161B', border: '1px solid #23272E', borderRadius: 12, padding: '32px 28px' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: '#0C0E11', borderRadius: 8, padding: 3, marginBottom: 24 }}>
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: mode === m ? '#1A1D23' : 'transparent', color: mode === m ? '#E8E6E1' : '#585653', transition: 'all 0.15s' }}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {mode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#585653', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>Full Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required style={inputStyle} />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#585653', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={inputStyle} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#585653', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'} required style={inputStyle} />
              </div>

              {error && (
                <div style={{ padding: '8px 12px', background: '#D4665A12', border: '1px solid #D4665A40', borderRadius: 6, color: '#D4665A', fontSize: 12 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ marginTop: 6, padding: '12px', borderRadius: 8, border: 'none', cursor: loading ? 'default' : 'pointer', background: loading ? '#1A1D23' : 'linear-gradient(135deg,#C4956A,#A07A55)', color: loading ? '#585653' : '#fff', fontSize: 13, fontWeight: 700 }}>
                {loading ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: '#3A3E47', fontSize: 11 }}>
          DocForge AI · Academic Document Formatting
        </p>
      </div>
    </div>
  );
}
