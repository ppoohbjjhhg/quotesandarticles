if (Auth.session()) location.replace('feed.html');

const seg = document.getElementById('seg'), btns = [...seg.querySelectorAll('button')];
const forms = [document.getElementById('readerForm'), document.getElementById('adminForm')];
const card = document.getElementById('card'), err = document.getElementById('err');
const readerInput = document.getElementById('rname');

const showError = msg => {
  err.textContent = msg;
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
};

btns.forEach((b, i) => b.addEventListener('click', () => {
  seg.dataset.i = i;
  err.textContent = '';
  btns.forEach((x, j) => x.setAttribute('aria-selected', i === j));
  forms.forEach((f, j) => f.hidden = i !== j);
  forms[i].querySelector('input').focus();
}));

const go = () => { card.classList.add('leave'); setTimeout(() => location.replace('feed.html'), 350); };

forms[0].addEventListener('submit', e => {
  e.preventDefault();
  err.textContent = '';

  const name = readerInput.value.trim();

  if (name.length > 0) {
    if (name.length < 5) {
      return showError('O nome deve ter no mínimo 5 caracteres.');
    }
    if (!/^[A-Za-zÀ-ÿ0-9]+$/.test(name)) {
      return showError('Use apenas letras e números no nome (sem espaços ou símbolos).');
    }
  }

  Auth.loginReader(name);
  go();
});

forms[1].addEventListener('submit', async e => {
  e.preventDefault();
  err.textContent = '';
  let ok = false;
  try { ok = await Auth.loginAdmin(document.getElementById('pw').value); }
  catch { err.textContent = 'Não foi possível conectar. Confira o js/config.js e a internet.'; return; }
  if (ok) return go();
  showError('Senha incorreta.');
});