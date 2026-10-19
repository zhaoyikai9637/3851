// Archived assessment helper coverage only; recruitment no longer uses this policy.
const test=globalThis.test??require('node:test').test;
const assert=require('node:assert/strict');
const S=require('../dist/screening.js');
const M=require('../dist/state.js');
const asOf='2026-06-30';
const person=extra=>({educationLevel:'Bachelor degree',educationMajor:'Computer Science',graduationDate:'2024-06-15',experience:0,graduateStatus:'Fresh graduate',...extra});
const role=extra=>({minimumEducationLevel:'Bachelor degree',acceptedMajors:['Computer Science'],...extra});
const assess=(c={},j={},date=asOf)=>S.assess(person(c),role(j),date);

test('qualified historical graduates pass using facts, even when legacy status and experience disagree',()=>{
  const result=assess();assert.equal(result.allowed,true);assert.equal(result.status,'Eligible');assert.equal(result.graduateStatus,'Not a fresh graduate');
  assert.equal(result.reason,'');assert.deepEqual(result.reasons,[]);
  assert.equal(result.checks.length,3);assert.ok(result.checks.every(check=>check.status==='Met'));
  assert.equal(S.assess(person(),role(),asOf).allowed,true);assert.equal(M.screening,S);
});

test('fresh graduate means graduation in the assessment calendar year, not the last twelve months',()=>{
  const fresh=assess({graduationDate:'2026-01-01',graduateStatus:'Experienced',experience:20});
  assert.equal(fresh.allowed,false);assert.equal(fresh.status,'Not eligible');assert.equal(fresh.graduateStatus,'Fresh graduate');assert.match(fresh.reason,/fresh graduate/i);
  const boundary=assess({graduationDate:'2025-12-31'}, {},'2026-01-01');assert.equal(boundary.allowed,true);assert.equal(boundary.graduateStatus,'Not a fresh graduate');
  const newYear=assess({graduationDate:'2026-12-31'}, {},'2027-01-01');assert.equal(newYear.allowed,true);
});

test('future graduation cannot pass even when the date is in the current calendar year',()=>{
  for(const graduationDate of ['2026-07-01','2027-01-01']){
    const result=assess({graduationDate,graduateStatus:'Experienced'});assert.equal(result.allowed,false);assert.equal(result.status,'Not eligible');assert.equal(result.graduateStatus,'Not graduated');
  }
});

test('missing graduation and structured education stay unknown instead of being inferred from legacy text or flags',()=>{
  for(const legacy of ['Experienced','Fresh graduate','Not recorded',undefined]){
    const result=assess({graduateStatus:legacy,graduationDate:null,education:'Master of Computer Science',experience:10});
    assert.equal(result.allowed,false);assert.equal(result.status,'Information required');assert.equal(result.graduateStatus,'Not recorded');
  }
  for(const educationLevel of ['Not recorded',undefined]){
    const result=assess({educationLevel,education:'Degree in Computer Science'});assert.equal(result.allowed,false);assert.equal(result.status,'Information required');
  }
});

test('all seven structured education levels obey the complete minimum qualification ordering',()=>{
  const levels=['Secondary school','Certificate','Diploma','Associate degree','Bachelor degree','Master degree','Doctorate'];
  for(let actual=0;actual<levels.length;actual++)for(let minimum=0;minimum<levels.length;minimum++){
    const result=assess({educationLevel:levels[actual]},{minimumEducationLevel:levels[minimum],acceptedMajors:[]});
    assert.equal(result.allowed,actual>=minimum,levels[actual]+' compared with '+levels[minimum]);
    assert.equal(result.status,actual>=minimum?'Eligible':'Not eligible');
  }
});

test('an explicitly unrestricted degree criterion differs from a job with no screening configuration',()=>{
  assert.equal(assess({educationLevel:'Secondary school'},{minimumEducationLevel:'Any qualification',acceptedMajors:[]}).allowed,true);
  for(const minimumEducationLevel of ['Not configured',undefined]){
    const result=assess({}, {minimumEducationLevel});assert.equal(result.allowed,false);assert.equal(result.status,'Information required');
  }
  assert.equal(S.assess(person(),undefined,asOf).allowed,false);
});

test('major matching handles explicit CS and IT aliases and normalizes case without fuzzy substring matches',()=>{
  for(const [educationMajor,acceptedMajors] of [
    ['CS',['Computer Science']],['computer science',['CS']],[' IT ',['Information Technology']],['INFORMATION TECHNOLOGY',['IT']],[' Computer   Science ',['computer science']]
  ])assert.equal(assess({educationMajor},{acceptedMajors}).allowed,true,educationMajor);
  for(const [educationMajor,acceptedMajors] of [
    ['Computer Science',['Information Technology']],['Computer Science Education',['Computer Science']],['Accounting',['Computer Science']],['Business Information Systems',['Information Technology']],['Mechanical Engineering',['Engineering']]
  ])assert.equal(assess({educationMajor},{acceptedMajors}).allowed,false,educationMajor+' cannot be loosely inferred to match');
});

test('multiple accepted majors allow any exact match; no restrictions do not require a major',()=>{
  assert.equal(assess({educationMajor:'Accounting'},{acceptedMajors:['Finance','Accounting']}).allowed,true);
  assert.equal(assess({educationMajor:''},{acceptedMajors:[]}).allowed,true);
  const result=assess({educationMajor:''});assert.equal(result.allowed,false);assert.equal(result.status,'Information required');
});

test('the assessment retains every failed reason and evidence instead of hiding degree or major mismatches',()=>{
  const result=assess({graduationDate:'2026-01-01',educationLevel:'Diploma',educationMajor:'Accounting'});
  assert.equal(result.allowed,false);assert.equal(result.status,'Not eligible');assert.equal(result.reasons.length,3);
  assert.equal(result.checks.filter(check=>check.status==='Not met').length,3);
  assert.match(result.reasons.join(' '),/fresh graduate/i);assert.match(result.reasons.join(' '),/education|qualification|degree/i);assert.match(result.reasons.join(' '),/major|fields? of study/i);
});

test('invalid dates never become an eligible applicant or a rollover graduation date',()=>{
  for(const graduationDate of ['2025-02-29','2024-02-30','2024-13-01','16/06/2024','not-a-date'])assert.equal(assess({graduationDate}).allowed,false,graduationDate);
  assert.equal(assess({graduationDate:'2024-02-29'}).allowed,true);
});

test('assessment is read-only and re-evaluates the same person against each position',()=>{
  const c=person(),j=role(),before=JSON.stringify({c,j});assert.equal(S.assess(c,j,asOf).allowed,true);assert.equal(JSON.stringify({c,j}),before);
  assert.equal(S.assess(c,role({minimumEducationLevel:'Master degree'}),asOf).allowed,false);
  assert.equal(S.assess(c,role({acceptedMajors:['Accounting']}),asOf).allowed,false);
});
