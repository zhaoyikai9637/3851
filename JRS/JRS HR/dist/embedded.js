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
  let previousHeight = 0;
  function reportHeight() {
    if (window.parent === window) return;
    const content = document.querySelector('#content');
    if (!content) return;
    // Measure intrinsic content; root scrollHeight includes the iframe viewport.
    const height = Math.ceil(content.getBoundingClientRect().height);
    if (height < 1) return; // The authenticated shell is still hidden during loading.
    if (height === previousHeight) return;
    previousHeight = height;
    window.parent.postMessage({type:'jrs:frame',height},location.origin);
  }
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
  window.addEventListener('load', () => { navigate(location.hash.slice(2)); report(); reportHeight(); });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if(event.data?.type === 'jrs:viewport') {
      const height=event.data.height;
      if(Number.isFinite(height)&&height>=200&&height<=10000)document.documentElement.style.setProperty('--host-viewport-height',height+'px');
      return;
    }
    if(event.data?.type !== 'jrs:open') return;
    if (/^applications(?:\/(?:applications-review|pending-review|interview|interview-results|offer|rejected|hired))?$/.test(event.data.route)) location.hash = '#/' + event.data.route;
  });
  const navigation = document.querySelector('#secondary-navigation');
  if (navigation) new MutationObserver(report).observe(navigation, { childList: true, subtree: true, characterData: true });
  const content=document.querySelector('#content');
  if(content)new ResizeObserver(reportHeight).observe(content);
})();
