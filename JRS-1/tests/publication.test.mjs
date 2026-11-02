import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as publication from '../server/job-publications.mjs';

test('publication dates reject an unpublish day that cuts off the application deadline', () => {
  const fields = { salaryRange:'', publishDate:'2031-01-01', closingDate:'2031-01-31', unpublishDate:'2031-01-31' };
  assert.equal(publication.publicationSchema.safeParse(fields).success, false);
  assert.equal(publication.publicationSchema.safeParse({...fields,unpublishDate:'2031-02-01'}).success, true);
  assert.equal(publication.publicationSchema.safeParse({...fields,unpublishDate:''}).success, true);
});

test('visibility and accepting applications are independent at UTC+08 date boundaries', () => {
  assert.equal(typeof publication.publicationState, 'function');
  const dates = {publishDate:'2031-01-01',closingDate:'2031-01-31',unpublishDate:'2031-02-02'};
  for (const [instant, visible, accepting] of [
    ['2030-12-31T15:59:59.999Z',false,false],
    ['2030-12-31T16:00:00.000Z',true,true],
    ['2031-01-31T15:59:59.999Z',true,true],
    ['2031-01-31T16:00:00.000Z',true,false],
    ['2031-02-01T15:59:59.999Z',true,false],
    ['2031-02-01T16:00:00.000Z',false,false],
  ]) assert.deepEqual(publication.publicationState('Active',dates,new Date(instant)), {visible,accepting});
  assert.deepEqual(publication.publicationState('Closed',dates,new Date('2031-01-15T00:00:00Z')), {visible:false,accepting:false});
  assert.deepEqual(publication.publicationState('Draft',{},new Date('2031-01-15T00:00:00Z')), {visible:false,accepting:false});
});
