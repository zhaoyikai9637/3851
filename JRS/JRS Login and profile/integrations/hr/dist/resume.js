/* Actual two-page sample PDF and HTML preview share the same content source.
   Only sample resumes are used; no candidate upload is sent anywhere. */
(function(root){
  function content(c,j){return {name:c.name,role:j.title,email:c.email,phone:c.phone,location:c.location,skills:c.skills,education:c.education,summary:`Motivated ${j.title.toLowerCase()} with ${c.experience}+ years of experience. Practical knowledge of ${c.skills.slice(0,3).join(', ')}. Committed to high-quality work, continuous learning and collaborative problem-solving.`,sections:[['WORK EXPERIENCE',`Junior ${j.title} | NexTech Solutions, Singapore`,`JAN 2024 - PRESENT`,`Delivered day-to-day work using ${c.skills.slice(0,2).join(' and ')}.`,`Collaborated with cross-functional teams to improve project outcomes.`,`Documented processes and shared progress with the team.`,`Intern | BrightLabs, Singapore`,`JUN 2023 - DEC 2023`,`Supported project delivery, quality checks and team documentation.`],['EDUCATION',c.education,'2020 - 2023','Relevant coursework: communication, project management and practical industry skills.'],['PROJECTS',`${j.department} improvement project`,`Applied ${c.skills.slice(0,3).join(', ')} to a collaborative team project.`, 'Planned tasks, implemented improvements and presented results.']],page2:[['PROJECT DETAILS',`${j.department} improvement project`,'Role: team contributor','Collected requirements and clarified project goals with stakeholders.','Delivered an initial prototype and iterated after feedback.','Reviewed work with teammates and documented the final outcome.'],['ADDITIONAL EXPERIENCE','Volunteered to support team onboarding and knowledge sharing.','Presented project results and answered stakeholder questions.'],['LANGUAGES','English','Mandarin'],['REFERENCES','Available upon request.'],['DOCUMENT NOTE','This is a fictional sample resume for the JRS frontend demonstration.']]};}
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function html(c,j,page=1){const r=content(c,j);return `<article class="resume-paper"><header class="resume-banner"><span class="avatar">${esc(c.name.split(' ').map(n=>n[0]).join(''))}</span><div><h2>${esc(r.name.toUpperCase())}</h2><strong>${esc(r.role.toUpperCase())}</strong><small>${esc(r.location+' · '+r.phone+' · '+r.email)}</small></div></header>${page===1?`<div class="resume-columns"><aside><h4>CONTACT</h4><p>${esc(r.phone)}</p><p>${esc(r.email)}</p><h4>TECHNICAL SKILLS</h4>${r.skills.map(s=>`<div class="resume-skill"><span>${esc(s)}</span><span class="skill-line"></span></div>`).join('')}<h4>LANGUAGES</h4><p>English</p><p>Mandarin</p><h4>DOCUMENT</h4><p>Sample resume</p><p>Page 1 of 2</p></aside><div><section><h4>PROFESSIONAL SUMMARY</h4><p>${esc(r.summary)}</p></section>${r.sections.map(s=>`<section><h4>${esc(s[0])}</h4>${s.slice(1).map((l,i)=>i===0?`<h5>${esc(l)}</h5>`:`<p>${esc(l)}</p>`).join('')}</section>`).join('')}</div></div>`:`<div class="resume-second">${r.page2.map(s=>`<section><h4>${esc(s[0])}</h4>${s.slice(1).map(l=>`<p>${esc(l)}</p>`).join('')}</section>`).join('')}<p class="muted">Page 2 of 2</p></div>`}</article>`;}
  function pdf(c,j){
    const r=content(c,j),ascii=s=>String(s).replace(/[^\x20-\x7E]/g,' ').replace(/([\\()])/g,'\\$1');
    const wrap=(text,width=90)=>{const lines=[];let line='';for(const w of String(text).split(/\s+/)){if((line+' '+w).length>width&&line){lines.push(line);line=w;}else line+=(line?' ':'')+w;}if(line)lines.push(line);return lines;};
    const pages=[[['PROFESSIONAL SUMMARY',r.summary],['SKILLS',r.skills.join(', ')],...r.sections],r.page2];
    const streams=pages.map((sections,page)=>{
      const text=(value,x,y,size=10,font='F1',color='0.30 0.36 0.46')=>`${color} rg BT /${font} ${size} Tf ${x} ${y} Td (${ascii(value)}) Tj ET\n`;
      let out='0.95 0.97 1 rg 0 705 595 137 re f\n';
      out+=text(r.name.toUpperCase(),45,788,22,'F2','0.10 0.15 0.23');
      out+=text(r.role.toUpperCase(),45,760,11,'F2','0.15 0.37 0.92');
      out+=text(r.location+' | '+r.email+' | '+r.phone,45,735,9);
      let y=675;
      for(const section of sections){
        out+=text(section[0],45,y,11,'F2','0.10 0.15 0.23');
        out+=`0.37 0.55 0.94 RG 0.6 w 45 ${y-7} m 550 ${y-7} l S\n`;y-=26;
        for(const line of section.slice(1).flatMap(l=>wrap(l,88))){out+=text(line,45,y,10.5);y-=16;}
        y-=18;
      }
      out+='0.87 0.90 0.95 RG 0.6 w 45 53 m 550 53 l S\n';
      out+=text('JRS | Fictional sample resume',45,35,9)+text('Page '+(page+1)+' of 2',490,35,9);
      return out;
    });
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 7 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 8 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',...streams.map(s=>`<< /Length ${s.length} >>\nstream\n${s}endstream`)];
    let output='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(output.length);output+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=output.length;output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Blob([output],{type:'application/pdf'});
  }
  root.HRResume={content,html,pdf};if(typeof module!=='undefined')module.exports=root.HRResume;
})(typeof window!=='undefined'?window:globalThis);
