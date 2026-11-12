(() => {
  const byId = id => document.getElementById(id);
  const intro = byId('install-intro');
  const steps = byId('install-steps');
  const installButton = byId('install-app');
  const copyButton = byId('copy-app-link');
  const installStatus = byId('install-status');
  const offlineStatus = byId('offline-status');
  const updateButton = byId('update-app');
  const standalone = matchMedia('(display-mode: standalone)');
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  const embedded = /MicroMessenger|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent);
  const webAddress = /^https?:$/.test(location.protocol);
  let installed = standalone.matches || navigator.standalone === true;
  let installPrompt = null;
  let waitingWorker = null;
  let reloadRequested = false;

  function showInstructions(message, instructions) {
    intro.textContent = message;
    steps.replaceChildren(...instructions.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
  }
  function showInstallState() {
    installButton.hidden = !installPrompt || installed || ios || embedded;
    copyButton.hidden = installed || !webAddress || !navigator.clipboard?.writeText;
    if (installed) {
      showInstructions('已经可以从主屏幕进入零点环线了。', []);
    } else if (!webAddress) {
      showInstructions('先在手机上打开零点环线的网址，再添加到主屏幕。', []);
    } else if (embedded) {
      showInstructions('先在手机浏览器中打开这个页面。', [
        '点当前页面右上角的「…」。',
        ios ? '选择在 Safari 中打开，然后回到这里查看添加方法。' : '选择在浏览器中打开，然后回到这里查看添加方法。',
        '也可以复制链接，粘贴到手机浏览器中打开。'
      ]);
    } else if (ios) {
      showInstructions('添加后，点桌面上的图标就能来看列车。', [
        '点 Safari 的「分享」按钮，图标是一个方框和向上的箭头。它也可能在页面菜单里。',
        '向下找到「添加到主屏幕」。',
        '如果出现「作为网页 App 打开」，保持开启，然后点「添加」。'
      ]);
    } else if (installPrompt) {
      showInstructions('点下方按钮，按手机提示添加到桌面。', []);
    } else if (android) {
      showInstructions('在浏览器中添加一个桌面入口。', [
        '点浏览器右上角的「⋮」或菜单按钮。',
        '选择「安装应用」或「添加到主屏幕」。',
        '按手机提示确认添加。'
      ]);
    } else {
      showInstructions('手机打开这个网址后，就能添加桌面图标。', [
        'iPhone：用 Safari 打开，点「分享」→「添加到主屏幕」。',
        '安卓：打开浏览器菜单，选择「安装应用」或「添加到主屏幕」。'
      ]);
    }
  }
  showInstallState();
  standalone.addEventListener('change', () => {
    installed = standalone.matches || navigator.standalone === true;
    showInstallState();
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    showInstallState();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = null;
    installStatus.textContent = '已添加到主屏幕。';
    showInstallState();
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      installStatus.textContent = choice.outcome === 'accepted' ? '已提交添加请求，请按手机提示完成。' : '可以稍后从浏览器菜单添加。';
    } catch {
      installStatus.textContent = '请从浏览器菜单选择「安装应用」或「添加到主屏幕」。';
    } finally {
      installButton.disabled = false;
      showInstallState();
    }
  });
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      installStatus.textContent = '链接已复制，可以粘贴到手机浏览器中打开。';
    } catch {
      installStatus.textContent = '请长按浏览器地址栏复制链接。';
    }
  });

  if (!('serviceWorker' in navigator) || !webAddress || !window.isSecureContext) return;
  function showUpdate(registration) {
    waitingWorker = navigator.serviceWorker.controller ? registration.waiting : null;
    updateButton.hidden = !waitingWorker;
  }
  updateButton.addEventListener('click', () => {
    if (!waitingWorker) return;
    reloadRequested = true;
    updateButton.disabled = true;
    updateButton.textContent = '正在更新…';
    waitingWorker.postMessage({ type: 'APPLY_UPDATE' });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadRequested) return;
    reloadRequested = false;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
    showUpdate(registration);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (['installed', 'activated', 'redundant'].includes(worker.state)) showUpdate(registration);
      });
    });
    window.addEventListener('online', () => registration.update().catch(() => {}));
    navigator.serviceWorker.ready.then(() => {
      offlineStatus.textContent = '已备好离线观景。首次添加后，请打开一次桌面图标。';
    });
  }).catch(() => {
    offlineStatus.textContent = '离线准备尚未完成，联网时仍可观景。';
  });
})();
