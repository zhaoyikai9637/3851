/* Keep a stable workspace while long documents remain independently scrollable. */
(function(root){
  const V=HRViews;
  root.HRLayout={
    apply(host,page,ui){
      host.dataset.page=page;
      host.querySelectorAll('table').forEach(table=>{
        const headings=[...table.querySelectorAll('th')].map(th=>th.textContent);
        table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,i)=>cell.dataset.label=headings[i]||''));
      });
      if(['review','results'].includes(page)){
        requestAnimationFrame(()=>{
          const canvas=host.querySelector('.resume-canvas'),zoom=host.querySelector('.resume-zoom');
          if(!canvas||!zoom||!zoom.isConnected)return;
          const scale=ui.resumeFit!==false?Math.min(1,(canvas.clientWidth-28)/600):ui.zoom/100;
          zoom.style.width='600px';zoom.style.minWidth='0';
          if(scale>0){zoom.style.zoom=String(scale);if(ui.resumeFit!==false)ui.zoom=Math.round(scale*100);}
        });
      }
      // Profile information and its history are separate, reachable sections.
      if(page==='candidate'){
        const grid=host.querySelector('.profile-grid');
        if(grid){
          const section=ui.section||'details',panels=[...grid.children];
          grid.insertAdjacentHTML('beforebegin',`<nav class="section-tabs" aria-label="Candidate sections">${[['details','Candidate details'],['history','Tasks & history']].map(([id,label])=>V.button('section',label,id,section===id?'selected':'',`aria-pressed="${section===id}"`)).join('')}</nav>`);
          panels.forEach((panel,i)=>{panel.hidden=(section==='history'?i!==1:i!==0);});
          grid.classList.add('single-section');
        }
      }
      // Preserve all next-step actions in a concise success page.
      if(page==='success'){
        const columns=host.querySelector('.two-columns');
        if(columns){
          const details=document.createElement('details');details.className='update-details';
          const summary=document.createElement('summary');summary.textContent='Next steps & update details';
          details.append(summary);columns.before(details);details.append(columns);
        }
      }
      host.querySelectorAll('.table-scroll,.requirements-body,.resume-canvas,.profile-grid>.panel,.schedule').forEach(el=>{
        el.tabIndex=0;
      });
    },
    form(host){
      const form=host.querySelector('form');
      if(form&&['application-create','candidate-save','job-save'].includes(form.dataset.command))form.classList.add('compact-form');
    }
  };
})(window);
