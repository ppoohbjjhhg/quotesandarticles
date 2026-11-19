/* Sessão: leitor (livre) e administrador (autenticado no Supabase) */
const Auth = (() => {
  const KEY = 'acervo_session';
  const C = () => window.CONFIG;
  const session = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = o => localStorage.setItem(KEY, JSON.stringify(o));
  const logout = () => { localStorage.removeItem(KEY); location.replace('login.html'); };
  const grant = (type, body) => fetch(`${C().SUPABASE_URL}/auth/v1/token?grant_type=${type}`, {
    method: 'POST', headers: { apikey: C().SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });

  async function loginAdmin(pw) {
    const r = await grant('password', { email: C().ADMIN_EMAIL, password: pw });
    if (r.status === 400 || r.status === 401) return false;   // senha incorreta
    if (!r.ok) throw new Error('auth');
    const d = await r.json();
    save({ role: 'admin', name: 'Pedro Henrique', token: d.access_token, refresh: d.refresh_token, exp: Date.now() + d.expires_in * 1000 });
    return true;
  }
  function loginReader(name) {
    save({ role: 'reader', name: (name || '').trim().slice(0, 30) || 'Visitante' });
  }
  // token válido do administrador (renova sozinho quando expira)
  async function token() {
    const s = session();
    if (!s || s.role !== 'admin' || !s.token) return null;
    if (Date.now() < s.exp - 60000) return s.token;
    const r = await grant('refresh_token', { refresh_token: s.refresh });
    if (!r.ok) { logout(); throw new Error('expired'); }
    const d = await r.json();
    save({ ...s, token: d.access_token, refresh: d.refresh_token, exp: Date.now() + d.expires_in * 1000 });
    return d.access_token;
  }
  return { session, loginAdmin, loginReader, logout, token };
})();
