(() => {
  function report() {
    if (window.parent === window) return;
    window.parent.postMessage({ type: 'jrs:frame', height: document.body.scrollHeight + 24, route: location.hash.replace(/^#\//, '').split('/')[0] }, location.origin);
  }
  new ResizeObserver(report).observe(document.body);
  window.addEventListener('hashchange', report);
  window.addEventListener('load', report);
})();
