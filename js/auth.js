/* Sessão: visitante (só leitura), leitor (usuário + senha) e administrador. Tudo autenticado no Supabase. */
const Auth = (() => {
  const KEY = 'acervo_session', C = () => window.CONFIG;
  const session = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = o => localStorage.setItem(KEY, JSON.stringify(o));
  const logout = () => { localStorage.removeItem(KEY); location.replace('login.html'); };
  // o Supabase exige e-mail: montamos um interno a partir do usuário (o leitor nunca vê isso)
  const mail = u => `${u.toLowerCase()}.acervo@${C().READER_DOMAIN || 'gmail.com'}`;
  const post = (path, body) => fetch(`${C().SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST', headers: { apikey: C().SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const keep = (role, d) => save({ role, uid: d.user.id, token: d.access_token, refresh: d.refresh_token, exp: Date.now() + d.expires_in * 1000 });

  async function signIn(role, email, pw) {
    const r = await post('token?grant_type=password', { email, password: pw });
    if (r.status === 400 || r.status === 401) return false;
    if (!r.ok) throw new Error('auth');
    keep(role, await r.json());
    return true;
  }
  const loginAdmin = pw => signIn('admin', C().ADMIN_EMAIL, pw);
  // o Supabase exige senha com 6+ caracteres: completamos a senha de 5 com um sufixo interno.
  // Contas antigas (senha sem sufixo) continuam entrando pela segunda tentativa.
  const padPw = p => p + '#acv';
  const loginReader = async (user, pw) => (await signIn('reader', mail(user), padPw(pw))) || signIn('reader', mail(user), pw);
  async function signup(social, user, pw) {
    const r = await post('signup', { email: mail(user), password: padPw(pw), data: { username: user.toLowerCase(), social_name: social } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const t = JSON.stringify(j).toLowerCase();
      if (t.includes('already') || t.includes('database error')) return 'taken';
      if (t.includes('signup') && t.includes('disabled')) return 'disabled';
      if (t.includes('weak') || t.includes('password')) return 'weak';
      throw new Error('signup');
    }
    if (!j.access_token) return 'confirm';
    keep('reader', j);
    return 'ok';
  }
  const guest = () => save({ role: 'guest', name: 'Visitante' });

  // token válido (renova sozinho quando expira)
  async function token() {
    const s = session();
    if (!s || !s.token) return null;
    if (Date.now() < s.exp - 60000) return s.token;
    const r = await post('token?grant_type=refresh_token', { refresh_token: s.refresh });
    if (!r.ok) { logout(); throw new Error('expired'); }
    const d = await r.json();
    save({ ...s, token: d.access_token, refresh: d.refresh_token, exp: Date.now() + d.expires_in * 1000 });
    return d.access_token;
  }
  return { session, loginAdmin, loginReader, signup, guest, logout, token };
})();
