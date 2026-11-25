if (Auth.session()) location.replace('feed.html');

const $ = id => document.getElementById(id);
const forms = ['readerForm', 'signForm', 'adminForm'].map($);
const errs = ['rerr', 'serr', 'err'].map($);
const card = $('card');
const USER = /^[a-z]{3,20}$/, PASS = /^[A-Za-z0-9]{5}$/;

const showError = (el, msg) => {
  el.textContent = msg;
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
};
function show(i) {   // 0 = entrar, 1 = criar conta, 2 = administrador
  errs.forEach(e => e.textContent = '');
  forms.forEach((f, j) => f.hidden = i !== j);
  forms[i].querySelector('input').focus();
}
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(+b.dataset.go)));
$('toAdmin').addEventListener('click', () => show(2));
$('forgot').addEventListener('click', () => {
  $('rerr').textContent = 'Não há recuperação por e-mail. Peça ao administrador para redefinir sua senha ou crie uma nova conta.';
});

const go = () => { card.classList.add('leave'); setTimeout(() => location.replace('feed.html'), 350); };

// Entrar (leitor)
forms[0].addEventListener('submit', async e => {
  e.preventDefault(); errs[0].textContent = '';
  Auth.setRemember($('remember').checked);
  try {
    if (await Auth.loginReader($('ruser').value.trim().toLowerCase(), $('rpass').value)) return go();
    showError(errs[0], 'Usuário ou senha incorretos.');
  } catch { errs[0].textContent = 'Não foi possível conectar. Confira o js/config.js e a internet.'; }
});

// Criar conta: usuário só com letras, nome social livre, senha de 5 letras/números
forms[1].addEventListener('submit', async e => {
  e.preventDefault(); errs[1].textContent = '';
  const user = $('suser').value.trim().toLowerCase(), social = $('sname').value.trim(), pass = $('spass').value;
  if (!USER.test(user)) return showError(errs[1], 'Usuário: use apenas letras (de 3 a 20).');
  if (!social || social.length > 30) return showError(errs[1], 'Nome social: de 1 a 30 caracteres.');
  if (!PASS.test(pass)) return showError(errs[1], 'A senha deve ter exatamente 5 caracteres, só letras e números.');
  Auth.setRemember(true);
  try {
    const r = await Auth.signup(social, user, pass);
    if (r === 'ok') return go();
    showError(errs[1], {
      taken: 'Esse usuário já existe. Escolha outro.',
      weak: 'Senha recusada. Tente outra combinação de 5 letras e números.',
      disabled: 'Cadastros desativados. O administrador precisa ativá-los no Supabase.',
      confirm: 'A confirmação de e-mail está ativa no Supabase. O administrador precisa desativá-la.'
    }[r]);
  } catch { errs[1].textContent = 'Não foi possível criar a conta agora.'; }
});

// Administrador
forms[2].addEventListener('submit', async e => {
  e.preventDefault(); errs[2].textContent = '';
  Auth.setRemember(true);
  try {
    if (await Auth.loginAdmin($('pw').value)) return go();
    showError(errs[2], 'Senha incorreta.');
  } catch { errs[2].textContent = 'Não foi possível conectar. Confira o js/config.js e a internet.'; }
});

$('guest').addEventListener('click', () => { Auth.setRemember(false); Auth.guest(); go(); });

// brilho do vidro que acompanha o mouse
card.addEventListener('pointermove', e => {
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
  card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
});

// mostrar/ocultar senha
document.querySelectorAll('input[type=password]').forEach(inp => {
  const w = document.createElement('div'); w.className = 'pwrap'; inp.parentNode.insertBefore(w, inp); w.append(inp);
  const b = document.createElement('button'); b.type = 'button'; b.className = 'eye'; b.setAttribute('aria-label', 'Mostrar senha'); b.innerHTML = UI.icon('eye', 18); w.append(b);
  b.onclick = () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = UI.icon(show ? 'eyeoff' : 'eye', 18); };
});
