import assert from 'node:assert/strict';
import {test} from 'node:test';
import {jobBulletPoints} from '../jrs-hr-module/shared/job-text.mjs';
import {editorPublicationSchema,publicationSchema} from '../server/job-publications.mjs';
test('job bullets preserve literal text and split existing paragraphs without splitting decimal values',()=>{
  assert.deepEqual(jobBulletPoints(['• Build APIs\r\n- Review code','1. Support C++','3.5 years experience','<script>alert(1)</script>']),['Build APIs','Review code','Support C++','3.5 years experience','<script>alert(1)</script>']);
});
test('current publication input omits the retired field while retaining visible date checks',()=>{
  const fields={salaryRange:'SGD 5,000',publishDate:'2031-01-01',closingDate:'2031-01-31'};
  assert.equal(editorPublicationSchema.safeParse(fields).success,true);
  assert.equal(editorPublicationSchema.safeParse({...fields,closingDate:'2030-01-01'}).success,false);
  assert.equal(editorPublicationSchema.safeParse({...fields,closingDate:'2031-02-30'}).success,false);
  assert.equal(editorPublicationSchema.safeParse({...fields,unpublishDate:''}).success,false);
  assert.equal(publicationSchema.safeParse({...fields,unpublishDate:'2031-02-01'}).success,true);
});
