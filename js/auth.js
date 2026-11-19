/* Sessão: leitor (livre) e administrador (senha verificada por hash SHA-256) */
const Auth = (() => {
  const HASH = 'ade8ca778d2f509556886ba0aa203fb70d9f78748db5cf116b2500f2ef0cad4d', KEY = 'acervo_session';
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const session = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  async function loginAdmin(pw) {
    if (await sha(pw) !== HASH) return false;
    localStorage.setItem(KEY, JSON.stringify({ role: 'admin', name: 'Pedro Henrique' }));
    return true;
  }
  function loginReader(name) {
    localStorage.setItem(KEY, JSON.stringify({ role: 'reader', name: (name || '').trim().slice(0, 30) || 'Visitante' }));
  }
  const logout = () => { localStorage.removeItem(KEY); location.replace('login.html'); };
  return { session, loginAdmin, loginReader, logout };
})();
