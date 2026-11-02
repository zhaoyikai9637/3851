import assert from 'node:assert/strict';
import { test } from 'node:test';
const facts = await import('../server/applicant-facts.mjs').catch(error => { if (error.code === 'ERR_MODULE_NOT_FOUND') return {}; throw error; });
test('overlapping employment is not counted twice during HR integration', () => {
  assert.equal(typeof facts.workFacts, 'function', 'Applicant experience mapping is missing');
  const result = facts.workFacts([{ startDate: '2021-01', endDate: '2023-01', currentRole: false, skills: 'JavaScript, SQL' }, { startDate: '2022-01', endDate: '2024-01', currentRole: false, skills: 'SQL, React' }], '2026-10');
  assert.equal(result.experience, 3.1);
  assert.deepEqual(result.skills, ['JavaScript', 'SQL', 'React']);
});

test('HR uses inclusive months and displays the standardized skill labels',()=>{
 const result=facts.workFacts([{startDate:'2026-10',endDate:'2026-10',currentRole:false,skills:['REACT','SQL']}],'2026-10');
 assert.equal(result.experience,0.1);assert.deepEqual(result.skills,['React','SQL']);
});
test('current roles use the current month and invalid date ranges are refused', () => {
  assert.equal(typeof facts.workFacts, 'function', 'Applicant experience mapping is missing');
  assert.equal(facts.workFacts([{ startDate: '2024-01', currentRole: true }], '2026-10').experience, 2.8);
  assert.throws(() => facts.workFacts([{ startDate: '2026-13', endDate: '2027-01' }], '2026-10'), /month/i);
  assert.throws(() => facts.workFacts([{ startDate: '2025-01', endDate: '2024-01' }], '2026-10'), /range/i);
});
