import {useLoad,ErrorBox,Loading} from '../../src/shared';
const missing=value=>value===null?'Not recorded with this application.':'Not provided.';
export function PersonalProfileFields({profile,includeName=true}){
 if(!profile)return <p className="muted">No personal information was recorded.</p>;
 const section=(title,content)=><section className="spaced"><h4>{title}</h4>{content}</section>;
 const records=(rows,render)=>Array.isArray(rows)&&rows.length?rows.map((row,i)=><article className="note-box spaced" key={i}>{render(row)}</article>):<p className="muted">{missing(rows)}</p>;
 const month=value=>String(value||'').replace(/^(\d{4})-(\d{2}).*$/,'$2 $1');
 const period=row=>`${month(row.start)||'Start not provided'} — ${row.current?'Present':month(row.end)||'End not provided'}`;
 const languageNames=(field)=>(profile.languages||[]).filter(row=>row[field]===true).map(row=>row.name+(row[field+'Level']?' ('+row[field+'Level']+')':'')).join(', ');
 return <div className="hr-personal-profile">
  {includeName&&<dl className="details"><dt>Name</dt><dd>{profile.name}</dd><dt>Email</dt><dd>{profile.email}</dd><dt>Phone</dt><dd>{profile.phone||'Not provided'}</dd><dt>Location</dt><dd>{profile.location||'Not provided'}</dd></dl>}
  {section('Personal Summary',profile.summary?<p className="feedback-notes">{profile.summary}</p>:<p className="muted">{missing(profile.summary)}</p>)}
  {section('Career History',records(profile.career,row=><><strong>{row.title}</strong><p>{row.company}</p><small>{period(row)}</small>{row.description&&<p className="feedback-notes">{row.description}</p>}{row.achievements&&<p className="feedback-notes">{row.achievements}</p>}</>))}
  {section('Education',records(profile.education,row=><><strong>{row.qualification}</strong><p>{row.institution}</p><small>{row.current?'Expected finish: '+(month(row.expectedEnd)||'Not specified'):'Finished '+(row.finishedYear||'Not specified')}</small>{row.description&&<p>{row.description}</p>}</>))}
  {section('Licences & Certifications',records(profile.certifications,row=><><strong>{row.name}</strong><p>{row.issuer}</p><small>{[row.issue?'Issued '+month(row.issue):'',row.noExpiry?'No expiry':row.expiry?'Expires '+month(row.expiry):''].filter(Boolean).join(' · ')||'Dates not provided'}</small>{row.description&&<p>{row.description}</p>}</>))}
  {section('Skills',profile.skills?.length?<div className="skill-tags">{profile.skills.map(skill=><span key={skill}>{skill}</span>)}</div>:<p className="muted">{missing(profile.skills)}</p>)}
  {section('Languages',profile.languages?.length?<article className="note-box spaced">{languageNames('reading')&&<p>Reading: {languageNames('reading')}</p>}{languageNames('writing')&&<p>Writing: {languageNames('writing')}</p>}{profile.languages.filter(row=>row.reading==null&&row.writing==null).map((row,index)=><p key={index}>{row.name} (reading/writing not recorded)</p>)}</article>:<p className="muted">{missing(profile.languages)}</p>)}
 </div>;
}
export function CandidatePersonalInformation({person,application,current=false}){
 const enabled=person.profileSource==='applicant';
 const load=useLoad(enabled?'/recruitment/api/hr/candidates/'+encodeURIComponent(person.id)+'/profile':null);
 if(!enabled)return null;
 const profile=current?load.data?.currentProfile:load.data?.applications?.find(row=>row.id===application.id)?.profileDetails;
 const content=load.busy?<Loading/>:load.error?<ErrorBox error={load.error} retry={load.reload}/>:<PersonalProfileFields profile={profile} includeName={!current}/>;
 return current?<section className="spaced" aria-label="Current personal information"><h3>Current Personal Information</h3><p className="muted">Maintained by the applicant. Submitted details remain recorded with the application.</p>{content}</section>:<details className="submitted-profile-details"><summary>Candidate personal information</summary>{content}</details>;
}
