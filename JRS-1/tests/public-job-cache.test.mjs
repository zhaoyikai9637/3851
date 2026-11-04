import test from 'node:test';import assert from 'node:assert/strict';import {publicJobCache} from '../server/public-job-cache.mjs';
test('concurrent public catalogue reads share one load and callers cannot mutate cached data',async()=>{
 const cache=publicJobCache();let loads=0,release;const wait=new Promise(r=>release=r);
 const load=async()=>{loads++;await wait;return {jobs:[{title:'Original'}]};};
 const first=cache.read(load),second=cache.read(load);release();const [a,b]=await Promise.all([first,second]);assert.equal(loads,1);a.jobs[0].title='Changed';assert.equal(b.jobs[0].title,'Original');assert.equal((await cache.read(load)).jobs[0].title,'Original');
});
test('a committed change prevents an earlier in-flight read from repopulating the public cache',async()=>{
 const cache=publicJobCache();let release;const pending=cache.read(()=>new Promise(r=>release=r));await Promise.resolve();cache.clear();assert.equal(await cache.read(async()=> 'Published'),'Published');release('Old draft');assert.equal(await pending,'Old draft');assert.equal(await cache.read(async()=>assert.fail('Fresh value must remain cached')),'Published');
});
test('expired catalogue data reloads and failed reads are never cached',async()=>{
 let time=0,loads=0;const cache=publicJobCache({ttlMs:50,now:()=>time}),load=async()=>++loads;
 assert.equal(await cache.read(load),1);time=49;assert.equal(await cache.read(load),1);time=50;assert.equal(await cache.read(load),2);cache.clear();await assert.rejects(cache.read(async()=>{throw Error('Database unavailable');}),/Database/);assert.equal(await cache.read(load),3);
});
