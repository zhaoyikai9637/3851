/* Legacy education utility for data compatibility and archived policy tests only.
 * Current recruitment workflows use HR review and do not call this assessment.
 * Only structured education and graduation data determine eligibility.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HRScreening=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LEVELS=Object.freeze(['Secondary school','Certificate','Diploma','Associate degree','Bachelor degree','Master degree','Doctorate']);
  const UNKNOWN='Not recorded',ANY='Any qualification',UNCONFIGURED='Not configured';
  const key=value=>String(value??'').normalize('NFKC').trim().toLowerCase().replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
  const missing=value=>!String(value??'').trim()||['not recorded','not specified','unknown','n a'].includes(key(value));
  const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);

  function isDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const [year,month,day]=value.split('-').map(Number);
    if(year<1900||year>2100||month<1||month>12||day<1||day>31)return false;
    const d=new Date(Date.UTC(year,month-1,day));
    return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;
  }

  function parseMajors(value){
    const seen=new Set(),result=[];
    for(const item of (Array.isArray(value)?value:[value]).flatMap(x=>typeof x==='string'?x.split(/[,\n;]+/):[])){
      const major=item.trim(),normal=major.toLocaleLowerCase('en');
      if(major&&!seen.has(normal)){seen.add(normal);result.push(major);}
    }
    return result;
  }

  // These aliases describe the same discipline; related disciplines are never inferred.
  const aliasGroups=[
    ['Information Technology','IT','I.T.'],['Computer Science','CS','C.S.'],
    ['Information Systems','IS'],['Management Information Systems','MIS'],
    ['Human-Computer Interaction','Human Computer Interaction','HCI'],
    ['Human Resources','Human Resource Management','HR','HRM'],
    ['Communications','Communication'],['Business','Business Studies'],
    ['Business Administration','Business Admin'],['Data Analytics','Data Analysis']
  ];
  const aliases=new Map();
  for(const group of aliasGroups)for(const alias of group)aliases.set(key(alias),key(group[0]));
  const majorKey=value=>aliases.get(key(value))||key(value);

  function levelLabel(value){return LEVELS.includes(value)||value===ANY||value===UNCONFIGURED?value:UNKNOWN;}

  function assess(candidate={},job={},asOf=today()){
    if(!isDate(asOf))throw Error('Choose a valid screening date.');
    candidate=candidate||{};job=job||{};
    const checks=[],check=(key,label,status,reason)=>checks.push({key,label,status,reason});
    const minimum=job.minimumEducationLevel,level=candidate.educationLevel;
    if(minimum===ANY){
      check('education','Education','Met','This job has no minimum education level.');
    }else if(!LEVELS.includes(minimum)){
      check('education','Education','Information required','The minimum education requirement has not been configured for this job.');
    }else if(!LEVELS.includes(level)){
      check('education','Education','Information required','A recognised education level is required.');
    }else if(LEVELS.indexOf(level)<LEVELS.indexOf(minimum)){
      check('education','Education','Not met',level+' does not meet the minimum requirement of '+minimum+'.');
    }else{
      check('education','Education','Met',level+' meets the minimum requirement of '+minimum+'.');
    }

    const accepted=parseMajors(job.acceptedMajors),major=String(candidate.educationMajor??'').trim();
    if(!accepted.length){
      check('major','Field of study','Met','This job accepts any field of study.');
    }else if(missing(major)){
      check('major','Field of study','Information required','The applicant’s field of study is required.');
    }else if(!accepted.some(value=>majorKey(value)===majorKey(major))){
      check('major','Field of study','Not met',major+' does not match the accepted fields of study: '+accepted.join(', ')+'.');
    }else{
      check('major','Field of study','Met',major+' matches an accepted field of study.');
    }

    let graduateStatus=UNKNOWN;
    if(!isDate(candidate.graduationDate)){
      check('graduation','Graduation','Information required','A valid graduation date is required to determine graduate status.');
    }else{
      const year=Number(candidate.graduationDate.slice(0,4)),current=Number(asOf.slice(0,4));
      if(candidate.graduationDate>asOf){
        graduateStatus='Not graduated';
        check('graduation','Graduation','Not met','The applicant has not graduated and cannot progress to interviews or offers.');
      }else if(year===current){
        graduateStatus='Fresh graduate';
        check('graduation','Graduation','Not met','Applicants graduating in '+current+' are fresh graduates and cannot progress to interviews or offers.');
      }else{
        graduateStatus='Not a fresh graduate';
        check('graduation','Graduation','Met','Graduation was before the current calendar year ('+current+').');
      }
    }
    const status=checks.some(value=>value.status==='Not met')?'Not eligible':checks.some(value=>value.status==='Information required')?'Information required':'Eligible';
    const reasons=checks.filter(value=>value.status!=='Met').map(value=>value.reason);
    return {allowed:status==='Eligible',status,graduateStatus,checks,reasons,reason:reasons.join(' ')};
  }

  function inferLegacyEducation(text){
    const raw=String(text??'').trim(),normal=key(raw),found=[];
    const patterns=[
      ['Doctorate',/\b(?:doctorate|doctor of|ph[.\s]*d|phd)\b/i],
      ['Master degree',/\b(?:master(?:s|['’]s)?|m\s*sc|msc|mba|m\s*eng|meng)\b/i],
      ['Bachelor degree',/\b(?:bachelor(?:s|['’]s)?|b\s*sc|bsc|b\s*eng|beng|bba|btech)\b/i],
      ['Associate degree',/\bassociate(?:s|['’]s)?(?: degree)?\b/i],
      ['Diploma',/\bdiploma\b/i],['Certificate',/\bcertificate\b/i],
      ['Secondary school',/\b(?:secondary school|high school|o levels?|a levels?)\b/i]
    ];
    for(const [level,pattern]of patterns)if(pattern.test(raw))found.push(level);
    if(!found.length&&/\bdegree\b/i.test(raw))found.push('Bachelor degree');
    // Ambiguous combined qualifications need the applicant to provide structured data.
    if(found.length!==1||/\b(?:or|and) (?:a )?(?:diploma|degree|bachelor|master|doctorate|certificate)\b/i.test(raw))return {educationLevel:UNKNOWN,educationMajor:''};
    let major='';
    const inMatch=raw.match(/\bin\s+(.+)$/i);
    if(inMatch)major=inMatch[1].trim().replace(/[.;]+$/,'');
    else{
      const ofMatch=raw.match(/\b(?:Bachelor|Master|Doctor)(?:['’]s)?\s+of\s+(.+)$/i);
      if(ofMatch)major=ofMatch[1].trim().replace(/[.;]+$/,'');
    }
    if(!normal||/\b(?:or a related|related discipline|equivalent)\b/i.test(major))major='';
    return {educationLevel:found[0],educationMajor:major};
  }

  const roles=Object.freeze({
    'Software Developer':['Computer Science','Information Technology'],
    'UI Designer':['Design','Human-Computer Interaction'],
    'Data Analyst':['Data Analytics','Statistics','Computer Science'],
    'Marketing Executive':['Marketing','Communications','Business'],
    'Support Officer':['Business','Information Technology'],
    'System Analyst':['Information Systems','Computer Science'],
    'Backend Engineer':['Computer Science','Information Technology'],
    'HR Business Partner':['Human Resources','Business'],
    'DevOps Engineer':['Computer Science','Information Technology'],
    'Finance Executive':['Accounting','Finance']
  });
  function defaultJobCriteria(title){
    const majors=Object.prototype.hasOwnProperty.call(roles,title)?roles[title]:null;
    return {minimumEducationLevel:majors?'Diploma':UNCONFIGURED,acceptedMajors:majors?[...majors]:[]};
  }

  return Object.freeze({LEVELS,UNKNOWN,ANY,UNCONFIGURED,isDate,parseMajors,levelLabel,assess,inferLegacyEducation,defaultJobCriteria});
});
