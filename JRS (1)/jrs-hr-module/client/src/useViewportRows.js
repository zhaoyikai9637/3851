import {useLayoutEffect,useRef,useState} from 'react';
import '../../../JRS HR/dist/pagination.js';

export function useViewportRows(ref,revision,initialSize=10){
 const [size,setSize]=useState(initialSize),metrics=useRef({width:0,rowHeight:0});
 useLayoutEffect(()=>{
  const host=ref.current,footer=document.querySelector('.workspace-footer');if(!host)return;
  function measure(){
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
 },[ref,revision]);
 return size;
}
