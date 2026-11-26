(() => {
  if (!('serviceWorker' in navigator)) return;
  const scriptUrl = document.currentScript?.src;
  if (!scriptUrl) return;

  navigator.serviceWorker.register(new URL('../service-worker.js', scriptUrl))
    .catch(error => console.error('Não foi possível registrar o service worker do Acervo.', error));

  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) return;

  const button = document.createElement('button');
  button.className = 'pwa-install';
  button.type = 'button';
  button.textContent = 'Instalar aplicativo';
  button.hidden = true;
  document.body.append(button);

  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isAppleMobile) {
    button.textContent = 'Como instalar';
    button.hidden = false;
    button.addEventListener('click', () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'pwa-help';
      dialog.innerHTML = '<h2>Instalar o Acervo</h2><p>No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p><form method="dialog"><button class="pwa-help-close">Entendi</button></form>';
      document.body.append(dialog);
      dialog.addEventListener('close', () => dialog.remove(), { once: true });
      dialog.showModal();
    });
  }

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = false;
    button.textContent = 'Instalar aplicativo';
  });

  button.addEventListener('click', async () => {
    if (isAppleMobile) return;
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    button.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (error) {
      console.error('Não foi possível abrir a instalação do Acervo.', error);
    }
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    button.hidden = true;
  });
})();
