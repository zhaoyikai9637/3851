import test from 'node:test';import assert from 'node:assert/strict';import {notificationTimeRepairs,repairNotificationTimes} from '../server/notification-time-repair.mjs';
const old={id:1,eventKey:'recruiting:event-1',savedAt:'2026-11-03 21:26:46',sourceAt:'2026-11-03T13:26:46.835Z'};
test('timestamp repairs derive each UTC instant from its own source rather than shifting every row',()=>{
 const result=notificationTimeRepairs([old,{...old,id:2,savedAt:'2026-11-03 13:26:46'},{...old,id:3,sourceAt:'2026-11-03 13:26:46'},{...old,id:4,sourceAt:'2026-11-03T21:26:46+08:00'},{...old,id:5,sourceAt:'2026-02-30T13:26:46Z'}]);
 assert.deepEqual(result.changes.map(r=>r.id),[1,4]);assert.ok(result.changes.every(r=>r.expectedAt==='2026-11-03 13:26:46'));assert.deepEqual(result.skipped,[3,5]);
});
test('previewing notification repairs cannot write data or create a backup',async()=>{
 const result=await repairNotificationTimes({query:async sql=>{assert.ok(!sql.includes('FOR UPDATE'));return [[old]];},getConnection:()=>assert.fail('Preview must not open a write transaction')},{backup:()=>assert.fail('Preview must not write a file')});
 assert.equal(result.corrected,0);assert.equal(result.changes.length,1);
});
test('timestamp repair takes a durable backup before updating and commits only the selected linked rows',async()=>{
 const events=[];const db={beginTransaction:async()=>events.push('begin'),query:async sql=>{assert.match(sql,/JOIN recruiting_system_notification/);assert.match(sql,/FOR UPDATE$/);return [[old]];},execute:async(sql,params)=>{events.push('write');assert.equal(sql,'UPDATE SYSTEM_NOTIFICATION SET created_at=? WHERE notification_id=? AND event_key=? AND created_at=?');assert.deepEqual(params,['2026-11-03 13:26:46',1,'recruiting:event-1','2026-11-03 21:26:46']);return [{affectedRows:1}];},commit:async()=>events.push('commit'),rollback:async()=>events.push('rollback'),release:()=>events.push('release')};
 const result=await repairNotificationTimes({getConnection:async()=>db},{apply:true,backup:async rows=>{events.push('backup');assert.equal(rows[0].savedAt,old.savedAt);return 'private-backup.json';}});
 assert.equal(result.corrected,1);assert.deepEqual(events,['begin','backup','write','commit','release']);
});
test('backup failure or a concurrent change rolls the notification repair back',async()=>{
 for(const failure of ['backup','conflict']){
  const events=[],db={beginTransaction:async()=>{},query:async()=>[[old]],execute:async()=>{events.push('write');return [{affectedRows:0}];},commit:async()=>assert.fail('Failed repair must not commit'),rollback:async()=>events.push('rollback'),release:()=>events.push('release')};
  await assert.rejects(repairNotificationTimes({getConnection:async()=>db},{apply:true,backup:async()=>{if(failure==='backup')throw Error('Backup unavailable');return 'backup.json';}}));
  assert.deepEqual(events,failure==='backup'?['rollback','release']:['write','rollback','release']);
 }
});
