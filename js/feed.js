(() => {
  const S = Auth.session();
  if (!S) { location.replace(`login.html${location.search}`); return; }
  const admin = S.role === 'admin', reader = S.role === 'reader', logged = admin || reader, uid = S.uid;
  if (logged && !S.token) { Auth.logout(); return; }
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CATS = { quote: { l: 'Quote', i: 'quote' }, nota: { l: 'Nota', i: 'note' }, estudo: { l: 'Estudo', i: 'book' }, artigo: { l: 'Artigo', i: 'file' } };
  const FONTS = { '': 'Padrão', serif: 'Serifa', mono: 'Mono', hand: 'Manuscrita', elegant: 'Elegante' };
  const COLORS = { '': 'Vidro', navy: 'Marinho', blue: 'Azul', sky: 'Céu', sand: 'Areia', mint: 'Menta', rose: 'Rosa', lilac: 'Lilás', peach: 'Pêssego', lemon: 'Limão', aqua: 'Água', coral: 'Coral', violet: 'Violeta', forest: 'Floresta', graphite: 'Grafite' };
  const SW = { '': '#ffffff', navy: '#0A1B33', blue: '#2D6CDF', sky: '#DCEAFF', sand: '#F5EBDD', mint: '#DDF3EA', rose: '#FBE3E8', lilac: '#E9E3FB', peach: '#FFE4D1', lemon: '#FFF6C7', aqua: '#D2F4F7', coral: '#E85D5D', violet: '#6D3FE0', forest: '#14532D', graphite: '#252A36' };
  const THEMES = { blue: '#2D6CDF', navy: '#0A1B33', indigo: '#4F46E5', violet: '#7C4DFF', magenta: '#C026D3', rose: '#E0245E', crimson: '#B91C1C', orange: '#EA580C', amber: '#D98E04', lime: '#65A30D', emerald: '#059669', teal: '#0E9F8E', cyan: '#0891B2', sky: '#38BDF8', coffee: '#7A4B2A', graphite: '#4B5563' };
  // 15 temas, na ordem da lista de categorias do Substack (edite à vontade)
  const TOPICS = ['Cultura', 'Tecnologia', 'Negócios', 'Política', 'Finanças', 'Gastronomia', 'Esportes', 'Arte e Ilustração', 'Saúde', 'Notícias', 'Moda e Beleza', 'Música', 'Fé e Espiritualidade', 'Meio Ambiente', 'Literatura'];
  // níveis por interações (curtidas + comentários). A partir do Bronze o leitor ganha moldura.
  // Para evoluir os requisitos no futuro, mude só os números de 'min' abaixo.
  const LEVELS = [{ k: 'novato', n: 'Novato', min: 0 }, { k: 'bronze', n: 'Bronze', min: 10 }, { k: 'prata', n: 'Prata', min: 20 }, { k: 'ouro', n: 'Ouro', min: 35 }, { k: 'diamante', n: 'Diamante', min: 50 }, { k: 'lendario', n: 'Lendário', min: 70 }];
  const LC = { novato: '#8896AB', bronze: '#B8742F', prata: '#7C8794', ouro: '#C48A00', diamante: '#2F9FD0', lendario: '#A23FE8' };
  const POST_BADGES = [
    { min: 1, n: 'Primeira publicação', i: 'file' },
    { min: 5, n: 'Autor em ascensão', i: 'note' },
    { min: 10, n: 'Autor dedicado', i: 'book' },
    { min: 25, n: 'Autor destaque', i: 'crown' }
  ];
  const NAV = [['all', 'home', 'Início'], ['quote', 'quote', 'Quotes'], ['nota', 'note', 'Notas'], ['estudo', 'book', 'Estudos'], ['artigo', 'file', 'Artigos'], ['ranking', 'trophy', 'Ranking']];
  if (logged) NAV.push(['saved', 'save', 'Salvos'], ['profile', 'user', 'Perfil']);
  const AUTHOR = { name: 'Pedro Henrique', handle: '@henrique' }, MAX = 5, GIF_MAX = 6 * 1024 * 1024, NAME_RE = /^[A-Za-zÀ-ÿ0-9]{5,}$/;

  let posts = [], likes = {}, comments = {}, cards = {}, stats = {}, publicationCounts = {}, saves = new Set(), me = null;
  let view = 'feed', tab = 'all', cat = 'all', q = '';
  let editing = null, newCat = 'nota', font = '', color = '', imgs = [];

  // ---- identidade, níveis e molduras
  const dn = m => (m && (m.social_name || m.name)) || 'Leitor';
  const who = u => cards[u] || { id: u, display_name: 'Leitor', avatar: null, theme: 'blue' };
  const adminCard = () => Object.values(cards).find(c => c.is_admin) || { display_name: AUTHOR.name, username: 'henrique', avatar: null, theme: 'navy', is_admin: true };
  const initial = n => esc(((n || '?').trim()[0] || '?').toUpperCase());
  function computeStats() {
    stats = {};
    const s = u => stats[u] || (stats[u] = { likes: 0, comments: 0, total: 0 });
    Object.values(likes).forEach(a => a.forEach(u => s(u).likes++));
    Object.values(comments).forEach(a => {   // no máximo 3 comentários por post contam, para evitar spam
      const per = {}; a.forEach(c => { per[c.user_id] = (per[c.user_id] || 0) + 1; });
      Object.entries(per).forEach(([u, n]) => { s(u).comments += Math.min(n, 3); });
    });
    Object.values(stats).forEach(x => { x.total = x.likes + x.comments; });
  }
  const total = u => (stats[u] && stats[u].total) || 0;
  const levelOf = u => [...LEVELS].reverse().find(l => total(u) >= l.min);
  const nextLevel = u => LEVELS.find(l => l.min > total(u));
  const frameOf = c => c.is_admin ? 'ceo' : (c.id && levelOf(c.id).min > 0 ? levelOf(c.id).k : '');
  const av = (c, size = 'm', link = true) => {
    const fr = frameOf(c);
    return `<span class="av ${size}${fr ? ' fr fr-' + fr : ''}"${link && c.id ? ` data-user="${esc(c.id)}"` : ''} style="--tc:${THEMES[c.theme] || THEMES.blue}"><i class="in">${c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : initial(c.display_name)}</i></span>`;
  };
  const lvlBadge = (u, all) => { const l = levelOf(u); return (l.min || all) ? `<span class="lvl" style="--lc:${LC[l.k]}">${l.n}</span>` : ''; };
  const ceoBadge = () => `<span class="ceo">${UI.icon('crown', 11)}CEO</span>`;
  const ulink = c => `<button type="button" class="ulink"${c.id ? ` data-user="${esc(c.id)}"` : ''}>${esc(c.display_name)}</button>`;
  const myCard = () => !logged ? { display_name: 'Visitante' } : cards[uid] || (me
    ? { id: uid, display_name: dn(me), avatar: me.avatar, theme: me.theme, is_admin: admin }
    : { id: uid, display_name: admin ? AUTHOR.name : 'Leitor', theme: admin ? 'navy' : 'blue', is_admin: admin });
  function paintMe() {
    const c = myCard();
    $('#meName').textContent = c.display_name;
    $('#meRole').textContent = admin ? 'CEO e administrador' : reader ? 'Leitor' : 'Sem conta';
    $('#meAv').innerHTML = av(c, 'x', false);
    if (logged) $('#cAv').innerHTML = av(c, 'x', false);
  }
  const needAccount = () => { if (logged) return false; if (confirm('Entre ou crie uma conta para interagir. Ir para o login?')) Auth.logout(); return true; };
  function bump() {   // recalcula pontos e avisa quando o leitor sobe de nível
    const before = logged ? levelOf(uid).min : 0; computeStats();
    if (reader) { const l = levelOf(uid); if (l.min > before) UI.toast(`Você subiu para ${l.n} e ganhou uma moldura nova!`); }
  }

  // ---- estrutura fixa e navegação
  $('#links').innerHTML = NAV.map(([k, i, l]) => `<button class="nav-link${k === 'all' ? ' on' : ''}" data-cat="${k}">${UI.icon(i)}<span>${l}</span></button>`).join('');
  $('#logout').innerHTML = UI.icon('out'); $('#logout').onclick = Auth.logout;
  $('#sIcon').innerHTML = UI.icon('search', 18);
  paintMe();

  function showView(v) {
    view = v;
    $('#profileView').hidden = !(v === 'profile' || v === 'user'); $('#rankView').hidden = v !== 'ranking';
    $('#tabs').hidden = v !== 'feed'; $('#feed').style.display = v === 'feed' ? 'grid' : 'none';
    if (logged) $('#composer').hidden = v !== 'feed';
  }
  function navTo(k) {
    cat = k;
    document.querySelectorAll('.nav-link').forEach(x => x.classList.toggle('on', x.dataset.cat === k));
    $('#title').textContent = (NAV.find(n => n[0] === k) || [])[2] || 'Início';
    if (k === 'profile') { showView('profile'); buildProfile(); }
    else if (k === 'ranking') { showView('ranking'); buildRanking(); refreshSocial().then(() => { if (view === 'ranking') buildRanking(); }); }
    else { showView('feed'); render(); }
  }
  async function refreshSocial() {   // traz curtidas, comentários e perfis novos
    try {
      const [ls, cs, cd] = await Promise.all([DB.likes(), DB.comments(), DB.cards()]);
      likes = {}; comments = {};
      ls.forEach(l => (likes[l.post_id] = likes[l.post_id] || []).push(l.user_id));
      cs.forEach(c => (comments[c.post_id] = comments[c.post_id] || []).push(c));
      cd.forEach(c => { cards[c.id] = c; });
      computeStats();
    } catch {}
  }
  let openedUser = null;
  async function openUser(u) {
    if (logged && u === uid) return navTo('profile');
    document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('on'));
    $('#title').textContent = 'Perfil'; showView('user'); openedUser = u; buildPublic(u);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await refreshSocial();
    if (view === 'user' && openedUser === u) buildPublic(u, true);
  }
  $('#links').addEventListener('click', e => { const b = e.target.closest('.nav-link'); if (b) navTo(b.dataset.cat); });
  document.addEventListener('click', e => { const u = e.target.closest('[data-user]'); if (u) openUser(u.dataset.user); });
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  $('#search').addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); if (view === 'feed') render(); });

  const fmt = d => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  const fmtT = d => new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  const fmtM = d => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(d));

  // ---- curtidas
  const likeBar = p => {
    const n = likes[p.id] || [], on = n.includes(uid);
    return `<button class="icon-btn like${on ? ' on' : ''}" data-act="like" aria-label="Curtir">${UI.icon('heart', 18)}</button><span class="like-n">${n.length || ''}</span>`;
  };
  function refreshLike(el, p) {
    el.querySelector('.lk').innerHTML = likeBar(p);
    const ids = likes[p.id] || [], L = el.querySelector('.likers');
    L.hidden = !ids.length;
    L.innerHTML = ids.length ? 'Curtido por ' + ids.slice(0, 6).map(u => { const c = who(u); return `<button type="button" class="ulink lk-u" data-user="${esc(u)}">${av(c, 's', false)}${esc(c.display_name)}</button>`; }).join('') + (ids.length > 6 ? `<span class="more">+${ids.length - 6}</span>` : '') : '';
  }

  // ---- comentários
  function renderComments(el, id) {
    const list = comments[id] || [];
    el.querySelector('.cn').textContent = list.length || '';
    el.querySelector('.cmt-list').innerHTML = list.map(c => {
      const w = who(c.user_id), can = admin || c.user_id === uid;
      return `<div class="cmt" data-cid="${esc(c.id)}">${av(w, 'm')}<div class="cmt-b">${ulink(w)}${w.is_admin ? ' ' + ceoBadge() : ''}<small>${fmtT(c.created_at)}</small>${can ? `<button class="icon-btn" data-act="delc" aria-label="Apagar comentário">${UI.icon('trash', 14)}</button>` : ''}<p>${esc(c.text)}</p></div></div>`;
    }).join('');
  }

  // ---- carrossel (fotos e GIFs)
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
  function syncReadMore(el) {
    const text = el.querySelector('.p-text'), button = el.querySelector('.read-more');
    if (!text || !button) return;
    text.classList.remove('is-collapsed');
    const fullHeight = text.getBoundingClientRect().height;
    text.classList.add('is-collapsed');
    button.hidden = fullHeight <= text.getBoundingClientRect().height + 1;
  }
  const excerpt = (text, max) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
  };
  const isGif = s => /^data:image\/gif/.test(s) || /\.gif(\?|$)/i.test(s);
  const SHARE_THEMES = {
    liquid: { bg: '#10233f', fg: '#f7faff', accent: '#9edcff' },
    midnight: { bg: '#080d1b', fg: '#f6f7fb', accent: '#9c8cff' },
    aurora: { bg: '#102c2b', fg: '#f0fff9', accent: '#83e8ca' },
    sunset: { bg: '#3b1d32', fg: '#fff7f1', accent: '#ffbd82' },
    paper: { bg: '#e9eef5', fg: '#17243a', accent: '#4169e1' }
  };
  const SHARE_FONTS = {
    editorial: { css: "'Newsreader', Georgia, serif", canvas: 'Georgia, serif' },
    modern: { css: "'Sora', Arial, sans-serif", canvas: 'Arial, sans-serif' },
    classic: { css: "'Playfair Display', Georgia, serif", canvas: 'Georgia, serif' },
    mono: { css: "'JetBrains Mono', monospace", canvas: 'monospace' }
  };
  let sharingPost = null, sharingFile = null, sharingMedia = null, sharingUrl = '', shareGeneration = 0;
  const shareSettings = () => ({
    ratio: $('#shareRatio').value,
    font: $('#shareFont').value,
    bg: $('#shareBackground').value,
    fg: $('#shareForeground').value,
    accent: $('#shareAccent').value
  });
  function applyShareSettings() {
    const settings = shareSettings(), story = $('#shareStoryPreview');
    story.dataset.ratio = settings.ratio;
    story.style.setProperty('--share-bg', settings.bg);
    story.style.setProperty('--share-fg', settings.fg);
    story.style.setProperty('--share-accent', settings.accent);
    story.style.setProperty('--share-font', SHARE_FONTS[settings.font].css);
    story.classList.toggle('has-media', !!sharingMedia?.url);
    story.classList.toggle('has-gif', !!sharingMedia?.gif);
    return settings;
  }
  const postUrl = id => {
    const url = new URL(location.href);
    url.search = ''; url.hash = '';
    url.searchParams.set('post', id);
    return url.href;
  };
  const shareCaption = (p, author) => {
    const content = p.cat === 'artigo' && p.title ? `“${p.title}”` : `“${excerpt(p.text, 180) || 'uma publicação interessante'}”`;
    return `${author.display_name} publicou no Acervo:\n${content}`;
  };
  function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = [];
    let line = '', index = 0;
    for (; index < words.length; index++) {
      const test = line ? `${line} ${words[index]}` : words[index];
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line); line = words[index];
        if (lines.length === maxLines) break;
      } else line = test;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (index < words.length && lines.length) {
      let last = lines[lines.length - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[lines.length - 1] = `${last}…`;
    }
    lines.forEach((value, i) => ctx.fillText(value, x, y + i * lineHeight));
    return y + lines.length * lineHeight;
  }
  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function glassPanel(ctx, x, y, w, h, r) {
    roundedRect(ctx, x, y, w, h, r);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.62)'; ctx.lineWidth = 2; ctx.stroke();
    roundedRect(ctx, x + 3, y + 3, w - 6, Math.min(34, h - 6), Math.max(4, r - 3));
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fill();
  }
  function drawCover(ctx, image, x, y, w, h) {
    ctx.save(); roundedRect(ctx, x, y, w, h, 28); ctx.clip();
    const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
    ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.fillStyle = 'rgba(6,18,35,.14)'; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
    roundedRect(ctx, x, y, w, h, 28); ctx.stroke();
  }
  function drawShareCopy(ctx, p, settings, x, y, width, maxLines) {
    const font = SHARE_FONTS[settings.font].canvas;
    if (p.cat === 'artigo' && p.title) {
      ctx.fillStyle = settings.fg; ctx.font = `700 42px ${font}`;
      y = drawWrapped(ctx, p.title, x, y, width, 54, 2) + 22;
    }
    ctx.fillStyle = settings.fg;
    ctx.font = `${p.cat === 'quote' ? 'italic ' : ''}38px ${font}`;
    drawWrapped(ctx, p.text || p.title || 'Uma ideia para descobrir no Acervo.', x, y, width, 52, maxLines);
  }
  async function loadShareMedia(url, postId) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mídia indisponível (${response.status})`);
    const blob = await response.blob(), gif = isGif(url) || blob.type === 'image/gif';
    const type = gif ? 'image/gif' : (blob.type || 'image/jpeg');
    const file = new File([blob], `acervo-${postId}.${gif ? 'gif' : 'jpg'}`, { type });
    if (gif) return { url, gif, file, image: null };
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Imagem inválida'));
        element.src = objectUrl;
      });
      return { url, gif, file, image };
    } finally { URL.revokeObjectURL(objectUrl); }
  }
  async function makeShareImage(p, author, url, settings, mediaImage) {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível');
    const vertical = settings.ratio === 'vertical';
    canvas.width = vertical ? 1080 : 1920; canvas.height = vertical ? 1920 : 1080;
    const w = canvas.width, h = canvas.height, margin = vertical ? 80 : 90;
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, settings.bg); bg.addColorStop(.55, settings.accent); bg.addColorStop(1, settings.bg);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(w * .92, h * .12, vertical ? 330 : 460, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.beginPath(); ctx.arc(w * .12, h * .84, vertical ? 380 : 420, 0, Math.PI * 2); ctx.fill();
    const brandY = vertical ? 130 : 115;
    ctx.fillStyle = settings.fg; ctx.font = `italic ${vertical ? 72 : 64}px Georgia, serif`; ctx.fillText('“', margin, brandY + 22);
    ctx.font = `700 ${vertical ? 31 : 29}px Arial, sans-serif`; ctx.fillText('ACERVO', margin + 70, brandY);
    ctx.fillStyle = settings.fg; ctx.globalAlpha = .68; ctx.font = '600 17px Arial, sans-serif';
    ctx.fillText('QUOTES & ARTICLES', margin + 72, brandY + 30); ctx.globalAlpha = 1;
    ctx.fillStyle = settings.accent; ctx.font = `700 ${vertical ? 24 : 22}px Arial, sans-serif`;
    ctx.fillText((CATS[p.cat] || CATS.nota).l.toUpperCase(), margin, vertical ? 270 : 220);

    if (vertical) {
      const mediaY = 330, mediaH = 610, panelY = mediaImage ? 980 : 380, panelH = mediaImage ? 470 : 1060;
      if (mediaImage) drawCover(ctx, mediaImage, margin, mediaY, w - margin * 2, mediaH);
      glassPanel(ctx, margin, panelY, w - margin * 2, panelH, 30);
      drawShareCopy(ctx, p, settings, margin + 42, panelY + 78, w - margin * 2 - 84, mediaImage ? 5 : 12);
      glassPanel(ctx, margin, 1540, w - margin * 2, 285, 28);
      ctx.fillStyle = settings.fg; ctx.font = '600 18px Arial, sans-serif'; ctx.fillText('UMA IDEIA DE', margin + 40, 1605);
      ctx.font = '700 30px Arial, sans-serif'; ctx.fillText(excerpt(author.display_name, 32), margin + 40, 1652);
      ctx.fillStyle = settings.accent; ctx.font = '700 20px Arial, sans-serif'; ctx.fillText('CONTINUE LENDO NO ACERVO', margin + 40, 1710);
      ctx.fillStyle = settings.fg; ctx.globalAlpha = .8; ctx.font = '18px Arial, sans-serif';
      drawWrapped(ctx, url, margin + 40, 1750, w - margin * 2 - 80, 26, 2); ctx.globalAlpha = 1;
    } else {
      const mediaX = margin, mediaY = 280, mediaW = 790, panelX = mediaImage ? 930 : margin;
      const panelW = mediaImage ? w - panelX - margin : w - margin * 2;
      if (mediaImage) drawCover(ctx, mediaImage, mediaX, mediaY, mediaW, 550);
      glassPanel(ctx, panelX, mediaY, panelW, 550, 30);
      drawShareCopy(ctx, p, settings, panelX + 42, mediaY + 82, panelW - 84, mediaImage ? 6 : 7);
      glassPanel(ctx, margin, 900, w - margin * 2, 125, 24);
      ctx.fillStyle = settings.fg; ctx.font = '700 23px Arial, sans-serif';
      ctx.fillText(`${excerpt(author.display_name, 32)} · CONTINUE NO ACERVO`, margin + 34, 950);
      ctx.fillStyle = settings.accent; ctx.font = '18px Arial, sans-serif';
      drawWrapped(ctx, url, margin + 34, 990, w - margin * 2 - 68, 24, 1);
    }
    const blob = await new Promise((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('Não foi possível criar o card')),
      'image/png'
    ));
    return new File([blob], `acervo-${p.id}.${vertical ? 'vertical' : 'horizontal'}.png`, { type: 'image/png' });
  }
  async function refreshShareDesign() {
    const settings = applyShareSettings(), p = sharingPost, generation = ++shareGeneration;
    if (!p) return;
    sharingFile = null;
    $('#shareDownload').disabled = true;
    document.querySelectorAll('[data-file-share]').forEach(button => {
      button.disabled = true;
      button.querySelector('small').textContent = sharingMedia?.gif
        ? 'Enviar o GIF animado original'
        : `Compartilhar card ${settings.ratio === 'vertical' ? 'vertical' : 'horizontal'}`;
    });
    if (sharingMedia?.loading) { $('#shareStatus').textContent = 'Carregando a mídia do post…'; return; }
    if (sharingMedia?.gif) {
      if (!sharingMedia.file) { $('#shareStatus').textContent = 'Não foi possível carregar o GIF original para compartilhar.'; return; }
      sharingFile = sharingMedia.file;
      $('#shareDownload').disabled = false;
      $('#shareDownload').textContent = 'Baixar GIF animado original';
      document.querySelectorAll('[data-file-share]').forEach(button => { button.disabled = false; });
      $('#shareStatus').textContent = 'GIF original pronto: ele não será convertido em imagem estática. As opções de estilo aparecem na prévia.';
      return;
    }
    const author = p.author_id ? who(p.author_id) : adminCard();
    try {
      const file = await makeShareImage(p, author, sharingUrl, settings, sharingMedia?.image);
      if (generation !== shareGeneration || sharingPost !== p) return;
      sharingFile = file;
      $('#shareDownload').disabled = false;
      $('#shareDownload').textContent = 'Baixar card personalizado';
      document.querySelectorAll('[data-file-share]').forEach(button => { button.disabled = false; });
      $('#shareStatus').textContent = sharingMedia?.error
        ? 'Card pronto, mas não foi possível incluir a imagem. Verifique a conexão e tente novamente.'
        : 'Card personalizado pronto para compartilhar.';
    } catch {
      if (generation !== shareGeneration || sharingPost !== p) return;
      $('#shareStatus').textContent = 'Não foi possível preparar o card neste navegador.';
    }
  }
  async function openShare(p) {
    sharingPost = p; sharingFile = null; sharingUrl = postUrl(p.id); sharingMedia = null;
    const author = p.author_id ? who(p.author_id) : adminCard(), mediaUrl = DB.imgs(p)[0] || '';
    const gif = mediaUrl ? isGif(mediaUrl) : false;
    const image = $('#shareMediaImage');
    $('#shareCategory').textContent = (CATS[p.cat] || CATS.nota).l;
    $('#shareTitle').hidden = !(p.cat === 'artigo' && p.title);
    $('#shareTitle').textContent = p.cat === 'artigo' ? p.title || '' : '';
    $('#shareText').textContent = excerpt(p.text || p.title || 'Uma ideia para descobrir no Acervo.', 340);
    $('#shareAuthor').textContent = author.display_name;
    $('#shareUrlLabel').textContent = sharingUrl;
    $('#sharePermalink').href = sharingUrl;
    $('#sharePermalink').textContent = sharingUrl;
    $('#shareMedia').hidden = !mediaUrl;
    $('#shareGifNotice').hidden = !gif;
    $('#shareIntro').textContent = gif
      ? 'O GIF será enviado como arquivo original para preservar a animação; proporção, fonte e cores personalizam apenas a prévia.'
      : 'Ajuste o formato, a fonte e as cores para criar seu card Liquid Glass.';
    $('#shareDownload').textContent = gif ? 'Baixar GIF animado original' : 'Baixar card personalizado';
    $('#shareDownload').disabled = true;
    document.querySelectorAll('[data-file-share] small').forEach(label => {
      label.textContent = gif ? 'Enviar o GIF animado original' : 'Compartilhar o card personalizado';
    });
    if (mediaUrl) {
      image.src = mediaUrl;
      image.alt = gif ? 'Prévia do GIF animado' : 'Imagem do post';
      sharingMedia = { url: mediaUrl, gif, loading: true };
    } else {
      image.removeAttribute('src'); image.alt = '';
    }
    applyShareSettings();
    $('#shareDialog').showModal();
    if (!mediaUrl) { await refreshShareDesign(); return; }
    $('#shareStatus').textContent = 'Carregando a mídia do post…';
    try { sharingMedia = await loadShareMedia(mediaUrl, p.id); }
    catch { sharingMedia = { url: mediaUrl, gif, loading: false, error: true, file: null, image: null }; }
    if (sharingPost === p) {
      $('#shareGifNotice').hidden = !sharingMedia.gif;
      $('#shareIntro').textContent = sharingMedia.gif
        ? 'O GIF original será enviado sem conversão para preservar a animação; o estilo personalizado aparece apenas na prévia.'
        : 'A imagem do post será integrada ao card Liquid Glass.';
      document.querySelectorAll('[data-file-share] small').forEach(label => {
        label.textContent = sharingMedia.gif ? 'Enviar o GIF animado original' : 'Compartilhar o card personalizado';
      });
      await refreshShareDesign();
    }
  }
  function downloadShareFile() {
    if (!sharingFile) return;
    const objectUrl = URL.createObjectURL(sharingFile), link = document.createElement('a');
    link.href = objectUrl; link.download = sharingFile.name; link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  async function shareStory() {
    if (!sharingFile) return;
    const p = sharingPost, author = p.author_id ? who(p.author_id) : adminCard();
    const data = { files: [sharingFile], title: 'Post do Acervo', text: `${shareCaption(p, author)}\nLeia no Acervo: ${sharingUrl}` };
    if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: data.files })) {
      try {
        await navigator.share(data);
        $('#shareStatus').textContent = sharingMedia?.gif
          ? 'GIF original enviado ao compartilhamento. A plataforma de destino controla a animação.'
          : 'Compartilhamento aberto. Se necessário, adicione o link no próprio aplicativo.';
      } catch (error) {
        if (error.name === 'AbortError') { $('#shareStatus').textContent = 'Compartilhamento cancelado.'; return; }
        downloadShareFile();
        $('#shareStatus').textContent = 'Não foi possível abrir o compartilhamento. Baixamos o arquivo para você publicar manualmente.';
      }
      return;
    }
    downloadShareFile();
    $('#shareStatus').textContent = 'Arquivo baixado. Publique-o no aplicativo e use “Copiar link do post” para compartilhar o endereço.';
  }
  $('#shareTheme').addEventListener('change', () => {
    const theme = SHARE_THEMES[$('#shareTheme').value];
    $('#shareBackground').value = theme.bg;
    $('#shareForeground').value = theme.fg;
    $('#shareAccent').value = theme.accent;
    refreshShareDesign();
  });
  ['shareRatio', 'shareFont'].forEach(id => $(`#${id}`).addEventListener('change', refreshShareDesign));
  ['shareBackground', 'shareForeground', 'shareAccent'].forEach(id => {
    $(`#${id}`).addEventListener('input', applyShareSettings);
    $(`#${id}`).addEventListener('change', refreshShareDesign);
  });
  $('#shareDownload').addEventListener('click', () => {
    downloadShareFile();
    $('#shareStatus').textContent = sharingMedia?.gif ? 'GIF animado original baixado.' : 'Card personalizado baixado.';
  });
  $('#shareClose').addEventListener('click', () => $('#shareDialog').close());
  $('#shareDialog').addEventListener('click', e => { if (e.target === $('#shareDialog')) $('#shareDialog').close(); });
  $('#shareCopyLink').addEventListener('click', async () => {
    if (!navigator.clipboard?.writeText) { $('#shareStatus').textContent = 'Este navegador não permite copiar automaticamente. Selecione o link exibido abaixo do botão.'; return; }
    try { await navigator.clipboard.writeText(sharingUrl); $('#shareStatus').textContent = 'Link copiado!'; }
    catch { $('#shareStatus').textContent = 'Não foi possível copiar. Selecione o link exibido abaixo do botão.'; }
  });
  $('#shareDialog').addEventListener('click', async e => {
    const button = e.target.closest('[data-share-target]');
    if (!button) return;
    const p = sharingPost, author = p.author_id ? who(p.author_id) : adminCard(), caption = shareCaption(p, author);
    if (button.dataset.shareTarget === 'x') {
      const intent = new URL('https://twitter.com/intent/tweet');
      intent.searchParams.set('text', caption); intent.searchParams.set('url', sharingUrl);
      window.open(intent.href, '_blank', 'noopener,noreferrer');
    } else if (button.dataset.shareTarget === 'wa-message') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${caption}\nLeia no Acervo: ${sharingUrl}`)}`, '_blank', 'noopener,noreferrer');
    } else {
      await shareStory();
    }
  });
  $('#feed').addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('car-track')) carState(e.target); }, true);

  function card(p) {
    const C = CATS[p.cat] || CATS.nota, fk = p.font && FONTS[p.font] ? ' f-' + p.font : '', ck = p.color && COLORS[p.color] ? ' has-pc pc-' + p.color : '', ac = p.author_id ? who(p.author_id) : adminCard();
    const canManage = admin || p.author_id === uid;
    const el = document.createElement('article');
    el.className = 'post glass reveal' + ck; el.dataset.cat = p.cat; el.dataset.id = p.id;
    el.innerHTML = `
      ${av(ac, 'x')}
      <div class="p-body">
        <div class="p-top">${ulink(ac)}${ac.is_admin ? ceoBadge() : ''}<span>@${esc(ac.username || 'henrique')} · ${fmt(p.created_at)}${p.updated_at ? ` · <span title="Editado em ${esc(fmt(p.updated_at))}">editado</span>` : ''}</span><span class="tag">${UI.icon(C.i, 13)}${C.l}</span></div>
        ${p.title ? `<h2 class="p-title${fk}">${esc(p.title)}</h2>` : ''}
        ${p.text ? `<p class="p-text${fk} is-collapsed">${esc(p.text)}</p><button type="button" class="read-more" data-act="read-more" aria-expanded="false" hidden>Ler mais</button>` : ''}
        ${carousel(DB.imgs(p))}
        <div class="acts">
          <span class="lk"></span>
          <button class="icon-btn" data-act="comments" aria-label="Comentários">${UI.icon('chat', 18)}</button><span class="like-n cn"></span>
          <button class="icon-btn${saves.has(p.id) ? ' on' : ''}" data-act="save" aria-label="Salvar">${UI.icon('save', 18)}</button>
          <button class="icon-btn" data-act="copy" aria-label="Copiar texto">${UI.icon('copy', 18)}</button>
          <button class="icon-btn" data-act="share" aria-label="Compartilhar publicação">${UI.icon('share', 18)}</button>
          ${canManage ? `<button class="icon-btn" data-act="edit" aria-label="Editar">${UI.icon('edit', 18)}</button><button class="icon-btn" data-act="del" aria-label="Excluir">${UI.icon('trash', 18)}</button>` : ''}
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
    feed.querySelectorAll('.post').forEach((c, i) => { c.style.transitionDelay = `${Math.min(i, 4) * 40}ms`; UI.reveal(c); syncReadMore(c); });
    feed.querySelectorAll('.car-track').forEach(carState);
    feed.style.display = 'grid'; feed.style.gap = '1rem';
  }
  function focusLinkedPost() {
    const id = new URLSearchParams(location.search).get('post');
    if (!id) return;
    requestAnimationFrame(() => {
      const post = [...document.querySelectorAll('#feed .post')].find(el => el.dataset.id === id);
      if (!post) return;
      post.classList.add('in', 'share-highlight');
      post.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => post.classList.remove('share-highlight'), 2600);
    });
  }

  $('#feed').addEventListener('click', async e => {
    const d = e.target.closest('[data-dir]');
    if (d) { const t = d.parentElement.querySelector('.car-track'); t.scrollBy({ left: +d.dataset.dir * t.clientWidth, behavior: 'smooth' }); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const el = b.closest('.post'), id = el.dataset.id, p = posts.find(x => x.id === id), act = b.dataset.act;
    if (act === 'share') {
      openShare(p);
    } else if (act === 'read-more') {
      const expanded = b.getAttribute('aria-expanded') === 'true';
      el.querySelector('.p-text').classList.toggle('is-collapsed', expanded);
      b.setAttribute('aria-expanded', String(!expanded));
      b.textContent = expanded ? 'Ler mais' : 'Ler menos';
    } else if (act === 'copy') {
      navigator.clipboard?.writeText(`${p.title ? p.title + '\n' : ''}${p.text}`).then(() => UI.toast('Copiado'));
    } else if (act === 'comments') {
      el.querySelector('.cmts').hidden = !el.querySelector('.cmts').hidden;
    } else if (act === 'like') {
      if (needAccount()) return;
      const arr = likes[id] || (likes[id] = []), i = arr.indexOf(uid);
      i > -1 ? arr.splice(i, 1) : arr.push(uid);
      bump(); refreshLike(el, p);
      try { i > -1 ? await DB.unlike(id, uid) : await DB.like(id); }
      catch { i > -1 ? arr.push(uid) : arr.splice(arr.indexOf(uid), 1); bump(); refreshLike(el, p); UI.toast('Não foi possível curtir agora.'); }
    } else if (act === 'save') {
      if (needAccount()) return;
      const had = saves.has(id); had ? saves.delete(id) : saves.add(id); b.classList.toggle('on', !had);
      try { had ? await DB.unsave(id) : await DB.save(id); if (cat === 'saved') render(); }
      catch { had ? saves.add(id) : saves.delete(id); b.classList.toggle('on', had); UI.toast('Não foi possível salvar agora.'); }
    } else if (act === 'delc') {
      const cid = b.closest('.cmt').dataset.cid;
      if (!confirm('Apagar este comentário?')) return;
      try { await DB.delComment(cid); comments[id] = (comments[id] || []).filter(c => c.id !== cid); bump(); renderComments(el, id); }
      catch { UI.toast('Não foi possível apagar.'); }
    } else if (act === 'edit' && (admin || p.author_id === uid)) {
      startEdit(p);
    } else if (act === 'del' && (admin || p.author_id === uid) && confirm('Excluir esta publicação?')) {
      try { await DB.remove(p); posts = posts.filter(x => x.id !== id); render(); UI.toast('Excluído'); }
      catch { UI.toast('Não foi possível excluir esta publicação.'); }
    }
  });
  $('#feed').addEventListener('submit', async e => {
    const f = e.target.closest('.cmt-form'); if (!f) return;
    e.preventDefault();
    const el = f.closest('.post'), id = el.dataset.id, inp = f.querySelector('input'), btn = f.querySelector('button'), text = inp.value.trim();
    if (!text) return;
    btn.disabled = true;
    try { (comments[id] = comments[id] || []).push(await DB.addComment(id, text)); inp.value = ''; bump(); renderComments(el, id); }
    catch { UI.toast('Não foi possível comentar agora.'); }
    finally { btn.disabled = false; }
  });

  // ---- ranking
  function buildRanking() {
    const v = $('#rankView');
    const rows = Object.entries(stats).filter(([u, s]) => s.total > 0 && !(cards[u] && cards[u].is_admin)).sort((a, b) => b[1].total - a[1].total || b[1].comments - a[1].comments).slice(0, 20);
    v.innerHTML = `<h2 class="rk-h">Ranking de leitores</h2><p class="muted">1 ponto por curtida ou comentário.</p>
      <div class="lg">${LEVELS.filter(l => l.min).map(l => `<span style="--lc:${LC[l.k]}">${l.n} · ${l.min}</span>`).join('')}</div>` +
      (rows.length ? rows.map(([u, s], i) => `<div class="rk top${i + 1}${u === uid ? ' me' : ''}"><span class="pos">${i + 1}</span>${av(who(u), 'm')}<div class="rk-n">${ulink(who(u))}<small><span>${UI.icon('heart', 12)}${s.likes}</span><span>${UI.icon('chat', 12)}${s.comments}</span></small></div>${lvlBadge(u)}<b class="rk-t">${s.total}</b></div>`).join('')
        : '<p class="empty">Ninguém pontuou ainda. Curta e comente para aparecer aqui!</p>');
  }

  // ---- perfis (visual novo)
  const themeOf = c => THEMES[c.theme] || THEMES.blue;
  const socialLink = s => {
    if (!/^https:\/\/(www\.)?(instagram\.com|x\.com|twitter\.com)\/[A-Za-z0-9_.]{1,30}\/?$/i.test(s || '')) return '';
    return `<a class="btn btn-ghost" href="${esc(s)}" target="_blank" rel="noopener noreferrer nofollow">${/instagram/i.test(s) ? 'Instagram' : 'X'}</a>`;
  };
  const halo = c => `<div class="halo lv-${c.is_admin ? 'ceo' : levelOf(c.id).k}"><span class="orbit o1"></span><span class="orbit o2"></span><span class="orbit o3"></span>${c.is_admin ? `<span class="crown">${UI.icon('crown', 26)}</span>` : ''}${av(c, 'xl', false)}</div>`;
  function hero(c, o = {}) {
    const ceo = !!c.is_admin;
    return `<div class="hero"><div class="hero-bg"><i></i><i></i><i></i></div>
      ${o.back ? '<button type="button" class="hero-back" id="back">← Voltar</button>' : ''}
      ${o.edit ? `<label class="pf-av" for="avfile" title="Trocar foto">${halo(c)}<span class="cam">${UI.icon('image', 16)}</span></label><input id="avfile" type="file" accept="image/*" hidden>` : halo(c)}
      <h2>${esc(c.display_name)} ${ceo ? ceoBadge() : lvlBadge(c.id, true)}</h2>
      <p class="hero-u">@${esc(c.username || '')}${ceo ? ' · CEO e fundador' : ''}</p>
      ${c.bio ? `<p class="pf-bio">${esc(c.bio)}</p>` : ''}</div>`;
  }
  const st2 = (ic, n, label) => `<div class="st2"><span class="ic">${UI.icon(ic, 18)}</span><b data-count="${n}">0</b><small>${label}</small></div>`;
  function publicationRewards(u) {
    const count = publicationCounts[u] || 0, next = POST_BADGES.find(b => b.min > count);
    return `<section class="pf-sec pub-rewards"><h3>Selos de publicação</h3>
      <div class="pub-badges">${POST_BADGES.map(b => `<div class="pub-badge${count >= b.min ? ' earned' : ''}" title="${count >= b.min ? 'Selo conquistado' : `Conquiste ao publicar ${b.min} posts`}">${UI.icon(b.i, 18)}<span>${b.n}</span><small>${b.min} ${b.min === 1 ? 'post' : 'posts'}</small></div>`).join('')}</div>
      <p class="muted">${next ? `Você publicou ${count} de ${next.min} posts para o próximo selo.` : 'Todos os selos de publicação conquistados!'}</p></section>`;
  }
  function levelBox(u) {
    const t = total(u), lv = levelOf(u), nx = nextLevel(u);
    return `<div class="lvbox"><div class="lv-top">${lvlBadge(u, true)}<span class="muted">${t} ${t === 1 ? 'interação' : 'interações'}</span></div>
      ${nx ? `<div class="prog" style="--p:${Math.min(100, ((t - lv.min) / (nx.min - lv.min)) * 100)}%"><i></i></div><small class="muted">Faltam ${nx.min - t} para ${nx.n} e uma nova moldura.</small>` : '<small class="muted">Nível máximo alcançado!</small>'}</div>`;
  }
  function countUp(root) {
    root.querySelectorAll('[data-count]').forEach(el => {
      const n = +el.dataset.count, t0 = performance.now();
      const step = t => { const p = Math.min(1, (t - t0) / 700); el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }
  const received = () => Object.values(likes).reduce((n, a) => n + a.length, 0);
  const readersCount = () => Object.values(cards).filter(x => !x.is_admin).length;

  function buildPublic(u, final) {
    const v = $('#profileView'), c = cards[u];
    v.className = 'pf glass' + (c && c.is_admin ? ' is-ceo' : '');
    if (!c) {
      v.innerHTML = `<div class="pf-body"><p class="empty">${final ? 'Perfil não encontrado.' : 'Carregando perfil…'}</p><button type="button" class="link" id="back">← Voltar</button></div>`;
      $('#back').onclick = () => navTo(cat); return;
    }
    v.style.setProperty('--tc', themeOf(c));
    const ceo = !!c.is_admin, st = stats[u] || { likes: 0, comments: 0, total: 0 };
    v.innerHTML = hero(c, { back: true }) + `<div class="pf-body">
      <div class="st-grid">${ceo ? st2('file', posts.length, 'Publicações') + st2('heart', received(), 'Curtidas recebidas') + st2('user', readersCount(), 'Leitores')
        : st2('heart', st.likes, 'Curtidas') + st2('chat', st.comments, 'Comentários') + st2('trophy', st.total, 'Interações')}</div>
      ${ceo ? '' : levelBox(u)}
      ${ceo ? '' : publicationRewards(u)}
      ${(c.interests || []).length ? `<section class="pf-sec"><h3>Interesses de leitura</h3><div class="topics">${c.interests.map(t => `<span class="topic on">${esc(t)}</span>`).join('')}</div></section>` : ''}
      ${socialLink(c.social) ? `<section class="pf-sec"><h3>Redes</h3><div class="pf-links">${socialLink(c.social)}</div></section>` : ''}
      ${c.created_at ? `<p class="since">Membro desde ${esc(fmtM(c.created_at))}</p>` : ''}</div>`;
    $('#back').onclick = () => navTo(cat);
    countUp(v);
  }

  function buildProfile() {
    const v = $('#profileView');
    v.className = 'pf glass' + (admin ? ' is-ceo' : '');
    if (!logged || !me) { v.innerHTML = '<div class="pf-body"><p class="empty">Perfil indisponível. Confira se o SQL v4 foi executado.</p></div>'; return; }
    const pf = { theme: me.theme in THEMES ? me.theme : 'blue', topics: new Set(me.interests || []) };
    const net = /^https:\/\/(www\.)?(x|twitter)\.com\//i.test(me.social || '') ? 'x' : 'instagram';
    const handle = (me.social || '').split('/').filter(Boolean).pop() || '';
    const nameLocked = me.name_changes >= 1, c = myCard(), st = stats[uid] || { likes: 0, comments: 0, total: 0 };
    v.style.setProperty('--tc', THEMES[pf.theme]);
    v.innerHTML = hero({ ...c, bio: me.bio, username: me.username }, { edit: true }) + `<div class="pf-body">
      <div class="st-grid">${admin ? st2('file', posts.length, 'Publicações') + st2('heart', received(), 'Curtidas recebidas') + st2('user', readersCount(), 'Leitores')
        : st2('heart', st.likes, 'Curtidas') + st2('chat', st.comments, 'Comentários') + st2('trophy', st.total, 'Interações')}</div>
      ${admin ? '' : levelBox(uid)}
      ${admin ? '' : publicationRewards(uid)}
      <form id="pfForm" class="pf-form">
        <label>Nome<input class="input" id="fName" maxlength="30" value="${esc(me.name)}" ${nameLocked ? 'disabled' : ''}><small>${nameLocked ? 'Você já usou a alteração de nome.' : 'Você pode alterar o nome apenas mais 1 vez.'}</small></label>
        <label>Nome social<input class="input" id="fSocialName" maxlength="30" value="${esc(me.social_name || '')}" placeholder="Opcional"><small>Aparece no lugar do nome nos comentários, curtidas e perfil.</small></label>
        <label>Idade<input class="input" id="fAge" type="number" min="5" max="120" value="${me.age ?? ''}"><small>Fica privada: só você vê.</small></label>
        <label>Bio<input class="input" id="fBio" maxlength="25" value="${esc(me.bio || '')}" placeholder="Até 25 caracteres"><small id="bioN">${(me.bio || '').length}/25</small></label>
        <label class="full">Rede social<span class="row"><select class="sel-i" id="fNet"><option value="instagram"${net === 'instagram' ? ' selected' : ''}>Instagram</option><option value="x"${net === 'x' ? ' selected' : ''}>X</option></select><input class="input" id="fHandle" maxlength="31" value="${esc(handle)}" placeholder="@usuario"></span></label>
        <div class="lbl full">Cor do perfil<div class="swatches" id="fTheme">${Object.entries(THEMES).map(([k, col]) => `<button type="button" class="sw${k === pf.theme ? ' on' : ''}" data-t="${k}" title="${k}" aria-label="${k}" style="background:${col}"></button>`).join('')}</div></div>
        <div class="lbl full">Interesses de leitura <small id="intN">${pf.topics.size}/15</small><div class="topics" id="fTopics">${TOPICS.map(t => `<button type="button" class="topic${pf.topics.has(t) ? ' on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
        <button class="btn btn-primary full" type="submit">Salvar perfil</button>
      </form></div>`;
    countUp(v);
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
    const sync = () => {
      cards[uid] = { ...cards[uid], id: uid, display_name: dn(me), avatar: me.avatar, theme: me.theme, bio: me.bio, interests: me.interests, social: me.social, username: me.username, is_admin: admin };
      paintMe(); buildProfile();
    };
    v.querySelector('#avfile').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const url = await DB.upload(await shrink(f, 256, true), uid), old = me.avatar;
        me = await DB.saveProfile(uid, { avatar: url }); if (old) DB.deleteImage(old);
        sync(); UI.toast('Foto atualizada');
      } catch { UI.toast('Não foi possível trocar a foto. Confira o SQL v4.'); }
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
        if (!NAME_RE.test(nm)) return UI.toast('Nome: mínimo 5 caracteres, só letras e números, sem espaços.');
        if (!confirm('Atenção: você só pode alterar o nome mais uma vez. Continuar?')) return;
        patch.name = nm;
      }
      try { me = await DB.saveProfile(uid, patch); sync(); UI.toast('Perfil salvo'); }
      catch (err) { UI.toast(/nome/i.test(err.body || '') ? 'O nome já foi alterado uma vez.' : 'Não foi possível salvar. Confira os campos.'); }
    });
  }

  // ---- publicar
  const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  if (logged) {
    $('#composer').hidden = false;
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
      t.innerHTML = imgs.map((s, i) => `<div class="th${isGif(s) ? ' gif' : ''}"><img src="${esc(s)}" alt=""><button type="button" class="icon-btn" data-rm="${i}" aria-label="Remover">${UI.icon('x', 14)}</button></div>`).join('');
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
      if (files.length > MAX - imgs.length) UI.toast(`Máximo de ${MAX} mídias por post`);
      for (const f of files.slice(0, MAX - imgs.length)) {
        try {
          if (f.type === 'image/gif') {   // GIF vai como veio, para não perder a animação
            if (f.size > GIF_MAX) { UI.toast('GIF muito grande (máximo 6 MB).'); continue; }
            imgs.push(await readFile(f));
          } else imgs.push(await shrink(f, 1400));
        } catch {}
      }
      renderThumbs(); sync();
    });

    $('#publish').onclick = async () => {
      const btn = $('#publish'); btn.disabled = true; btn.textContent = editing ? 'Salvando…' : 'Publicando…';
      try {
        const urls = [];
        for (const s of imgs) urls.push(s.startsWith('data:') ? await DB.upload(s, reader ? uid : '') : s);
        const body = { cat: newCat, title: $('#ctitle').hidden ? '' : $('#ctitle').value.trim(), text: $('#ctext').value.trim(), font, color, imgs: urls, img: null };
        if (reader) body.author_id = uid;
        if (editing) {
          body.updated_at = new Date().toISOString();
          const u = await DB.update(editing.id, body);
          DB.imgs(editing).filter(x => !urls.includes(x)).forEach(DB.deleteImage);
          posts = posts.map(x => x.id === u.id ? u : x);
          stopEdit(); render(); UI.toast('Alterações salvas');
        } else {
          posts.unshift(await DB.add(body));
          if (reader) publicationCounts[uid] = (publicationCounts[uid] || 0) + 1;
          const badge = reader && POST_BADGES.find(b => b.min === publicationCounts[uid]);
          clearForm(); render(); UI.toast(badge ? `Novo selo: ${badge.n}!` : 'Publicado para todos');
        }
      } catch { UI.toast('Não foi possível salvar. Confira se o SQL v5 foi executado e tente novamente.'); }
      finally { btn.textContent = editing ? 'Salvar alterações' : 'Publicar'; sync(); }
    };

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
      const [ps, ls, cs, cd, pc] = await Promise.all([
        DB.list(), DB.likes().catch(() => []), DB.comments().catch(() => []), DB.cards().catch(() => []),
        DB.publicationCounts().catch(() => null)
      ]);
      posts = ps;
      ls.forEach(l => (likes[l.post_id] = likes[l.post_id] || []).push(l.user_id));
      cs.forEach(c => (comments[c.post_id] = comments[c.post_id] || []).push(c));
      cd.forEach(c => { cards[c.id] = c; });
      if (pc) pc.forEach(c => { publicationCounts[c.user_id] = c.total; });
      else UI.toast('Os selos não carregaram. Verifique a conexão e execute o SQL v5 no Supabase, se ainda não fez isso.');
      computeStats();
      if (logged) {
        const [sv, mp] = await Promise.all([DB.saves().catch(() => []), DB.myProfile(uid).catch(() => null)]);
        sv.forEach(s => saves.add(s.post_id)); me = mp || null;
      }
      paintMe(); render(); focusLinkedPost();
    } catch { $('#feed').innerHTML = '<p class="empty">Não foi possível carregar as publicações.</p>'; }
  })();
})();
