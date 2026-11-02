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
      if(page==='review'){
        const body=host.querySelector('.requirements-body');
        if(body){
          let group=0;
          [...body.children].forEach(el=>{
            if(el.tagName==='H4')group++;
            if(group)el.hidden=(ui.section==='skills'?group===1:group>1);
          });
          body.insertAdjacentHTML('beforebegin',`<nav class="section-tabs requirement-tabs" aria-label="Job information">${V.button('section','Requirements','requirements',ui.section!=='skills'?'selected':'',`aria-pressed="${ui.section!=='skills'}"`)}${V.button('section','Skills & duties','skills',ui.section==='skills'?'selected':'',`aria-pressed="${ui.section==='skills'}"`)}</nav>`);
        }
        if(ui.resumeFit!==false)requestAnimationFrame(()=>{
          const canvas=host.querySelector('.resume-canvas'),zoom=host.querySelector('.resume-zoom');
          if(!canvas||!zoom||!zoom.isConnected)return;
          zoom.style.width='600px';zoom.style.minWidth='0';
          const scale=Math.min(1,(canvas.clientWidth-28)/600,(canvas.clientHeight-28)/zoom.scrollHeight);
          if(scale>0)zoom.style.zoom=String(scale);
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
