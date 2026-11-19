(() => {
  const S = Auth.session();
  if (!S) { location.replace('login.html'); return; }
  const admin = S.role === 'admin';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CATS = { quote: 'Quote', nota: 'Nota', estudo: 'Estudo', artigo: 'Artigo' };
  const NAV = [['all', 'home', 'Início'], ['quote', 'quote', 'Quotes'], ['nota', 'note', 'Notas'], ['estudo', 'book', 'Estudos'], ['artigo', 'file', 'Artigos']];
  const AUTHOR = { name: 'Pedro Henrique', handle: '@henrique' };
  const KP = 'acervo_posts', KS = 'acervo_saved';

  let posts = [], tab = 'all', cat = 'all', q = '', newCat = 'nota', newImg = null;
  let saved = []; try { saved = JSON.parse(localStorage.getItem(KS)) || []; } catch {}

  const load = () => { try { const l = localStorage.getItem(KP); if (l) return JSON.parse(l); } catch {} return [...(window.POSTS_DATA || [])]; };
  const persist = () => { try { localStorage.setItem(KP, JSON.stringify(posts)); return true; } catch { UI.toast('Sem espaço no navegador. Use uma imagem menor.'); return false; } };
  posts = load();

  // estrutura fixa
  $('#links').innerHTML = NAV.map(([k, i, l]) => `<button class="nav-link${k === 'all' ? ' on' : ''}" data-cat="${k}">${UI.icon(i)}<span>${l}</span></button>`).join('');
  $('#logout').innerHTML = UI.icon('out'); $('#logout').onclick = Auth.logout;
  $('#sIcon').innerHTML = UI.icon('search', 18);
  $('#meName').textContent = S.name; $('#meRole').textContent = admin ? 'Administrador' : 'Leitor';
  $('#meAv').textContent = S.name[0].toUpperCase();

  // filtros
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

  function card(p) {
    const el = document.createElement('article');
    el.className = 'post glass reveal'; el.dataset.cat = p.cat; el.dataset.id = p.id;
    el.innerHTML = `
      <div class="avatar">${esc(AUTHOR.name[0])}</div>
      <div class="p-body">
        <div class="p-top"><b>${esc(AUTHOR.name)}</b><span>${AUTHOR.handle} · ${fmt(p.date)}</span><span class="tag">${CATS[p.cat] || ''}</span></div>
        ${p.title ? `<h2 class="p-title">${esc(p.title)}</h2>` : ''}
        ${p.text ? `<p class="p-text">${esc(p.text)}</p>` : ''}
        ${p.img ? `<img class="p-img" src="${esc(p.img)}" alt="" loading="lazy">` : ''}
        <div class="acts">
          <button class="icon-btn${saved.includes(p.id) ? ' on' : ''}" data-act="save" aria-label="Salvar">${UI.icon('save', 18)}</button>
          <button class="icon-btn" data-act="copy" aria-label="Copiar texto">${UI.icon('copy', 18)}</button>
          ${admin ? `<button class="icon-btn" data-act="del" aria-label="Excluir">${UI.icon('trash', 18)}</button>` : ''}
        </div>
      </div>`;
    return el;
  }

  function render() {
    const list = posts
      .filter(p => (cat === 'all' || p.cat === cat) && (tab === 'all' || (tab === 'img' ? p.img : !p.img)) && (!q || `${p.title} ${p.text}`.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const feed = $('#feed'); feed.innerHTML = '';
    if (!list.length) { feed.innerHTML = '<p class="empty">Nada por aqui ainda.</p>'; return; }
    const wrap = document.createDocumentFragment();
    list.forEach(p => { const c = card(p); wrap.append(c); });
    feed.append(wrap);
    feed.querySelectorAll('.post').forEach((c, i) => { c.style.transitionDelay = `${Math.min(i, 4) * 40}ms`; UI.reveal(c); });
    feed.style.display = 'grid'; feed.style.gap = '1rem';
  }

  $('#feed').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.post').dataset.id, p = posts.find(x => x.id === id);
    if (b.dataset.act === 'save') {
      saved = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
      localStorage.setItem(KS, JSON.stringify(saved)); b.classList.toggle('on');
    } else if (b.dataset.act === 'copy') {
      navigator.clipboard?.writeText(`${p.title ? p.title + '\n' : ''}${p.text}`).then(() => UI.toast('Copiado'));
    } else if (b.dataset.act === 'del' && confirm('Excluir esta publicação?')) {
      posts = posts.filter(x => x.id !== id); persist(); render(); UI.toast('Excluído');
    }
  });

  // administrador
  if (admin) {
    $('#composer').hidden = false; $('#tools').hidden = false;
    $('#cAv').textContent = AUTHOR.name[0];
    $('#attach').innerHTML = UI.icon('image'); $('#prevX').innerHTML = UI.icon('x', 16);
    $('#cats').innerHTML = Object.entries(CATS).map(([k, l]) => `<button type="button" class="chip${k === newCat ? ' on' : ''}" data-k="${k}">${l}</button>`).join('');
    const sync = () => {
      $('#ctitle').hidden = !['estudo', 'artigo'].includes(newCat);
      $('#publish').disabled = !($('#ctext').value.trim() || newImg);
    };
    $('#cats').addEventListener('click', e => {
      const c = e.target.closest('.chip'); if (!c) return;
      newCat = c.dataset.k;
      document.querySelectorAll('#cats .chip').forEach(x => x.classList.toggle('on', x === c)); sync();
    });
    $('#ctext').addEventListener('input', sync);
    $('#cfile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      newImg = await shrink(f); $('#prev img').src = newImg; $('#prev').hidden = false; sync();
    });
    $('#prevX').onclick = () => { newImg = null; $('#cfile').value = ''; $('#prev').hidden = true; sync(); };
    $('#publish').onclick = () => {
      posts.unshift({ id: 'p' + Date.now(), cat: newCat, title: $('#ctitle').hidden ? '' : $('#ctitle').value.trim(), text: $('#ctext').value.trim(), img: newImg, date: new Date().toISOString() });
      if (!persist()) { posts.shift(); return; }
      $('#ctext').value = ''; $('#ctitle').value = ''; $('#prevX').click();
      render(); UI.toast('Publicado');
    };
    $('#export').onclick = () => {
      const blob = new Blob([`/* Gerado em ${new Date().toLocaleString('pt-BR')} */\nwindow.POSTS_DATA = ${JSON.stringify(posts, null, 2)};\n`], { type: 'text/javascript' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'posts-data.js'; a.click();
      UI.toast('Substitua js/posts-data.js por este arquivo');
    };
    $('#reset').onclick = () => {
      if (!confirm('Descartar o que foi feito neste navegador e voltar ao posts-data.js?')) return;
      localStorage.removeItem(KP); posts = [...(window.POSTS_DATA || [])]; render(); UI.toast('Restaurado');
    };
    sync();
  }

  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = img.width * k; c.height = img.height * k;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .82));
      };
      img.onerror = rej; img.src = u;
    });
  }

  render();
})();
