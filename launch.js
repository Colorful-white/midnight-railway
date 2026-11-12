/* One welcome per fresh visit, and per foreground visit in the installed app. */
(() => {
  'use strict';
  const cover = document.getElementById('welcome');
  const journey = document.getElementById('journey');
  const progress = document.getElementById('welcome-progress');
  const fill = document.getElementById('welcome-fill');
  const status = document.getElementById('welcome-status');
  const retry = document.getElementById('welcome-retry');
  const installed = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  let sceneReady = false, failed = false, target = 0, openedAt = performance.now();
  let finishTimer, hideTimer, finishing = false;

  function cancelFinish() {
    clearTimeout(finishTimer);
    clearTimeout(hideTimer);
    finishing = false;
  }
  function advance(value) {
    if (failed || finishing || cover.hidden) return;
    target = Math.max(target, Math.min(value, 90));
    fill.style.transform = `scaleX(${target / 100})`;
    progress.setAttribute('aria-valuenow', String(target));
  }
  function finish() {
    if (!sceneReady || failed || finishing || cover.hidden || document.hidden) return;
    finishing = true;
    const duration = Math.max(500, 1900 - (performance.now() - openedAt));
    fill.style.transitionDuration = duration + 'ms';
    fill.style.transform = 'scaleX(1)';
    progress.setAttribute('aria-valuenow', '100');
    finishTimer = setTimeout(() => {
      cover.classList.add('is-leaving');
      hideTimer = setTimeout(() => {
        cover.hidden = true;
        journey.inert = false;
        journey.removeAttribute('aria-hidden');
        finishing = false;
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550);
    }, duration);
  }
  function show() {
    cancelFinish();
    openedAt = performance.now();
    target = 0;
    journey.inert = true;
    journey.setAttribute('aria-hidden', 'true');
    cover.hidden = false;
    cover.classList.remove('is-leaving');
    fill.style.transitionDuration = '0ms';
    fill.style.transform = 'scaleX(0)';
    progress.setAttribute('aria-valuenow', '0');
    // Commit the empty bar before its next transition, including cached app returns.
    void fill.offsetWidth;
    fill.style.transitionDuration = '550ms';
    if (sceneReady) finish();
    else advance(12);
  }
  function fail(message) {
    sceneReady = false;
    failed = true;
    cancelFinish();
    status.textContent = message;
    retry.hidden = false;
    progress.setAttribute('aria-label', '旅程暂时无法准备完成');
  }
  window.RailwayLaunch = {
    advance,
    ready() {
      if (failed) return;
      sceneReady = true;
      finish();
    },
    fail
  };
  retry.addEventListener('click', () => location.reload());
  for (const script of document.querySelectorAll('script[data-launch-progress]')) {
    script.addEventListener('load', () => advance(Number(script.dataset.launchProgress)));
    script.addEventListener('error', () => fail('旅程没有加载完成，请检查网络后重新打开。'));
  }
  // A runtime error during startup must not leave a forever-loading cover.
  window.addEventListener('error', event => {
    if (!sceneReady && !cover.hidden && event.error) fail('旅程准备遇到了一点问题，请重新打开。');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!cover.hidden) cancelFinish();
    } else if (installed() || !cover.hidden) show();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && installed() && cover.hidden) show();
  });
  show();
})();
