/* Acesso ao banco e às imagens (Supabase, via fetch) */
const DB = (() => {
  const C = () => window.CONFIG;
  async function req(path, { method = 'GET', body, auth = false, prefer, ct } = {}) {
    const h = { apikey: C().SUPABASE_KEY };
    if (auth) { const t = await Auth.token(); if (t) h.Authorization = `Bearer ${t}`; }
    if (ct) h['Content-Type'] = ct; else if (body !== undefined) h['Content-Type'] = 'application/json';
    if (prefer) h.Prefer = prefer;
    const r = await fetch(C().SUPABASE_URL + path, { method, headers: h, body: ct ? body : body !== undefined ? JSON.stringify(body) : undefined });
    if (!r.ok) { const e = new Error(r.status); e.body = await r.text().catch(() => ''); throw e; }
    return r;
  }
  const json = async (path, o) => (await req(path, o)).json();
  const one = async (path, o) => (await json(path, o))[0];
  const q = encodeURIComponent;
  const imgs = p => (p.imgs && p.imgs.length) ? p.imgs : (p.img ? [p.img] : []);

  // leitura pública
  const list = () => json('/rest/v1/posts?select=*&order=created_at.desc');
  const likes = () => json('/rest/v1/likes?select=post_id,user_id&order=created_at.asc');
  const comments = () => json('/rest/v1/comments?select=*&order=created_at.asc');
  const cards = () => json('/rest/v1/profile_cards?select=*');
  const profile = async () => (await one('/rest/v1/profile?select=avatar,admin_id&id=eq.1')) || {};
  // dados da própria conta
  const myProfile = uid => one(`/rest/v1/profiles?select=*&id=eq.${q(uid)}`, { auth: true });
  const saveProfile = (uid, patch) => one(`/rest/v1/profiles?id=eq.${q(uid)}`, { method: 'PATCH', body: patch, auth: true, prefer: 'return=representation' });
  const saves = () => json('/rest/v1/saves?select=post_id', { auth: true });
  const save = post => req('/rest/v1/saves', { method: 'POST', body: { post_id: post }, auth: true });
  const unsave = post => req(`/rest/v1/saves?post_id=eq.${q(post)}`, { method: 'DELETE', auth: true });
  const like = post => req('/rest/v1/likes', { method: 'POST', body: { post_id: post }, auth: true });
  const unlike = (post, uid) => req(`/rest/v1/likes?post_id=eq.${q(post)}&user_id=eq.${q(uid)}`, { method: 'DELETE', auth: true });
  const addComment = (post, text) => one('/rest/v1/comments', { method: 'POST', body: { post_id: post, text }, auth: true, prefer: 'return=representation' });
  const delComment = id => req(`/rest/v1/comments?id=eq.${q(id)}`, { method: 'DELETE', auth: true });

  // imagens (admin na raiz; leitores só na própria pasta, para a foto de perfil)
  async function upload(dataUrl, folder = '') {
    const blob = await (await fetch(dataUrl)).blob();
    const name = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    await req(`/storage/v1/object/images/${name}`, { method: 'POST', body: blob, auth: true, ct: 'image/jpeg' });
    return `${C().SUPABASE_URL}/storage/v1/object/public/images/${name}`;
  }
  async function deleteImage(url) {
    const i = url ? url.indexOf('/images/') : -1;
    if (i < 0) return;
    try { await req(`/storage/v1/object/images/${url.slice(i + 8)}`, { method: 'DELETE', auth: true }); } catch {}
  }

  // posts (admin)
  const add = p => one('/rest/v1/posts', { method: 'POST', body: p, auth: true, prefer: 'return=representation' });
  async function update(id, body) {
    const row = await one(`/rest/v1/posts?id=eq.${q(id)}`, { method: 'PATCH', body, auth: true, prefer: 'return=representation' });
    if (!row) throw new Error('sem permissão');
    return row;
  }
  async function remove(p) { await req(`/rest/v1/posts?id=eq.${q(p.id)}`, { method: 'DELETE', auth: true }); imgs(p).forEach(deleteImage); }
  const setAvatar = url => req('/rest/v1/profile', { method: 'POST', body: { id: 1, avatar: url }, auth: true, prefer: 'resolution=merge-duplicates,return=minimal' });

  return { imgs, list, likes, comments, cards, profile, myProfile, saveProfile, saves, save, unsave, like, unlike, addComment, delComment, upload, deleteImage, add, update, remove, setAvatar };
})();
