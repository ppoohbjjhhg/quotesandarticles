(() => {
  if (!('serviceWorker' in navigator)) return;
  const scriptUrl = document.currentScript?.src;
  if (!scriptUrl) return;

  const registration = navigator.serviceWorker.register(new URL('../service-worker.js', scriptUrl))
    .catch(error => {
      console.error('Não foi possível registrar o service worker do Quotes and Articles.', error);
      throw error;
    });
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installPrompt = null;

  if (!standalone) {
    const installButton = document.createElement('button');
    installButton.className = 'pwa-install';
    installButton.type = 'button';
    installButton.textContent = isAppleMobile ? 'Como instalar' : 'Instalar aplicativo';
    installButton.hidden = !isAppleMobile;
    document.body.append(installButton);

    if (isAppleMobile) {
      installButton.addEventListener('click', () => {
        const dialog = document.createElement('dialog');
        dialog.className = 'pwa-help';
        dialog.innerHTML = '<h2>Instalar o app</h2><p>No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p><form method="dialog"><button class="pwa-help-close">Entendi</button></form>';
        document.body.append(dialog);
        dialog.addEventListener('close', () => dialog.remove(), { once: true });
        dialog.showModal();
      });
    }

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installPrompt = event;
      installButton.hidden = false;
      installButton.textContent = 'Instalar aplicativo';
    });

    installButton.addEventListener('click', async () => {
      if (isAppleMobile || !installPrompt) return;
      const prompt = installPrompt;
      installPrompt = null;
      installButton.hidden = true;
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch (error) {
        console.error('Não foi possível abrir a instalação do app.', error);
      }
    });

    window.addEventListener('appinstalled', () => {
      installPrompt = null;
      installButton.hidden = true;
    });
  }

  const session = typeof Auth === 'undefined' ? null : Auth.session();
  window.notifyPostCreated = async post => {
    const response = await fetch(`${window.CONFIG.SUPABASE_URL}/functions/v1/send-post-notification`, {
      method: 'POST',
      headers: {
        apikey: window.CONFIG.SUPABASE_KEY,
        Authorization: `Bearer ${await Auth.token()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ postId: post.id })
    });
    if (!response.ok) throw new Error(`Falha ao enviar notificações (${response.status}): ${await response.text()}`);
    return response.json();
  };
  const vapidPublicKey = window.CONFIG?.PUSH_VAPID_PUBLIC_KEY;
  if (!session?.token || !['reader', 'admin'].includes(session.role)
    || !vapidPublicKey || !('PushManager' in window) || !('Notification' in window)) return;

  const notificationButton = document.createElement('button');
  notificationButton.className = 'pwa-notifications';
  notificationButton.type = 'button';
  notificationButton.textContent = 'Ativar notificações';
  document.body.append(notificationButton);

  const apiUrl = `${window.CONFIG.SUPABASE_URL}/rest/v1/push_subscriptions`;
  const headers = async () => ({
    apikey: window.CONFIG.SUPABASE_KEY,
    Authorization: `Bearer ${await Auth.token()}`,
    'Content-Type': 'application/json'
  });
  const encodeFilter = value => encodeURIComponent(value);
  const decodeKey = value => {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  };
  const persistSubscription = async subscription => {
    const keys = subscription.toJSON().keys;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { ...(await headers()), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: session.uid,
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      })
    });
    if (!response.ok) throw new Error(`Não foi possível salvar a inscrição de push (${response.status}).`);
  };
  const removeSubscription = async subscription => {
    const response = await fetch(`${apiUrl}?user_id=eq.${encodeFilter(session.uid)}&endpoint=eq.${encodeFilter(subscription.endpoint)}`, {
      method: 'DELETE',
      headers: await headers()
    });
    if (!response.ok) throw new Error(`Não foi possível remover a inscrição de push (${response.status}).`);
    await subscription.unsubscribe();
  };

  const syncButton = async () => {
    const worker = await registration;
    const subscription = await worker.pushManager.getSubscription();
    notificationButton.textContent = subscription ? 'Desativar notificações' : 'Ativar notificações';
  };
  syncButton().catch(error => console.error('Não foi possível verificar as notificações.', error));

  notificationButton.addEventListener('click', async () => {
    notificationButton.disabled = true;
    try {
      const worker = await registration;
      const existing = await worker.pushManager.getSubscription();
      if (existing) {
        await removeSubscription(existing);
        notificationButton.textContent = 'Ativar notificações';
        return;
      }

      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') {
        notificationButton.textContent = permission === 'denied' ? 'Notificações bloqueadas' : 'Ativar notificações';
        return;
      }
      const subscription = await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeKey(vapidPublicKey)
      });
      try {
        await persistSubscription(subscription);
      } catch (error) {
        await subscription.unsubscribe();
        throw error;
      }
      notificationButton.textContent = 'Desativar notificações';
    } catch (error) {
      console.error('Não foi possível configurar as notificações.', error);
      notificationButton.textContent = 'Tentar novamente';
    } finally {
      notificationButton.disabled = false;
    }
  });

})();
