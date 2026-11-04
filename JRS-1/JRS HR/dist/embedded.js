(() => {
  const targets = { notifications: '/notifications', templates: '/templates', 'mail-log': '/logs', 'hr-profile': '/profile', outbox: '/outbox' };
  function navigate(route, intent=false) {
    if (window.parent === window) return false;
    if (/^(?:dashboard|jobs|interviews|reports|outbox|applications(?:\/(?:applications-review|pending-review|interview|interview-results|offer|rejected|hired))?|(?:review|results)\/[A-Za-z0-9_-]+|candidate\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?)$/.test(route)) {
      if(intent) window.parent.postMessage({type:'jrs:workspace',route,intent:true},location.origin);
      return false;
    }
    if (!targets[route]) return false;
    window.parent.postMessage({ type: 'jrs:navigate', path: targets[route] }, location.origin);
    return true;
  }
  let previousPath = '';
  let previousHeight = 0;
  let availableHeight = 0;
  let previousSections='',mountedSections='';
  const sectionControls=()=>[...document.querySelectorAll('#content .section-tabs a,#content .section-tabs button')].filter(element=>
    element.matches('a')?/^#\/applications(?:\/(?:applications-review|pending-review|interview|interview-results|offer|rejected|hired))?$/.test(element.getAttribute('href')||''):['section','interview-queue','period'].includes(element.dataset.action));
  function reportSections(){
    if(window.parent===window)return;
    const controls=sectionControls(),nav=controls[0]?.closest('.section-tabs');
    const label=nav?.getAttribute('aria-label')||'Page sections';
    const items=controls.map(element=>({label:element.textContent.trim(),selected:element.classList.contains('selected')||element.getAttribute('aria-pressed')==='true'}));
    const key=JSON.stringify({label,items,targets:controls.map(element=>element.getAttribute('href')||element.dataset.action+':'+element.dataset.id)});
    if(key!==previousSections){previousSections=key;window.parent.postMessage({type:'jrs:sections',key,label,items},location.origin);}
    if(nav)nav.classList.toggle('header-sections-hosted',key===mountedSections);
  }
  function reportHeight() {
    if (window.parent === window) return;
    const content = document.querySelector('#content');
    if (!content) return;
    // Measure intrinsic content; root scrollHeight includes the iframe viewport.
    const modalOpen = Boolean(document.querySelector('dialog[open]'));
    const minimum = modalOpen ? Math.max(240, availableHeight || window.innerHeight) : 0;
    const height = Math.ceil(Math.max(content.getBoundingClientRect().height, minimum));
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
  // Every integrated job entry opens the authenticated full-page editor.
  document.addEventListener('click', event => {
    const control=event.target.closest('[data-action="job-new"],[data-action="job-edit"]');
    if(!control)return;
    const id=control.dataset.action==='job-edit'?control.dataset.id:null;
    if(id!==null&&(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id)))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(window.parent===window)location.assign('/hr/job-postings?'+(id===null?'create=1':'edit='+encodeURIComponent(id)));
    else window.parent.postMessage({type:'jrs:job-editor',id},location.origin);
  },true);
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href^="#/"]');
    if (anchor && navigate(anchor.getAttribute('href').slice(2),true)) event.preventDefault();
  });
  window.addEventListener('hashchange', () => { navigate(location.hash.slice(2)); queueMicrotask(report); });
  window.addEventListener('load', () => { navigate(location.hash.slice(2)); report(); reportSections(); reportHeight(); });
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if(event.data?.type==='jrs:sections-mounted'&&event.data.key===previousSections){mountedSections=previousSections;reportSections();return;}
    if(event.data?.type==='jrs:select-section'){
      const {key,index}=event.data;
      if(key===previousSections&&Number.isInteger(index)&&index>=0)sectionControls()[index]?.click();
      return;
    }
    if(event.data?.type === 'jrs:viewport') {
      const height=event.data.height;
      if(Number.isFinite(height)&&height>=200&&height<=10000)document.documentElement.style.setProperty('--host-viewport-height',height+'px');
      const capacity=event.data.availableHeight;
      if(Number.isFinite(capacity)&&capacity>=80&&capacity<=10000){
        availableHeight=capacity;
        document.documentElement.style.setProperty('--host-available-height',Math.max(240,capacity)+'px');
      }
      reportHeight();
      return;
    }
    if(event.data?.type !== 'jrs:open') return;
    if (/^applications(?:\/(?:applications-review|pending-review|interview|interview-results|offer|rejected|hired))?$/.test(event.data.route)) location.hash = '#/' + event.data.route;
  });
  const navigation = document.querySelector('#secondary-navigation');
  if (navigation) new MutationObserver(report).observe(navigation, { childList: true, subtree: true, characterData: true });
  const content=document.querySelector('#content');
  if(content)new MutationObserver(reportSections).observe(content,{childList:true,subtree:true});
  if(content)new ResizeObserver(reportHeight).observe(content);
  const modal=document.querySelector('#modal');
  if(modal)new MutationObserver(reportHeight).observe(modal,{attributes:true,attributeFilter:['open']});
})();
