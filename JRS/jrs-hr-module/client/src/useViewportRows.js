import {useLayoutEffect,useRef,useState} from 'react';
import '../../../JRS HR/dist/pagination.js';

// Same breakpoint as the fill rules in styles.css and the legacy dashboard layout.
export function fitsWindow(){
 return typeof window.matchMedia!=='function'||window.matchMedia('(min-width: 1001px) and (min-height: 620px)').matches;
}

export function useViewportRows(ref,revision,initialSize=10){
 const [size,setSize]=useState(initialSize),metrics=useRef({width:0,rowHeight:0});
 useLayoutEffect(()=>{
  const host=ref.current,footer=document.querySelector('.workspace-footer');if(!host)return;
  function measure(){
   // Only the desktop layout pages to fit the window; narrow screens scroll normally.
   if(!fitsWindow()){setSize(initialSize);return;}
   const main=host.closest('main');
   const padding=main?parseFloat(getComputedStyle(main).paddingBottom)||0:0;
   const available=window.innerHeight-(host.getBoundingClientRect().top+window.scrollY)-padding-(footer?.getBoundingClientRect().height||0)-8;
   if(metrics.current.width!==window.innerWidth)metrics.current={width:window.innerWidth,rowHeight:0};
   const result=window.HRPagination.measure(host,available,metrics.current.rowHeight);
   if(result){metrics.current.rowHeight=result.rowHeight;setSize(previous=>previous===result.size?previous:result.size);}
  }
  measure();window.addEventListener('resize',measure);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
  observer?.observe(host);if(footer)observer?.observe(footer);
  document.fonts?.ready.then(()=>{if(host.isConnected)measure();});
  return ()=>{window.removeEventListener('resize',measure);observer?.disconnect();};
 },[ref,revision,initialSize]);
 return size;
}
