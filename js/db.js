/* Acesso ao banco e às imagens (Supabase, via fetch) */
const DB = (() => {
  const C = () => window.CONFIG;
  const H = t => t ? { apikey: C().SUPABASE_KEY, Authorization: `Bearer ${t}` } : { apikey: C().SUPABASE_KEY };
  const ok = r => { if (!r.ok) throw new Error(r.status); return r; };

  async function list() {
    const r = ok(await fetch(`${C().SUPABASE_URL}/rest/v1/posts?select=*&order=created_at.desc`, { headers: H() }));
    return r.json();
  }
  async function upload(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    ok(await fetch(`${C().SUPABASE_URL}/storage/v1/object/images/${name}`, {
      method: 'POST', headers: { ...H(await Auth.token()), 'Content-Type': 'image/jpeg' }, body: blob
    }));
    return `${C().SUPABASE_URL}/storage/v1/object/public/images/${name}`;
  }
  async function add(p) {
    const r = ok(await fetch(`${C().SUPABASE_URL}/rest/v1/posts`, {
      method: 'POST', headers: { ...H(await Auth.token()), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(p)
    }));
    return (await r.json())[0];
  }
  async function remove(p) {
    const t = await Auth.token();
    ok(await fetch(`${C().SUPABASE_URL}/rest/v1/posts?id=eq.${encodeURIComponent(p.id)}`, { method: 'DELETE', headers: H(t) }));
    const i = p.img ? p.img.indexOf('/images/') : -1;
    if (i > -1) fetch(`${C().SUPABASE_URL}/storage/v1/object/images/${p.img.slice(i + 8)}`, { method: 'DELETE', headers: H(t) }).catch(() => {});
  }
  return { list, upload, add, remove };
})();
