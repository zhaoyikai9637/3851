/* Measure real list rows, leaving controls and pagination in normal document flow. */
(function(root){
 function capacity(available,overhead,rowHeight){
  if(!Number.isFinite(available)||available<=0||!Number.isFinite(rowHeight)||rowHeight<=0)return 10;
  return Math.max(1,Math.min(10,Math.floor((available-Math.max(0,overhead)-4)/rowHeight)));
 }
 function measure(host,available,minimumRowHeight=0){
  const rows=[...host.querySelectorAll('table tbody > tr')];
  if(!rows.length)rows.push(...host.querySelectorAll('.panel > .task-item'));
  const height=host.getBoundingClientRect().height;
  if(!height||!rows.length)return null;
  const heights=rows.map(row=>{
   const css=getComputedStyle(row);
   return row.getBoundingClientRect().height+(parseFloat(css.marginTop)||0)+(parseFloat(css.marginBottom)||0);
  });
  const rowHeight=Math.max(minimumRowHeight,...heights);
  if(!rowHeight)return null;
  return {size:capacity(available,height-heights.reduce((a,b)=>a+b,0),rowHeight),rowHeight};
 }
 root.HRPagination={capacity,measure};
})(typeof window==='undefined'?globalThis:window);
