(() => {
  const S = Auth.session();
  if (!S) { location.replace('login.html'); return; }
  const admin = S.role === 'admin', reader = S.role === 'reader', logged = admin || reader, uid = S.uid;
  if (logged && !S.token) { Auth.logout(); return; }
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CATS = { quote: { l: 'Quote', i: 'quote' }, nota: { l: 'Nota', i: 'note' }, estudo: { l: 'Estudo', i: 'book' }, artigo: { l: 'Artigo', i: 'file' } };
  const FONTS = { '': 'Padrão', serif: 'Serifa', mono: 'Mono', hand: 'Manuscrita', elegant: 'Elegante' };
  const COLORS = { '': 'Vidro', navy: 'Marinho', blue: 'Azul', sky: 'Céu', sand: 'Areia', mint: 'Menta', rose: 'Rosa', lilac: 'Lilás' };
  const SW = { '': '#ffffff', navy: '#0A1B33', blue: '#2D6CDF', sky: '#DCEAFF', sand: '#F5EBDD', mint: '#DDF3EA', rose: '#FBE3E8', lilac: '#E9E3FB' };
  const THEMES = { blue: '#2D6CDF', navy: '#0A1B33', violet: '#7C4DFF', teal: '#0E9F8E', amber: '#D98E04', rose: '#E0245E', graphite: '#4B5563' };
  // 15 temas, na ordem da lista de categorias do Substack (edite à vontade)
  const TOPICS = ['Cultura', 'Tecnologia', 'Negócios', 'Política', 'Finanças', 'Gastronomia', 'Esportes', 'Arte e Ilustração', 'Saúde', 'Notícias', 'Moda e Beleza', 'Música', 'Fé e Espiritualidade', 'Meio Ambiente', 'Literatura'];
  const NAV = [['all', 'home', 'Início'], ['quote', 'quote', 'Quotes'], ['nota', 'note', 'Notas'], ['estudo', 'book', 'Estudos'], ['artigo', 'file', 'Artigos']];
  if (logged) NAV.push(['saved', 'save', 'Salvos']);
  if (reader) NAV.push(['profile', 'user', 'Perfil']);
  const AUTHOR = { name: 'Pedro Henrique', handle: '@henrique' }, MAX = 5;

  let posts = [], likes = {}, comments = {}, cards = {}, saves = new Set(), profile = {}, me = null;
  let view = 'feed', tab = 'all', cat = 'all', q = '';
  let editing = null, newCat = 'nota', font = '', color = '', imgs = [];

  // ---- identidade (nome social > nome)
  const dn = m => (m && (m.social_name || m.name)) || 'Leitor';
  const who = u => cards[u] || { display_name: 'Leitor', avatar: null, theme: 'blue' };
  const initial = n => esc(((n || '?').trim()[0] || '?').toUpperCase());
  const av = (c, size = 'm') => `<span class="av ${size}" style="--tc:${THEMES[c.theme] || THEMES.blue}">${c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : initial(c.display_name)}</span>`;
  const myCard = () => admin ? { display_name: AUTHOR.name, avatar: profile.avatar, theme: 'navy' } : me ? { display_name: dn(me), avatar: me.avatar, theme: me.theme } : { display_name: S.name || 'Visitante' };
  const authorInner = () => profile.avatar ? `<img src="${esc(profile.avatar)}" alt="">` : esc(AUTHOR.name[0]);
  function paintMe() {
    const c = myCard();
    $('#meName').textContent = c.display_name;
    $('#meRole').textContent = admin ? 'Administrador' : reader ? 'Leitor' : 'Sem conta';
    $('#meAv').innerHTML = c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : initial(c.display_name);
    if (admin) $('#cAv').innerHTML = authorInner();
  }
  const needAccount = () => { if (logged) return false; if (confirm('Entre ou crie uma conta para interagir. Ir para o login?')) Auth.logout(); return true; };

  // ---- estrutura fixa
  $('#links').innerHTML = NAV.map(([k, i, l]) => `<button class="nav-link${k === 'all' ? ' on' : ''}" data-cat="${k}">${UI.icon(i)}<span>${l}</span></button>`).join('');
  $('#logout').innerHTML = UI.icon('out'); $('#logout').onclick = Auth.logout;
  $('#sIcon').innerHTML = UI.icon('search', 18);
  paintMe();

  function showView(v) {
    view = v;
    $('#profileView').hidden = v !== 'profile'; $('#tabs').hidden = v === 'profile';
    $('#feed').style.display = v === 'profile' ? 'none' : 'grid';
    if (admin) $('#composer').hidden = v === 'profile';
  }
  $('#links').addEventListener('click', e => {
    const b = e.target.closest('.nav-link'); if (!b) return;
    cat = b.dataset.cat;
    document.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('on', x === b));
    $('#title').textContent = cat === 'profile' ? 'Meu perfil' : b.querySelector('span').textContent;
    if (cat === 'profile') { showView('profile'); buildProfile(); } else { showView('feed'); render(); }
  });
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  $('#search').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); if (view === 'feed') render(); });

  const fmt = d => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
  const fmtT = d => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

  // ---- curtidas (com foto ao lado do nome)
  const likeBar = p => {
    const n = likes[p.id] || [], on = n.includes(uid);
    return `<button class="icon-btn like${on ? ' on' : ''}" data-act="like" aria-label="Curtir">${UI.icon('heart', 18)}</button><span class="like-n">${n.length || ''}</span>`;
  };
  function refreshLike(el, p) {
    el.querySelector('.lk').innerHTML = likeBar(p);
    const ids = likes[p.id] || [], L = el.querySelector('.likers');
    L.hidden = !ids.length;
    L.innerHTML = ids.length ? 'Curtido por ' + ids.slice(0, 6).map(u => { const c = who(u); return `<span class="lk-u">${av(c, 's')}${esc(c.display_name)}</span>`; }).join('') + (ids.length > 6 ? `<span class="more">+${ids.length - 6}</span>` : '') : '';
  }

  // ---- comentários
  function renderComments(el, id) {
    const list = comments[id] || [];
    el.querySelector('.cn').textContent = list.length || '';
    el.querySelector('.cmt-list').innerHTML = list.map(c => {
      const w = who(c.user_id), can = admin || c.user_id === uid;
      return `<div class="cmt" data-cid="${esc(c.id)}">${av(w, 'm')}<div class="cmt-b"><b>${esc(w.display_name)}</b><small>${fmtT(c.created_at)}</small>${can ? `<button class="icon-btn" data-act="delc" aria-label="Apagar comentário">${UI.icon('trash', 14)}</button>` : ''}<p>${esc(c.text)}</p></div></div>`;
    }).join('');
  }

  // ---- carrossel
  function carousel(list) {
    if (!list.length) return '';
    if (list.length === 1) return `<img class="p-img" src="${esc(list[0])}" alt="" loading="lazy">`;
    return `<div class="carousel"><div class="car-track">${list.map(u => `<img src="${esc(u)}" alt="" draggable="false">`).join('')}</div>
      <span class="car-count">1/${list.length}</span>
      <button type="button" class="car-btn car-prev" data-dir="-1" aria-label="Anterior">${UI.icon('chl', 18)}</button>
      <button type="button" class="car-btn car-next" data-dir="1" aria-label="Próxima">${UI.icon('chr', 18)}</button>
      <div class="dots">${list.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div></div>`;
  }
  function carState(t) {
    const w = t.clientWidth || 1, i = Math.round(t.scrollLeft / w), n = t.children.length, c = t.parentElement;
    c.querySelector('.car-count').textContent = `${i + 1}/${n}`;
    c.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    c.querySelector('.car-prev').disabled = i === 0;
    c.querySelector('.car-next').disabled = i === n - 1;
  }
  $('#feed').addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('car-track')) carState(e.target); }, true);

  function card(p) {
    const C = CATS[p.cat] || CATS.nota, fk = p.font && FONTS[p.font] ? ' f-' + p.font : '', ck = p.color && COLORS[p.color] ? ' has-pc pc-' + p.color : '';
    const el = document.createElement('article');
    el.className = 'post glass reveal' + ck; el.dataset.cat = p.cat; el.dataset.id = p.id;
    el.innerHTML = `
      <div class="avatar">${authorInner()}</div>
      <div class="p-body">
        <div class="p-top"><b>${esc(AUTHOR.name)}</b><span>${AUTHOR.handle} · ${fmt(p.created_at)}${p.updated_at ? ' · editado' : ''}</span><span class="tag">${UI.icon(C.i, 13)}${C.l}</span></div>
        ${p.title ? `<h2 class="p-title${fk}">${esc(p.title)}</h2>` : ''}
        ${p.text ? `<p class="p-text${fk}">${esc(p.text)}</p>` : ''}
        ${carousel(DB.imgs(p))}
        <div class="acts">
          <span class="lk"></span>
          <button class="icon-btn" data-act="comments" aria-label="Comentários">${UI.icon('chat', 18)}</button><span class="like-n cn"></span>
          <button class="icon-btn${saves.has(p.id) ? ' on' : ''}" data-act="save" aria-label="Salvar">${UI.icon('save', 18)}</button>
          <button class="icon-btn" data-act="copy" aria-label="Copiar texto">${UI.icon('copy', 18)}</button>
          ${admin ? `<button class="icon-btn" data-act="edit" aria-label="Editar">${UI.icon('edit', 18)}</button><button class="icon-btn" data-act="del" aria-label="Excluir">${UI.icon('trash', 18)}</button>` : ''}
        </div>
        <p class="likers" hidden></p>
        <div class="cmts" hidden>
          <div class="cmt-list"></div>
          ${logged ? '<form class="cmt-form"><input class="input" maxlength="500" placeholder="Escreva um comentário…" required><button class="btn btn-primary" type="submit">Enviar</button></form>' : '<p class="cmt-hint">Entre ou crie uma conta para comentar.</p>'}
        </div>
      </div>`;
    refreshLike(el, p); renderComments(el, p.id);
    return el;
  }

  function render() {
    if (view !== 'feed') return;
    const list = posts
      .filter(p => (cat === 'all' || (cat === 'saved' ? saves.has(p.id) : p.cat === cat)) && (tab === 'all' || (tab === 'img' ? DB.imgs(p).length : !DB.imgs(p).length)) && (!q || `${p.title} ${p.text}`.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const feed = $('#feed'); feed.innerHTML = '';
    if (!list.length) { feed.innerHTML = `<p class="empty">${cat === 'saved' ? 'Você ainda não salvou nenhum post.' : 'Nada por aqui ainda.'}</p>`; return; }
    const wrap = document.createDocumentFragment();
    list.forEach(p => wrap.append(card(p)));
    feed.append(wrap);
    feed.querySelectorAll('.post').forEach((c, i) => { c.style.transitionDelay = `${Math.min(i, 4) * 40}ms`; UI.reveal(c); });
    feed.querySelectorAll('.car-track').forEach(carState);
    feed.style.display = 'grid'; feed.style.gap = '1rem';
  }

  $('#feed').addEventListener('click', async e => {
    const d = e.target.closest('[data-dir]');
    if (d) { const t = d.parentElement.querySelector('.car-track'); t.scrollBy({ left: +d.dataset.dir * t.clientWidth, behavior: 'smooth' }); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const el = b.closest('.post'), id = el.dataset.id, p = posts.find(x => x.id === id), act = b.dataset.act;
    if (act === 'copy') {
      navigator.clipboard?.writeText(`${p.title ? p.title + '\n' : ''}${p.text}`).then(() => UI.toast('Copiado'));
    } else if (act === 'comments') {
      el.querySelector('.cmts').hidden = !el.querySelector('.cmts').hidden;
    } else if (act === 'like') {
      if (needAccount()) return;
      const arr = likes[id] || (likes[id] = []), i = arr.indexOf(uid);
      i > -1 ? arr.splice(i, 1) : arr.push(uid);
      refreshLike(el, p);
      try { i > -1 ? await DB.unlike(id, uid) : await DB.like(id); }
      catch { i > -1 ? arr.push(uid) : arr.splice(arr.indexOf(uid), 1); refreshLike(el, p); UI.toast('Não foi possível curtir agora.'); }
    } else if (act === 'save') {
      if (needAccount()) return;
      const had = saves.has(id); had ? saves.delete(id) : saves.add(id); b.classList.toggle('on', !had);
      try { had ? await DB.unsave(id) : await DB.save(id); if (cat === 'saved') render(); }
      catch { had ? saves.add(id) : saves.delete(id); b.classList.toggle('on', had); UI.toast('Não foi possível salvar agora.'); }
    } else if (act === 'delc') {
      const cid = b.closest('.cmt').dataset.cid;
      if (!confirm('Apagar este comentário?')) return;
      try { await DB.delComment(cid); comments[id] = (comments[id] || []).filter(c => c.id !== cid); renderComments(el, id); }
      catch { UI.toast('Não foi possível apagar.'); }
    } else if (act === 'edit' && admin) {
      startEdit(p);
    } else if (act === 'del' && admin && confirm('Excluir esta publicação para todos?')) {
      try { await DB.remove(p); posts = posts.filter(x => x.id !== id); render(); UI.toast('Excluído'); }
      catch { UI.toast('Não foi possível excluir. Entre de novo como administrador.'); }
    }
  });
  $('#feed').addEventListener('submit', async e => {
    const f = e.target.closest('.cmt-form'); if (!f) return;
    e.preventDefault();
    const el = f.closest('.post'), id = el.dataset.id, inp = f.querySelector('input'), btn = f.querySelector('button'), text = inp.value.trim();
    if (!text) return;
    btn.disabled = true;
    try { (comments[id] = comments[id] || []).push(await DB.addComment(id, text)); inp.value = ''; renderComments(el, id); }
    catch { UI.toast('Não foi possível comentar agora.'); }
    finally { btn.disabled = false; }
  });

  // ---- perfil do leitor
  function buildProfile() {
    const v = $('#profileView');
    if (!reader || !me) { v.innerHTML = '<p class="empty">Perfil indisponível. Confira se o SQL v3 foi executado.</p>'; return; }
    const pf = { theme: me.theme in THEMES ? me.theme : 'blue', topics: new Set(me.interests || []) };
    const net = /^https:\/\/(www\.)?(x|twitter)\.com\//i.test(me.social || '') ? 'x' : 'instagram';
    const handle = (me.social || '').split('/').filter(Boolean).pop() || '';
    const nameLocked = me.name_changes >= 1;
    v.style.setProperty('--tc', THEMES[pf.theme]);
    v.innerHTML = `
      <div class="pf-banner"></div>
      <div class="pf-top">
        <label class="pf-av" for="avfile" title="Trocar foto">${av(myCard(), 'l')}<span class="cam">${UI.icon('image', 16)}</span></label>
        <input id="avfile" type="file" accept="image/*" hidden>
        <div><h2>${esc(dn(me))}</h2><p class="muted">@${esc(me.username)}</p>${me.bio ? `<p class="pf-bio">${esc(me.bio)}</p>` : ''}</div>
      </div>
      <form id="pfForm" class="pf-form">
        <label>Nome<input class="input" id="fName" maxlength="30" value="${esc(me.name)}" ${nameLocked ? 'disabled' : ''}><small>${nameLocked ? 'Você já usou a alteração de nome.' : 'Você pode alterar o nome apenas mais 1 vez.'}</small></label>
        <label>Nome social<input class="input" id="fSocialName" maxlength="30" value="${esc(me.social_name || '')}" placeholder="Opcional"><small>Se preenchido, aparece no lugar do nome nos comentários, curtidas e perfil.</small></label>
        <label>Idade<input class="input" id="fAge" type="number" min="5" max="120" value="${me.age ?? ''}"></label>
        <label>Bio<input class="input" id="fBio" maxlength="25" value="${esc(me.bio || '')}" placeholder="Até 25 caracteres"><small id="bioN">${(me.bio || '').length}/25</small></label>
        <label>Rede social<span class="row"><select class="sel-i" id="fNet"><option value="instagram"${net === 'instagram' ? ' selected' : ''}>Instagram</option><option value="x"${net === 'x' ? ' selected' : ''}>X</option></select><input class="input" id="fHandle" maxlength="31" value="${esc(handle)}" placeholder="@usuario"></span></label>
        <div class="lbl">Tema do perfil<div class="swatches" id="fTheme">${Object.entries(THEMES).map(([k, c]) => `<button type="button" class="sw${k === pf.theme ? ' on' : ''}" data-t="${k}" title="${k}" aria-label="${k}" style="background:${c}"></button>`).join('')}</div></div>
        <div class="lbl">Interesses de leitura <small id="intN">${pf.topics.size}/15</small><div class="topics" id="fTopics">${TOPICS.map(t => `<button type="button" class="topic${pf.topics.has(t) ? ' on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
        <button class="btn btn-primary" type="submit">Salvar perfil</button>
      </form>`;
    const val = id => v.querySelector(id).value.trim();
    v.querySelector('#fBio').addEventListener('input', e => { v.querySelector('#bioN').textContent = `${e.target.value.length}/25`; });
    v.querySelector('#fTheme').addEventListener('click', e => {
      const s = e.target.closest('.sw'); if (!s) return;
      pf.theme = s.dataset.t; v.style.setProperty('--tc', THEMES[pf.theme]);
      v.querySelectorAll('#fTheme .sw').forEach(x => x.classList.toggle('on', x === s));
    });
    v.querySelector('#fTopics').addEventListener('click', e => {
      const t = e.target.closest('.topic'); if (!t) return;
      pf.topics.has(t.dataset.t) ? pf.topics.delete(t.dataset.t) : pf.topics.add(t.dataset.t);
      t.classList.toggle('on'); v.querySelector('#intN').textContent = `${pf.topics.size}/15`;
    });
    v.querySelector('#avfile').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const url = await DB.upload(await shrink(f, 256, true), uid), old = me.avatar;
        me = await DB.saveProfile(uid, { avatar: url }); if (old) DB.deleteImage(old);
        cards[uid] = { id: uid, display_name: dn(me), avatar: me.avatar, theme: me.theme };
        paintMe(); buildProfile(); UI.toast('Foto atualizada');
      } catch { UI.toast('Não foi possível trocar a foto. Confira o SQL v3.'); }
    });
    v.querySelector('#pfForm').addEventListener('submit', async e => {
      e.preventDefault();
      const h = val('#fHandle').replace(/^@/, '').replace(/[^A-Za-z0-9_.]/g, '').slice(0, 30);
      const patch = {
        social_name: val('#fSocialName') || null, age: val('#fAge') ? +val('#fAge') : null, bio: val('#fBio') || null,
        theme: pf.theme, interests: [...pf.topics],
        social: h ? (v.querySelector('#fNet').value === 'x' ? `https://x.com/${h}` : `https://instagram.com/${h}`) : null
      };
      const nm = val('#fName');
      if (!nameLocked && nm && nm !== me.name) {
        if (nm.length < 5 || !/^[A-Za-zÀ-ÿ0-9]+$/.test(nm)) return UI.toast('Nome: mínimo 5 caracteres, só letras e números, sem espaços.');
        if (!confirm('Atenção: você só pode alterar o nome mais uma vez. Continuar?')) return;
        patch.name = nm;
      }
      try {
        me = await DB.saveProfile(uid, patch);
        cards[uid] = { id: uid, display_name: dn(me), avatar: me.avatar, theme: me.theme };
        paintMe(); buildProfile(); UI.toast('Perfil salvo');
      } catch (err) { UI.toast(/nome/i.test(err.body || '') ? 'O nome já foi alterado uma vez.' : 'Não foi possível salvar. Confira os campos.'); }
    });
  }

  // ---- administrador
  if (admin) {
    $('#composer').hidden = false; $('#profileCard').hidden = false;
    $('#attach').innerHTML = UI.icon('image');
    $('#cfont').innerHTML = Object.entries(FONTS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
    $('#swatches').innerHTML = Object.entries(COLORS).map(([k, l]) => `<button type="button" class="sw" data-c="${k}" title="${l}" aria-label="${l}" style="background:${SW[k]}"></button>`).join('');

    const buildCats = () => $('#cats').innerHTML = Object.entries(CATS).map(([k, c]) => `<button type="button" class="chip${k === newCat ? ' on' : ''}" data-k="${k}">${UI.icon(c.i, 13)}${c.l}</button>`).join('');
    const applyStyle = () => {
      $('#draft').className = 'draft' + (color ? ` has-pc pc-${color}` : '');
      $('#ctext').className = 'plain' + (font ? ' f-' + font : ''); $('#ctitle').className = 'plain' + (font ? ' f-' + font : '');
      $('#cfont').value = font;
      document.querySelectorAll('#swatches .sw').forEach(s => s.classList.toggle('on', s.dataset.c === color));
    };
    const renderThumbs = () => {
      const t = $('#thumbs'); t.hidden = !imgs.length;
      t.innerHTML = imgs.map((s, i) => `<div class="th"><img src="${esc(s)}" alt=""><button type="button" class="icon-btn" data-rm="${i}" aria-label="Remover foto">${UI.icon('x', 14)}</button></div>`).join('');
      $('#imgCount').textContent = imgs.length ? `${imgs.length}/${MAX}` : '';
    };
    const sync = () => {
      $('#ctitle').hidden = !['estudo', 'artigo'].includes(newCat);
      $('#publish').disabled = !($('#ctext').value.trim() || imgs.length);
    };
    const clearForm = () => { $('#ctext').value = ''; $('#ctitle').value = ''; imgs = []; renderThumbs(); sync(); };
    function startEdit(p) {
      editing = p; newCat = p.cat; font = p.font || ''; color = p.color || ''; imgs = [...DB.imgs(p)];
      $('#ctext').value = p.text || ''; $('#ctitle').value = p.title || '';
      buildCats(); applyStyle(); renderThumbs(); sync();
      $('#editFlag').hidden = false; $('#publish').textContent = 'Salvar alterações';
      $('#composer').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#ctext').focus();
    }
    function stopEdit() {
      editing = null; font = ''; color = ''; clearForm(); applyStyle();
      $('#editFlag').hidden = true; $('#publish').textContent = 'Publicar';
    }
    window.startEdit = startEdit;

    $('#cats').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; newCat = c.dataset.k; buildCats(); sync(); });
    $('#cfont').addEventListener('change', e => { font = e.target.value; applyStyle(); });
    $('#swatches').addEventListener('click', e => { const s = e.target.closest('.sw'); if (!s) return; color = s.dataset.c; applyStyle(); });
    $('#ctext').addEventListener('input', sync);
    $('#cancelEdit').onclick = stopEdit;
    $('#thumbs').addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (!r) return; imgs.splice(+r.dataset.rm, 1); renderThumbs(); sync(); });
    $('#cfile').addEventListener('change', async e => {
      const files = [...e.target.files]; e.target.value = '';
      if (files.length > MAX - imgs.length) UI.toast(`Máximo de ${MAX} fotos por post`);
      for (const f of files.slice(0, MAX - imgs.length)) { try { imgs.push(await shrink(f, 1400)); } catch {} }
      renderThumbs(); sync();
    });

    $('#publish').onclick = async () => {
      const btn = $('#publish'); btn.disabled = true; btn.textContent = editing ? 'Salvando…' : 'Publicando…';
      try {
        const urls = [];
        for (const s of imgs) urls.push(s.startsWith('data:') ? await DB.upload(s) : s);
        const body = { cat: newCat, title: $('#ctitle').hidden ? '' : $('#ctitle').value.trim(), text: $('#ctext').value.trim(), font, color, imgs: urls, img: null };
        if (editing) {
          body.updated_at = new Date().toISOString();
          const u = await DB.update(editing.id, body);
          DB.imgs(editing).filter(x => !urls.includes(x)).forEach(DB.deleteImage);
          posts = posts.map(x => x.id === u.id ? u : x);
          stopEdit(); render(); UI.toast('Alterações salvas');
        } else {
          posts.unshift(await DB.add(body)); clearForm(); render(); UI.toast('Publicado para todos');
        }
      } catch { UI.toast('Erro ao salvar. Entre de novo como administrador.'); }
      finally { btn.textContent = editing ? 'Salvar alterações' : 'Publicar'; sync(); }
    };

    $('#pfile').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const url = await DB.upload(await shrink(f, 320, true)), old = profile.avatar;
        await DB.setAvatar(url); profile.avatar = url; if (old) DB.deleteImage(old);
        if (profile.admin_id && cards[profile.admin_id]) cards[profile.admin_id].avatar = url;
        paintMe(); render(); UI.toast('Foto de perfil atualizada');
      } catch { UI.toast('Não foi possível trocar a foto.'); }
    });

    buildCats(); applyStyle(); sync();
  }

  // reduz a imagem (e recorta em quadrado quando square=true)
  function shrink(file, max, square) {
    return new Promise((res, rej) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => {
        const c = document.createElement('canvas'), g = c.getContext('2d');
        if (square) {
          const m = Math.min(img.width, img.height); c.width = c.height = Math.min(max, m);
          g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, c.width, c.height);
        } else {
          const k = Math.min(1, max / Math.max(img.width, img.height)); c.width = img.width * k; c.height = img.height * k;
          g.drawImage(img, 0, 0, c.width, c.height);
        }
        URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .82));
      };
      img.onerror = rej; img.src = u;
    });
  }

  (async () => {
    $('#feed').innerHTML = '<p class="empty">Carregando…</p>';
    try {
      const [ps, ls, cs, cd, pr] = await Promise.all([DB.list(), DB.likes().catch(() => []), DB.comments().catch(() => []), DB.cards().catch(() => []), DB.profile().catch(() => ({}))]);
      posts = ps; profile = pr || {};
      ls.forEach(l => (likes[l.post_id] = likes[l.post_id] || []).push(l.user_id));
      cs.forEach(c => (comments[c.post_id] = comments[c.post_id] || []).push(c));
      cd.forEach(c => { cards[c.id] = c; });
      if (logged) {
        const [sv, mp] = await Promise.all([DB.saves().catch(() => []), reader ? DB.myProfile(uid).catch(() => null) : null]);
        sv.forEach(s => saves.add(s.post_id)); me = mp || null;
      }
      paintMe(); render();
    } catch { $('#feed').innerHTML = '<p class="empty">Não foi possível carregar as publicações.</p>'; }
  })();
})();
