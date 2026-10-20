(() => {
  const targets = { notifications: '/notifications', templates: '/templates', 'mail-log': '/logs', 'hr-profile': '/profile', outbox: '/applications' };
  function navigate(route) {
    if (window.parent === window || !targets[route]) return false;
    window.parent.postMessage({ type: 'jrs:navigate', path: targets[route] }, location.origin);
    return true;
  }
  function report() {
    if (window.parent === window) return;
    const content = document.querySelector('#content');
    const header = document.querySelector('.workspace > .topbar');
    const height = (content?.getBoundingClientRect().height || 0) + (header?.getBoundingClientRect().height || 0) + 24;
    window.parent.postMessage({ type: 'jrs:frame', height }, location.origin);
  }
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href^="#/"]');
    if (anchor && navigate(anchor.getAttribute('href').slice(2))) event.preventDefault();
  });
  window.addEventListener('hashchange', () => { navigate(location.hash.slice(2)); report(); });
  window.addEventListener('load', () => { navigate(location.hash.slice(2)); report(); });
  const observer = new ResizeObserver(report);
  observer.observe(document.body);
  const content = document.querySelector('#content');
  if (content) observer.observe(content);
})();
