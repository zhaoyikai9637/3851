import { describe, it, expect, vi } from 'vitest';
import { assertDatabaseWriteAllowed, inspectMigrationTarget, moduleTables } from '../src/database-safety.js';
import { up, down } from '../src/migrations/001-module.js';
import { seedDemo } from '../src/seed.js';

const safe={NODE_ENV:'test',INTEGRATION_MODE:'standalone',DB_NAME:'jrs_hr_module_test_fixture',DB_WRITE_CONFIRMED:'jrs_hr_module_test_fixture',DB_USER:'test-user',DB_PASSWORD:'test-fixture-only'};
describe('database write guards (no database connection)', () => {
  it('permits an explicitly confirmed, dedicated test target', () => expect(() => assertDatabaseWriteAllowed(safe,'test')).not.toThrow());
  it.each([{DB_NAME:'jrs_db'},{DB_WRITE_CONFIRMED:''},{DB_WRITE_CONFIRMED:'another-db'},{DB_USER:'root'},{DB_PASSWORD:'replace_password'},{INTEGRATION_MODE:'team'},{NODE_ENV:'production'}])('blocks unsafe targets %j', patch => expect(() => assertDatabaseWriteAllowed({...safe,...patch})).toThrow());
  it('prevents the MySQL suite from using the dev database', () => expect(() => assertDatabaseWriteAllowed({...safe,DB_NAME:'jrs_hr_module_dev_fixture',DB_WRITE_CONFIRMED:'jrs_hr_module_dev_fixture'},'test')).toThrow());
  it('preflights unrelated tables without issuing write queries', async () => {
    const query=vi.fn(),db={getQueryInterface:()=>({showAllTables:async()=>['TEAM_PAYROLL']}),query};
    await expect(inspectMigrationTarget(db)).rejects.toThrow('unrelated');expect(query).not.toHaveBeenCalled();
  });
  it('recognizes an empty database and a completely applied migration', async () => {
    expect(await inspectMigrationTarget({getQueryInterface:()=>({showAllTables:async()=>[]})})).toEqual({initialized:false});
    const db={getQueryInterface:()=>({showAllTables:async()=>[...moduleTables,'SequelizeMeta']}),query:vi.fn().mockResolvedValue([[{name:'001-module'}]])};
    expect(await inspectMigrationTarget(db)).toEqual({initialized:true});
  });
  it('refuses partial DDL state and does not delete tables', async () => {
    const db={getQueryInterface:()=>({showAllTables:async()=>['HR_USER','SequelizeMeta']}),query:vi.fn().mockResolvedValue([[]])};
    await expect(inspectMigrationTarget(db)).rejects.toThrow('Incomplete');
  });
  it.each(moduleTables)('initial migration catches table conflict %s before createTable', async table => {
    const context={showAllTables:vi.fn().mockResolvedValue([table]),createTable:vi.fn()};
    await expect(up({context})).rejects.toThrow();expect(context.createTable).not.toHaveBeenCalled();
  });
  it('keeps destructive rollback disabled', async () => await expect(down()).rejects.toThrow('disabled'));
});

describe('seed content and sequential idempotency (mock model only)', () => {
  it('creates two HRs, five templates and visibly simulated histories; preserves edits', async () => {
    const rows={},models={};
    for(const [key,idField] of Object.entries({HrUser:'userId',Account:'accountId',Candidate:'candidateId',Job:'positionId',Application:'applicationId',Template:'templateId',Notification:'notificationId',Log:'logId'})) {
      rows[key]=[];
      models[key]={findOrCreate:async ({where,defaults}) => {
        const existing=rows[key].find(row=>Object.entries(where).every(([k,v])=>row[k]===v));
        if(existing) return [existing,false];
        const row={...defaults,...where,[idField]:rows[key].length+1};rows[key].push(row);return [row,true];
      }};
    }
    const db={transaction:async callback=>callback({})};
    await seedDemo(db,models,{password:'test-fixture-only-password'});
    const counts=Object.fromEntries(Object.entries(rows).map(([key,value])=>[key,value.length]));
    expect(counts).toMatchObject({HrUser:2,Account:2,Template:5,Notification:4,Log:8});
    expect(rows.Log.every(row=>row.isDemo && row.emailBody.includes('SIMULATED'))).toBe(true);
    expect(rows.Log.filter(row=>row.deliveryStatus!=='SENT').every(row=>row.sentAt===null)).toBe(true);
    expect(rows.Account.every(row=>row.passwordHash.startsWith('$2'))).toBe(true);
    rows.Template[0].body='Locally edited'; rows.Template[1].isActive=false;
    const originalHash=rows.Account[0].passwordHash;
    await seedDemo(db,models,{password:'different-test-only-password'});
    expect(Object.fromEntries(Object.entries(rows).map(([key,value])=>[key,value.length]))).toEqual(counts);
    expect(rows.Template[0].body).toBe('Locally edited');expect(rows.Template[1].isActive).toBe(false);expect(rows.Account[0].passwordHash).toBe(originalHash);
  });
  it('rejects missing seed secrets before starting a transaction', async () => {
    const transaction=vi.fn();await expect(seedDemo({transaction},{},{password:'replace_example'})).rejects.toThrow('SEED_PASSWORD');expect(transaction).not.toHaveBeenCalled();
  });
});
