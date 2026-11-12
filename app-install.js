(() => {
  const byId = id => document.getElementById(id);
  const intro = byId('install-intro');
  const steps = byId('install-steps');
  const installButton = byId('install-app');
  const copyButton = byId('copy-app-link');
  const installStatus = byId('install-status');
  const offlineStatus = byId('offline-status');
  const updateButton = byId('update-app');
  const checkButton = byId('check-update');
  const updateStatus = byId('update-status');
  const root = byId('journey');
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
  let registration = null;
  let checking = false;
  let manualCheck = false;
  let lastCheckAt = 0;
  let needsReload = false;
  let previousController = navigator.serviceWorker?.controller;
  const observedWorkers = new WeakSet();

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
  function showUpdate() {
    waitingWorker = registration?.active ? registration.waiting : null;
    const ready = needsReload || Boolean(waitingWorker);
    root.classList.toggle('has-update', ready);
    byId('menu-toggle').title = ready ? '有新版本，打开菜单更新' : '功能菜单';
    updateButton.hidden = !ready;
    checkButton.hidden = ready;
    checkButton.disabled = checking || Boolean(registration?.installing);
    checkButton.textContent = checkButton.disabled ? '正在检查更新…' : '检查更新';
    if (ready) {
      updateButton.disabled = false;
      updateButton.textContent = needsReload ? '新版已就绪 · 点此刷新' : '新版已准备好 · 点此更新';
      updateStatus.textContent = '准备好后点击更新，即可看到新画面。';
      manualCheck = false;
    }
  }
  function observeWorker(worker) {
    if (!worker || observedWorkers.has(worker)) return;
    observedWorkers.add(worker);
    worker.addEventListener('statechange', () => {
      showUpdate();
      if (!manualCheck) return;
      if (worker.state === 'redundant') {
        updateStatus.textContent = '新版下载未完成，请稍后再检查。';
        manualCheck = false;
      } else if (worker.state === 'activated') {
        updateStatus.textContent = '已经是最新版本。';
        manualCheck = false;
      }
    });
  }
  async function checkForUpdates(manual = false) {
    if (!registration) return;
    if (manual) manualCheck = true;
    if (checking) return;
    if (!navigator.onLine) {
      if (manual) updateStatus.textContent = '当前处于离线状态，联网后可以检查更新。';
      manualCheck = false;
      return;
    }
    if (!manual && Date.now() - lastCheckAt < 30000) return;
    lastCheckAt = Date.now();
    checking = true;
    if (manual) updateStatus.textContent = '正在检查…';
    showUpdate();
    try {
      await registration.update();
      observeWorker(registration.installing);
      showUpdate();
      if (manualCheck) {
        updateStatus.textContent = registration.installing ? '正在下载新版，请稍候…' : '已经是最新版本。';
        if (!registration.installing) manualCheck = false;
      }
    } catch {
      if (manualCheck) updateStatus.textContent = '暂时连不上更新服务，请稍后重试。';
      manualCheck = false;
    } finally {
      checking = false;
      showUpdate();
    }
  }
  updateButton.addEventListener('click', () => {
    if (needsReload) {
      location.reload();
      return;
    }
    if (!waitingWorker) return;
    reloadRequested = true;
    updateButton.disabled = true;
    updateButton.textContent = '正在更新…';
    waitingWorker.postMessage({ type: 'APPLY_UPDATE' });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const controller = navigator.serviceWorker.controller;
    if (reloadRequested) {
      reloadRequested = false;
      location.reload();
      return;
    }
    if (previousController && controller !== previousController) needsReload = true;
    previousController = controller;
    showUpdate();
  });
  checkButton.addEventListener('click', () => checkForUpdates(true));
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(currentRegistration => {
    registration = currentRegistration;
    showUpdate();
    observeWorker(registration.installing);
    registration.addEventListener('updatefound', () => {
      observeWorker(registration.installing);
      showUpdate();
    });
    window.addEventListener('online', () => checkForUpdates());
    window.addEventListener('focus', () => checkForUpdates());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdates();
    });
    byId('menu-toggle').addEventListener('click', () => {
      queueMicrotask(() => {
        if (byId('menu-toggle').getAttribute('aria-expanded') === 'true') checkForUpdates();
      });
    });
    setInterval(() => {
      if (!document.hidden) checkForUpdates();
    }, 60000);
    checkForUpdates();
    navigator.serviceWorker.ready.then(() => {
      offlineStatus.textContent = '已备好离线观景。首次添加后，请打开一次桌面图标。';
    });
  }).catch(() => {
    offlineStatus.textContent = '离线准备尚未完成，联网时仍可观景。';
  });
})();
