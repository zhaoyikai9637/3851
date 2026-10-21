/* Application review and interview results share a scrollable document viewer. */
(function(root){
  const V=HRViews,{e,button,link,candidate,job,badge}=V;
  function requirementsRows(j){
    // Render the saved criteria as written: no generated filler or hidden truncation.
    return [...j.requirements];
  }
  function jobDetails(j){
    const rows=requirementsRows(j),complete=rows.length>=8&&rows.length<=12;
    const information=[['Department',j.department],['Employment type',j.type],['Work arrangement',j.mode],['Location',j.location]];
    return `<section class="job-information"><h3>Job Description</h3><p class="job-description-text">${e(j.description)}</p><h3>Job Requirements</h3>${!complete?'<p class="requirements-incomplete">This position needs 8–12 requirements. '+link('jobs','Complete in Job Postings')+'</p>':''}<ol class="job-requirements-list">${rows.map(row=>'<li>'+e(row)+'</li>').join('')}</ol><details class="job-facts-section"><summary>Job Information</summary><dl class="job-facts">${information.map(([label,value])=>'<dt>'+e(label)+'</dt><dd>'+e(value)+'</dd>').join('')}</dl></details></section>`;
  }
  function viewer(db,a,ui){
    const original=candidate(db,a),c={...original,...(a.submission?.candidate||{})},submitted=a.submission?.resumeUrl,j=job(db,a),sample=!c.resume&&/^candidate-\d+$/.test(c.id),available=!!submitted||!!c.resume||sample;
    const filename=a.submission?.resumeName||c.resume?.filename||(sample?c.name.replaceAll(' ','_')+'_Resume.pdf':'No document uploaded');
    const content=submitted?(a.submission.resumeType==='application/pdf'?`<iframe class="uploaded-resume" src="${e(submitted)}#view=FitH" title="${e(c.name)} submitted resume"></iframe>`:`<div class="empty-state"><a class="button secondary" href="${e(submitted)}?download=1">Download submitted document</a></div>`):c.resume?`<iframe class="uploaded-resume" src="/api/hr/candidates/${encodeURIComponent(c.id)}/resume#view=FitH" title="${e(c.name)} resume"></iframe>`:sample?`<div class="resume-zoom resume-pages">${HRResume.html(c,j,1)}${HRResume.html(c,j,2)}</div>`:V.empty('No resume uploaded','Use Upload to add the applicant’s PDF.');
    const controls=submitted?`<a class="button secondary compact" href="${e(submitted)}?download=1">Download submitted resume</a>`:c.resume?`<a class="button secondary compact" href="/api/hr/candidates/${encodeURIComponent(c.id)}/resume" target="_blank" rel="noopener">Open PDF</a>`:sample?`${button('resume-fit','Fit width','','secondary compact')}${button('resume-actual','100%','','secondary compact')}${button('zoom',icon('minus'),'-10','icon-button','aria-label="Zoom out"')}<span class="zoom-label">${ui.resumeFit!==false?'Fit width':ui.zoom+'%'}</span>${button('zoom',icon('plus'),'10','icon-button','aria-label="Zoom in"')}`:'';
    return `<section class="panel resume-viewer" id="resume-viewer" aria-label="Applicant resume"><div class="resume-toolbar"><strong title="${e(filename)}">${e(filename)}</strong><div>${button('resume-upload','Upload',c.id,'secondary compact')}${button('resume-download',icon('download')+'Download',a.id,'secondary compact',available?'':'disabled')}${button('resume-print',icon('print')+'Print',a.id,'secondary compact',available&&(!submitted||a.submission.resumeType==='application/pdf')?'':'disabled')}${button('fullscreen',icon('expand'),'','icon-button','aria-label="Fullscreen resume"')}</div></div>${controls?'<div class="resume-view-controls">'+controls+'</div>':''}<div class="resume-canvas" tabindex="0" aria-label="Scrollable resume">${content}</div></section>`;
  }
  function heading(db,a,results){
    const c=candidate(db,a),j=job(db,a),list=db.applications.filter(x=>x.stage===(results?'Interview Results':'Pending Review')||x.id===a.id),index=list.findIndex(x=>x.id===a.id),route=results?'results':'review';
    return `<div class="review-heading"><div class="review-person">${V.avatar(c)}<div><h2>${e(c.name)}</h2><p>${e(j.title)} · ${e(a.id)}</p></div>${badge(a.stage)}</div><div class="heading-actions">${link(V.applicationPath(results?'Interview Results':a.stage),icon('back')+'Back to list','button secondary compact')}${index>0?link(route+'/'+list[index-1].id,'Previous','button secondary compact'):''}${index<list.length-1?link(route+'/'+list[index+1].id,'Next','button secondary compact'):''}${link('candidate/'+c.id+'/'+a.id,'Applicant details','button secondary compact')}</div></div>`;
  }
  function resultsContent(db,a){
    const f=a.feedback,meetings=db.interviews.filter(i=>i.applicationId===a.id).sort((x,y)=>(y.date+y.time).localeCompare(x.date+x.time));
    return `<section class="result-feedback"><h3>Interview feedback</h3>${f?`<div class="result-score"><strong>${e(f.rating)}<small> / 5</small></strong><span>${e(f.recommendation)}</span></div>${V.assessmentSummary(f.assessment)}<p class="feedback-notes">${e(f.notes)}</p><p class="muted">Recorded ${V.datetime(f.recordedAt)}</p>`:V.empty('Feedback not available','Complete feedback from the Interviews page.')}<h3>Interview details</h3>${meetings.length?meetings.map(i=>`<article class="result-meeting"><strong>${V.date(i.date)} · ${e(i.time)}</strong>${badge(i.status)}<p>${e(i.interviewer)} · ${e(i.format)} · ${i.duration} min</p><p class="muted">${e(i.location)}</p>${i.notes?'<p class="feedback-notes">'+e(i.notes)+'</p>':''}</article>`).join(''):'<p class="muted">No interview record is available.</p>'}</section>`;
  }
  function render(route,db,ui){
    const a=db.applications.find(a=>a.id===route[1]);if(!a)return V.empty('Application not found','Return to Applications and select an existing record.');
    const c=candidate(db,a),j=job(db,a),results=route[0]==='results',canAdvance=j.status==='Active';
    let decisions;
    if(results&&a.stage==='Interview Results')decisions=button('offer-edit','Prepare Offer',a.id,'primary',canAdvance&&a.feedback?'':'disabled')+button('reject','Reject',a.id,'danger');
    else if(!results&&a.stage==='Pending Review')decisions=button('move-interview','Move to Interview',a.id,'primary',canAdvance?'':'disabled')+button('reject','Reject',a.id,'danger');
    else decisions=button('application','View current stage',a.id,'primary');
    const details=results?resultsContent(db,a)+`<details class="result-job-details"><summary>Job Description & Requirements</summary>${jobDetails(j)}</details>`:jobDetails(j);
    return heading(db,a,results)+`<div class="review-grid ${results?'results-grid':''}">${viewer(db,a,ui)}<aside class="panel requirements"><div class="requirements-body" tabindex="0">${details}</div><div class="next-step"><div class="review-decision-actions">${decisions}${button('activity','Activity',a.id,'secondary')}</div>${j.status!=='Active'?'<p class="danger-text">Activate this job before progressing applicants.</p>':''}</div></aside></div>`;
  }
  root.HRReview={render,requirementsRows,jobDetails,viewer};
})(window);
