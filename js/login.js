if (Auth.session()) location.replace('feed.html');

const seg = document.getElementById('seg'), btns = [...seg.querySelectorAll('button')];
const forms = [document.getElementById('readerForm'), document.getElementById('adminForm')];
const card = document.getElementById('card'), err = document.getElementById('err');

btns.forEach((b, i) => b.addEventListener('click', () => {
  seg.dataset.i = i;
  btns.forEach((x, j) => x.setAttribute('aria-selected', i === j));
  forms.forEach((f, j) => f.hidden = i !== j);
  forms[i].querySelector('input').focus();
}));

const go = () => { card.classList.add('leave'); setTimeout(() => location.replace('feed.html'), 350); };

forms[0].addEventListener('submit', e => {
  e.preventDefault();
  Auth.loginReader(document.getElementById('rname').value);
  go();
});

forms[1].addEventListener('submit', async e => {
  e.preventDefault();
  err.textContent = '';
  let ok = false;
  try { ok = await Auth.loginAdmin(document.getElementById('pw').value); }
  catch { err.textContent = 'Abra o site por HTTPS ou localhost para validar a senha.'; return; }
  if (ok) return go();
  err.textContent = 'Senha incorreta.';
  card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
});
