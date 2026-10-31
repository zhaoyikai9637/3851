import test from 'node:test';
import assert from 'node:assert/strict';
import {formatDate,formatDateTime,parseDisplayDate} from '../jrs-hr-module/shared/date-format.mjs';
test('visible dates keep the Singapore day at UTC boundaries and zero-pad days and months',()=>{
  assert.equal(formatDate('2026-10-22T16:30:00Z'),'23 10 2026');
  assert.equal(formatDate('2032-02-09'),'09 02 2032');
  assert.match(formatDateTime('2026-10-22T16:30:00Z'),/^23 10 2026, /);
  assert.equal(formatDate(null),'');
});
test('day month year parsing rejects rollover and ambiguous formats before producing ISO bounds',()=>{
  assert.equal(parseDisplayDate('29 02 2032'),'2032-02-29');
  assert.equal(parseDisplayDate(''),'');
  for(const value of ['29 02 2031','31 04 2031','2031-04-30','30/04/2031','1 2 2031','01 01 0000'])assert.equal(parseDisplayDate(value),null,value);
});
