if (Auth.session()) location.replace('feed.html');

const seg = document.getElementById('seg'), btns = [...seg.querySelectorAll('button')];
const $ = id => document.getElementById(id);
const forms = ['readerForm', 'signForm', 'adminForm'].map($);
const errs = ['rerr', 'serr', 'err'].map($);
const card = $('card');
const NAME = /^[A-Za-zÀ-ÿ0-9]+$/, USER = /^[a-z0-9_]{3,20}$/;

const showError = (el, msg) => {
  el.textContent = msg;
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
};

btns.forEach((b, i) => b.addEventListener('click', () => {
  seg.dataset.i = i;
  errs.forEach(e => e.textContent = '');
  btns.forEach((x, j) => x.setAttribute('aria-selected', i === j));
  forms.forEach((f, j) => f.hidden = i !== j);
  forms[i].querySelector('input').focus();
}));

const go = () => { card.classList.add('leave'); setTimeout(() => location.replace('feed.html'), 350); };

// Entrar (leitor)
forms[0].addEventListener('submit', async e => {
  e.preventDefault(); errs[0].textContent = '';
  try {
    if (await Auth.loginReader($('ruser').value.trim(), $('rpass').value)) return go();
    showError(errs[0], 'Usuário ou senha incorretos.');
  } catch { errs[0].textContent = 'Não foi possível conectar. Confira o js/config.js e a internet.'; }
});

// Criar conta
forms[1].addEventListener('submit', async e => {
  e.preventDefault(); errs[1].textContent = '';
  const name = $('sname').value.trim(), user = $('suser').value.trim().toLowerCase();
  if (name.length < 5) return showError(errs[1], 'O nome deve ter no mínimo 5 caracteres.');
  if (!NAME.test(name)) return showError(errs[1], 'Use apenas letras e números no nome (sem espaços ou símbolos).');
  if (!USER.test(user)) return showError(errs[1], 'Usuário: 3 a 20 caracteres, só letras, números e _.');
  try {
    const r = await Auth.signup(name, user, $('spass').value);
    if (r === 'ok') return go();
    showError(errs[1], {
      taken: 'Esse usuário já existe. Escolha outro.',
      weak: 'Senha fraca: use pelo menos 6 caracteres.',
      disabled: 'Cadastros desativados. O administrador precisa ativá-los no Supabase.',
      confirm: 'A confirmação de e-mail está ativa no Supabase. O administrador precisa desativá-la.'
    }[r]);
  } catch { errs[1].textContent = 'Não foi possível criar a conta agora.'; }
});

// Administrador
forms[2].addEventListener('submit', async e => {
  e.preventDefault(); errs[2].textContent = '';
  try {
    if (await Auth.loginAdmin($('pw').value)) return go();
    showError(errs[2], 'Senha incorreta.');
  } catch { errs[2].textContent = 'Não foi possível conectar. Confira o js/config.js e a internet.'; }
});

$('guest').addEventListener('click', () => { Auth.guest(); go(); });
