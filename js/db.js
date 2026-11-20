/* Acesso ao banco e às imagens (Supabase, via fetch) */
const DB = (() => {
  const C = () => window.CONFIG, U = () => C().SUPABASE_URL;
  const H = t => t ? { apikey: C().SUPABASE_KEY, Authorization: `Bearer ${t}` } : { apikey: C().SUPABASE_KEY };
  const ok = r => { if (!r.ok) throw new Error(r.status); return r; };
  const JSONH = { 'Content-Type': 'application/json' };
  const imgs = p => (p.imgs && p.imgs.length) ? p.imgs : (p.img ? [p.img] : []);

  const list = async () => (ok(await fetch(`${U()}/rest/v1/posts?select=*&order=created_at.desc`, { headers: H() }))).json();
  const likes = async () => (ok(await fetch(`${U()}/rest/v1/likes?select=post_id,name&order=created_at.asc`, { headers: H() }))).json();
  async function profile() {
    const r = ok(await fetch(`${U()}/rest/v1/profile?select=avatar&id=eq.1`, { headers: H() }));
    return (await r.json())[0] || {};
  }
  async function upload(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    ok(await fetch(`${U()}/storage/v1/object/images/${name}`, { method: 'POST', headers: { ...H(await Auth.token()), 'Content-Type': 'image/jpeg' }, body: blob }));
    return `${U()}/storage/v1/object/public/images/${name}`;
  }
  async function deleteImage(url) {
    const i = url ? url.indexOf('/images/') : -1;
    if (i < 0) return;
    try { await fetch(`${U()}/storage/v1/object/images/${url.slice(i + 8)}`, { method: 'DELETE', headers: H(await Auth.token()) }); } catch {}
  }
  async function add(p) {
    const r = ok(await fetch(`${U()}/rest/v1/posts`, { method: 'POST', headers: { ...H(await Auth.token()), ...JSONH, Prefer: 'return=representation' }, body: JSON.stringify(p) }));
    return (await r.json())[0];
  }
  async function update(id, body) {
    const r = ok(await fetch(`${U()}/rest/v1/posts?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...H(await Auth.token()), ...JSONH, Prefer: 'return=representation' }, body: JSON.stringify(body) }));
    const row = (await r.json())[0];
    if (!row) throw new Error('sem permissão');
    return row;
  }
  async function remove(p) {
    ok(await fetch(`${U()}/rest/v1/posts?id=eq.${encodeURIComponent(p.id)}`, { method: 'DELETE', headers: H(await Auth.token()) }));
    imgs(p).forEach(deleteImage);
  }
  async function setAvatar(url) {
    ok(await fetch(`${U()}/rest/v1/profile`, { method: 'POST', headers: { ...H(await Auth.token()), ...JSONH, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, avatar: url }) }));
  }
  async function toggleLike(post, name) {
    ok(await fetch(`${U()}/rest/v1/rpc/toggle_like`, { method: 'POST', headers: { ...H(), ...JSONH }, body: JSON.stringify({ p_post: post, p_name: name }) }));
  }
  return { imgs, list, likes, profile, upload, deleteImage, add, update, remove, setAvatar, toggleLike };
})();
