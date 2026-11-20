(() => {
  const S = Auth.session();
  if (!S) { location.replace('login.html'); return; }
  const admin = S.role === 'admin';
  if (admin && !S.token) { Auth.logout(); return; }
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CATS = { quote: { l: 'Quote', i: 'quote' }, nota: { l: 'Nota', i: 'note' }, estudo: { l: 'Estudo', i: 'book' }, artigo: { l: 'Artigo', i: 'file' } };
  const FONTS = { '': 'Padrão', serif: 'Serifa', mono: 'Mono', hand: 'Manuscrita', elegant: 'Elegante' };
  const COLORS = { '': 'Vidro', navy: 'Marinho', blue: 'Azul', sky: 'Céu', sand: 'Areia', mint: 'Menta', rose: 'Rosa', lilac: 'Lilás' };
  const SW = { '': '#ffffff', navy: '#0A1B33', blue: '#2D6CDF', sky: '#DCEAFF', sand: '#F5EBDD', mint: '#DDF3EA', rose: '#FBE3E8', lilac: '#E9E3FB' };
  const NAV = [['all', 'home', 'Início'], ['quote', 'quote', 'Quotes'], ['nota', 'note', 'Notas'], ['estudo', 'book', 'Estudos'], ['artigo', 'file', 'Artigos']];
  const AUTHOR = { name: 'Pedro Henrique', handle: '@henrique' };
  const KS = 'acervo_saved', MAX = 5;

  let posts = [], likes = {}, profile = {}, tab = 'all', cat = 'all', q = '';
  let editing = null, newCat = 'nota', font = '', color = '', imgs = [];
  let saved = []; try { saved = JSON.parse(localStorage.getItem(KS)) || []; } catch {}

  const avatarInner = () => profile.avatar ? `<img src="${esc(profile.avatar)}" alt="">` : esc(AUTHOR.name[0]);
  const paintAvatars = () => { if (admin) { $('#meAv').innerHTML = avatarInner(); $('#cAv').innerHTML = avatarInner(); } };

  // estrutura fixa
  $('#links').innerHTML = NAV.map(([k, i, l]) => `<button class="nav-link${k === 'all' ? ' on' : ''}" data-cat="${k}">${UI.icon(i)}<span>${l}</span></button>`).join('');
  $('#logout').innerHTML = UI.icon('out'); $('#logout').onclick = Auth.logout;
  $('#sIcon').innerHTML = UI.icon('search', 18);
  $('#meName').textContent = S.name; $('#meRole').textContent = admin ? 'Administrador' : 'Leitor';
  $('#meAv').textContent = S.name[0].toUpperCase();

  $('#links').addEventListener('click', e => {
    const b = e.target.closest('.nav-link'); if (!b) return;
    cat = b.dataset.cat;
    document.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('on', x === b));
    $('#title').textContent = b.querySelector('span').textContent;
    render();
  });
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  $('#search').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });

  const fmt = d => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

  // ---- curtidas
  const likeBar = p => {
    const n = likes[p.id] || [], on = n.includes(S.name);
    return `<button class="icon-btn like${on ? ' on' : ''}" data-act="like" aria-label="Curtir">${UI.icon('heart', 18)}</button><span class="like-n">${n.length || ''}</span>`;
  };
  function refreshLike(el, p) {
    el.querySelector('.lk').innerHTML = likeBar(p);
    const L = el.querySelector('.likers'), n = likes[p.id] || [];
    if (L) { L.hidden = !n.length; L.textContent = n.length ? 'Curtido por ' + n.join(', ') : ''; }
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
      <div class="avatar">${avatarInner()}</div>
      <div class="p-body">
        <div class="p-top"><b>${esc(AUTHOR.name)}</b><span>${AUTHOR.handle} · ${fmt(p.created_at)}${p.updated_at ? ' · editado' : ''}</span><span class="tag">${UI.icon(C.i, 13)}${C.l}</span></div>
        ${p.title ? `<h2 class="p-title${fk}">${esc(p.title)}</h2>` : ''}
        ${p.text ? `<p class="p-text${fk}">${esc(p.text)}</p>` : ''}
        ${carousel(DB.imgs(p))}
        <div class="acts">
          <span class="lk"></span>
          <button class="icon-btn${saved.includes(p.id) ? ' on' : ''}" data-act="save" aria-label="Salvar">${UI.icon('save', 18)}</button>
          <button class="icon-btn" data-act="copy" aria-label="Copiar texto">${UI.icon('copy', 18)}</button>
          ${admin ? `<button class="icon-btn" data-act="edit" aria-label="Editar">${UI.icon('edit', 18)}</button><button class="icon-btn" data-act="del" aria-label="Excluir">${UI.icon('trash', 18)}</button>` : ''}
        </div>
        ${admin ? '<p class="likers" hidden></p>' : ''}
      </div>`;
    refreshLike(el, p);
    return el;
  }

  function render() {
    const list = posts
      .filter(p => (cat === 'all' || p.cat === cat) && (tab === 'all' || (tab === 'img' ? DB.imgs(p).length : !DB.imgs(p).length)) && (!q || `${p.title} ${p.text}`.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const feed = $('#feed'); feed.innerHTML = '';
    if (!list.length) { feed.innerHTML = '<p class="empty">Nada por aqui ainda.</p>'; return; }
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
    if (act === 'save') {
      saved = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
      localStorage.setItem(KS, JSON.stringify(saved)); b.classList.toggle('on');
    } else if (act === 'copy') {
      navigator.clipboard?.writeText(`${p.title ? p.title + '\n' : ''}${p.text}`).then(() => UI.toast('Copiado'));
    } else if (act === 'like') {
      let name = S.name;
      if (name === 'Visitante') {
        name = (prompt('Seu nome para curtir:') || '').trim().slice(0, 30); if (!name) return;
        Auth.rename(name); S.name = name; $('#meName').textContent = name; if (!admin) $('#meAv').textContent = name[0].toUpperCase();
      }
      const arr = likes[id] || (likes[id] = []), i = arr.indexOf(name);
      i > -1 ? arr.splice(i, 1) : arr.push(name);
      refreshLike(el, p);
      try { await DB.toggleLike(id, name); }
      catch { i > -1 ? arr.push(name) : arr.splice(arr.indexOf(name), 1); refreshLike(el, p); UI.toast('Não foi possível curtir agora.'); }
    } else if (act === 'edit' && admin) {
      startEdit(p);
    } else if (act === 'del' && admin && confirm('Excluir esta publicação para todos?')) {
      try { await DB.remove(p); posts = posts.filter(x => x.id !== id); render(); UI.toast('Excluído'); }
      catch { UI.toast('Não foi possível excluir. Entre de novo como administrador.'); }
    }
  });

  // ---- administrador
  if (admin) {
    $('#composer').hidden = false; $('#profileCard').hidden = false;
    $('#attach').innerHTML = UI.icon('image');
    $('#cfont').innerHTML = Object.entries(FONTS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
    $('#swatches').innerHTML = Object.entries(COLORS).map(([k, l]) => `<button type="button" class="sw" data-c="${k}" title="${l}" aria-label="${l}" style="background:${SW[k]}"></button>`).join('');
    paintAvatars();

    const buildCats = () => $('#cats').innerHTML = Object.entries(CATS).map(([k, c]) => `<button type="button" class="chip${k === newCat ? ' on' : ''}" data-k="${k}">${UI.icon(c.i, 13)}${c.l}</button>`).join('');
    const applyStyle = () => {
      $('#draft').className = 'draft' + (color ? ` has-pc pc-${color}` : '');
      $('#ctext').className = 'plain' + (font ? ' f-' + font : ''); $('#ctitle').className = 'plain' + (font ? ' f-' + font : '');
      $('#cfont').value = font;
      document.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.c === color));
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
      } catch { UI.toast('Erro ao salvar. Confira o SQL da v2 e entre de novo como administrador.'); }
      finally { btn.textContent = editing ? 'Salvar alterações' : 'Publicar'; sync(); }
    };

    $('#pfile').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const url = await DB.upload(await shrink(f, 320, true)), old = profile.avatar;
        await DB.setAvatar(url); profile.avatar = url; if (old) DB.deleteImage(old);
        paintAvatars(); render(); UI.toast('Foto de perfil atualizada');
      } catch { UI.toast('Não foi possível trocar a foto. Confira o SQL da v2.'); }
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
      const [ps, ls, pr] = await Promise.all([DB.list(), DB.likes().catch(() => []), DB.profile().catch(() => ({}))]);
      posts = ps; profile = pr || {};
      ls.forEach(l => (likes[l.post_id] = likes[l.post_id] || []).push(l.name));
      paintAvatars(); render();
    } catch { $('#feed').innerHTML = '<p class="empty">Não foi possível carregar as publicações.</p>'; }
  })();
})();
