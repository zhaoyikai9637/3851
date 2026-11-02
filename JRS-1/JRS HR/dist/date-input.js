/* App-owned English dates; submitted values remain YYYY-MM-DD in every locale. */
(function(root){
  'use strict';
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let sequence=0,active=null;
  const mirrors=new WeakMap();
  const display=value=>parseISO(value)?value.slice(8,10)+' '+value.slice(5,7)+' '+value.slice(0,4):'';
  function parseDisplay(value){if(!value)return '';const m=/^(\d{2}) (\d{2}) (\d{4})$/.exec(value);if(!m)return null;const iso=m[3]+'-'+m[2]+'-'+m[1];return parseISO(iso)?iso:null;}
  const pad=n=>String(n).padStart(2,'0');
  const iso=(year,month,day)=>String(year).padStart(4,'0')+'-'+pad(month)+'-'+pad(day);
  const count=(year,month)=>[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
  function parseISO(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const [year,month,day]=value.split('-').map(Number);
    return year>=1&&year<=9999&&month>=1&&month<=12&&day>=1&&day<=count(year,month)?{year,month,day}:null;
  }
  function isAllowed(value,min='',max=''){
    return !!parseISO(value)&&(!parseISO(min)||value>=min)&&(!parseISO(max)||value<=max);
  }
  function utcDate(year,month,day){const date=new Date(0);date.setUTCHours(0,0,0,0);date.setUTCFullYear(year,month-1,day);return date;}
  function monthDays(year,month,min='',max=''){
    if(!Number.isInteger(year)||!Number.isInteger(month)||!parseISO(iso(year,month,1)))return [];
    const cells=Array(utcDate(year,month,1).getUTCDay()).fill(null);
    for(let day=1;day<=count(year,month);day++){const date=iso(year,month,day);cells.push({date,day,disabled:!isAllowed(date,min,max)});}
    return cells;
  }
  function today(){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Singapore',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const part=kind=>parts.find(item=>item.type===kind).value;
    return part('year').padStart(4,'0')+'-'+part('month')+'-'+part('day');
  }
  function validate(input){
    const value=parseDisplay(input.value),min=input.getAttribute('min')||'',max=input.getAttribute('max')||'';
    let message='';
    if(!input.value){if(input.required)message='Enter a date in DD MM YYYY format.';}
    else if(value===null)message='Enter a valid date in DD MM YYYY format.';
    else if(parseISO(min)&&value<min)message='Choose a date on or after '+display(min)+'.';
    else if(parseISO(max)&&value>max)message='Choose a date on or before '+display(max)+'.';
    const mirror=mirrors.get(input);if(mirror)mirror.value=!message&&value?value:'';
    input.setCustomValidity(message);input.setAttribute('aria-invalid',String(!!message));
    return !message;
  }
  function hide(restore=false){
    if(!active)return;
    const state=active;active=null;
    state.cleanup();state.popup.remove();state.trigger.setAttribute('aria-expanded','false');
    if(restore&&state.trigger.isConnected)state.trigger.focus({preventScroll:true});
  }
  function pick(state,value){
    const input=state.input;input.value=display(value);validate(input);hide(false);
    const EventType=input.ownerDocument.defaultView.Event;
    input.dispatchEvent(new EventType('change',{bubbles:true}));
    if(input.isConnected)input.focus({preventScroll:true});
  }
  function open(input,trigger){
    if(active?.input===input){hide(true);return;}hide(false);
    const doc=input.ownerDocument,view=doc.defaultView,popup=doc.createElement('div');
    popup.className='english-date-picker';popup.id=trigger.getAttribute('aria-controls');
    popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Choose date');
    const current=today(),initial=parseISO(parseDisplay(input.value))||parseISO(input.getAttribute('min'))||parseISO(current);
    const state={input,trigger,popup,year:initial.year,month:initial.month,focusDate:parseDisplay(input.value)||current,cleanup:()=>{}};active=state;
    const dialog=input.closest('dialog[open]');(dialog||doc.body).append(popup);
    // The popover top layer avoids clipping by the form's scroll container.
    if(typeof popup.showPopover==='function'){popup.setAttribute('popover','manual');popup.showPopover();}
    trigger.setAttribute('aria-expanded','true');
    function position(){
      const rect=trigger.getBoundingClientRect(),width=view.visualViewport?.width||view.innerWidth,height=view.visualViewport?.height||view.innerHeight;
      popup.style.width=Math.max(180,Math.min(286,width-16))+'px';popup.style.maxHeight=Math.max(120,height-16)+'px';
      const box=popup.getBoundingClientRect();
      popup.style.left=Math.max(8,Math.min(rect.right-box.width,width-box.width-8))+'px';
      const below=rect.bottom+6;popup.style.top=Math.max(8,Math.min(below+box.height<=height-8?below:rect.top-box.height-6,height-box.height-8))+'px';
    }
    function control(text,label,action,disabled=false){
      const button=doc.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label);button.dataset.calendarAction=action;button.disabled=disabled;return button;
    }
    function draw(focus=false){
      popup.replaceChildren();
      const heading=doc.createElement('div');heading.className='english-calendar-heading';
      const title=doc.createElement('strong');title.textContent=months[state.month-1]+' '+state.year;title.setAttribute('aria-live','polite');
      heading.append(control('‹','Previous month','previous',state.year===1&&state.month===1),title,control('›','Next month','next',state.year===9999&&state.month===12));popup.append(heading);
      const grid=doc.createElement('div');grid.className='english-calendar-grid';grid.setAttribute('role','group');grid.setAttribute('aria-label',title.textContent);
      weekdays.forEach(day=>{const item=doc.createElement('span');item.className='english-calendar-weekday';item.textContent=day;grid.append(item);});
      const min=input.getAttribute('min')||'',max=input.getAttribute('max')||'';
      monthDays(state.year,state.month,min,max).forEach(cell=>{
        if(!cell){const pad=doc.createElement('span');pad.setAttribute('aria-hidden','true');grid.append(pad);return;}
        const button=control(String(cell.day),months[state.month-1]+' '+cell.day+', '+state.year,'pick',cell.disabled);button.dataset.date=cell.date;
        button.className=cell.date===parseDisplay(input.value)?'is-selected':'';button.setAttribute('aria-pressed',String(cell.date===parseDisplay(input.value)));
        if(cell.date===current)button.setAttribute('aria-current','date');grid.append(button);
      });popup.append(grid);
      const footer=doc.createElement('div');footer.className='english-calendar-footer';footer.append(control('Today','Choose today','today',!isAllowed(current,min,max)),control('Clear','Clear date','clear'));popup.append(footer);position();
      if(focus){const target=popup.querySelector('[data-date="'+state.focusDate+'"]:not(:disabled)')||popup.querySelector('[data-date]:not(:disabled)')||popup.querySelector('button:not(:disabled)');target?.focus({preventScroll:true});}
    }
    function changeMonth(delta){
      let year=state.year,month=state.month+delta;if(month<1){year--;month=12;}if(month>12){year++;month=1;}if(year<1||year>9999)return;
      state.year=year;state.month=month;state.focusDate=iso(year,month,1);draw(true);
    }
    popup.addEventListener('click',event=>{
      const button=event.target.closest('button[data-calendar-action]');if(!button||button.disabled)return;event.preventDefault();
      switch(button.dataset.calendarAction){case 'pick':pick(state,button.dataset.date);break;case 'previous':changeMonth(-1);break;case 'next':changeMonth(1);break;case 'today':pick(state,current);break;case 'clear':pick(state,'');break;}
    });
    popup.addEventListener('keydown',event=>{
      const currentButton=event.target.closest('[data-date]');if(!currentButton)return;
      const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
      if(step){
        event.preventDefault();const date=parseISO(currentButton.dataset.date),next=utcDate(date.year,date.month,date.day+step),value=iso(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate());
        if(!isAllowed(value,input.getAttribute('min')||'',input.getAttribute('max')||''))return;
        const target=parseISO(value);state.year=target.year;state.month=target.month;state.focusDate=value;draw(true);
      }else if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();changeMonth(event.key==='PageUp'?-1:1);}
    });
    const outside=event=>{if(!popup.contains(event.target)&&event.target!==trigger&&!trigger.contains(event.target)&&event.target!==input)hide(false);};
    const escape=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();hide(true);}};
    const scroll=event=>{if(!popup.contains(event.target))hide(false);};
    const dismiss=()=>hide(false);
    doc.addEventListener('pointerdown',outside,true);doc.addEventListener('keydown',escape,true);doc.addEventListener('scroll',scroll,true);view.addEventListener('resize',dismiss);dialog?.addEventListener('close',dismiss);
    state.cleanup=()=>{doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('keydown',escape,true);doc.removeEventListener('scroll',scroll,true);view.removeEventListener('resize',dismiss);dialog?.removeEventListener('close',dismiss);};
    draw(true);
  }
  function mount(host){
    if(!host?.querySelectorAll)return;
    if(active&&!active.input.isConnected)hide(false);
    host.querySelectorAll('input[type="date"]').forEach(input=>{
      const doc=input.ownerDocument,value=input.value;
      const mirror=doc.createElement('input');mirror.type='hidden';mirror.hidden=true;mirror.name=input.name;mirror.value=value;
      if(input.dataset.filter){mirror.dataset.filter=input.dataset.filter;delete input.dataset.filter;}
      input.removeAttribute('name');(input.closest('label')||input).before(mirror);mirrors.set(input,mirror);
      input.type='text';input.value=display(value);input.dataset.englishDate='true';input.placeholder='DD MM YYYY';input.inputMode='numeric';input.autocomplete='off';input.spellcheck=false;input.maxLength=10;input.pattern='\\d{2} \\d{2} \\d{4}';
      if(!input.id)input.id='english-date-'+(++sequence);
      const trigger=doc.createElement('button');trigger.type='button';trigger.className='english-date-trigger';trigger.setAttribute('aria-label','Choose date');trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',input.id+'-calendar');trigger.textContent='▦';
      const wrapper=doc.createElement('div');wrapper.className='english-date-control';
      const label=input.closest('label');
      if(label&&label.querySelectorAll('input,select,textarea').length===1){label.before(wrapper);wrapper.append(label,trigger);label.htmlFor=input.id;}
      else{input.before(wrapper);wrapper.append(input,trigger);}
      let lastAccepted=value;
      trigger.addEventListener('click',event=>{event.preventDefault();open(input,trigger);});
      input.addEventListener('input',()=>validate(input));
      input.addEventListener('change',event=>{
        event.stopImmediatePropagation();
        if(!validate(input)){event.stopImmediatePropagation();input.reportValidity();return;}
        lastAccepted=mirror.value;
        mirror.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
      },true);
      // Some embedded browsers do not emit native change after text editing.
      // Accept a complete filter on blur once, including clearing an old value.
      input.addEventListener('blur',()=>{
        if(mirror.dataset.filter&&input.isConnected&&validate(input)&&mirror.value!==lastAccepted){
          input.dispatchEvent(new doc.defaultView.Event('change',{bubbles:true}));
        }
      });
      input.addEventListener('keydown',event=>{if(event.altKey&&event.key==='ArrowDown'){event.preventDefault();open(input,trigger);}});
      validate(input);
    });
  }
  const api={mount,parseISO,parseDisplay,display,isAllowed,monthDays};root.HRDateInput=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
