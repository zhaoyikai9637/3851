(() => {
  const targets = { notifications: '/notifications', templates: '/templates', 'mail-log': '/logs', 'hr-profile': '/profile', outbox: '/applications' };
  function navigate(route, intent=false) {
    if (window.parent === window) return false;
    if (/^(?:dashboard|jobs|interviews|reports|applications(?:\/(?:applications-review|pending-review|interview|interview-results|offer|rejected|hired))?|(?:review|results)\/[A-Za-z0-9_-]+|candidate\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?)$/.test(route)) {
      if(intent) window.parent.postMessage({type:'jrs:workspace',route,intent:true},location.origin);
      return false;
    }
    if (!targets[route]) return false;
    window.parent.postMessage({ type: 'jrs:navigate', path: targets[route] }, location.origin);
    return true;
  }
  let previousPath = '';
  function report() {
    if (window.parent === window) return;
    const items = [...document.querySelectorAll('#secondary-navigation li')].map(item => ({
      label: item.textContent.trim(), route: item.querySelector('a')?.getAttribute('href')?.replace(/^#\//, '') || null,
    }));
    const path = JSON.stringify(items);
    if (path === previousPath) return;
    previousPath = path;
    window.parent.postMessage({ type: 'jrs:location', items }, location.origin);
  }
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href^="#/"]');
    if (anchor && navigate(anchor.getAttribute('href').slice(2),true)) event.preventDefault();
  });
  window.addEventListener('hashchange', () => { navigate(location.hash.slice(2)); queueMicrotask(report); });
  window.addEventListener('load', () => { navigate(location.hash.slice(2)); report(); });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'jrs:open') return;
    if (/^applications(?:\/(?:applications-review|pending-review|interview|interview-results|offer|rejected|hired))?$/.test(event.data.route)) location.hash = '#/' + event.data.route;
  });
  const navigation = document.querySelector('#secondary-navigation');
  if (navigation) new MutationObserver(report).observe(navigation, { childList: true, subtree: true, characterData: true });
})();
