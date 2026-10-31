import { describe, it, expect, vi } from 'vitest';
import { assertDatabaseWriteAllowed, inspectMigrationTarget, moduleTables } from '../src/database-safety.js';
import { up, down } from '../src/migrations/001-module.js';
import { seedDevelopment } from '../src/seed.js';

const safe={NODE_ENV:'test',INTEGRATION_MODE:'standalone',DB_NAME:'jrs_hr_module_test_fixture',DB_WRITE_CONFIRMED:'jrs_hr_module_test_fixture',DB_USER:'test-user',DB_PASSWORD:'test-fixture-only'};
describe('database write guards (no database connection)', () => {
  it('permits an explicitly confirmed, dedicated test target', () => expect(() => assertDatabaseWriteAllowed(safe,'test')).not.toThrow());
  it('permits migrations against an explicitly confirmed shared integration target', () => {
    const shared={...safe,NODE_ENV:'development',INTEGRATION_MODE:'team',DB_NAME:'jrs_hr_module_dev_team',DB_WRITE_CONFIRMED:'jrs_hr_module_dev_team',DB_SHARED_INTEGRATION_CONFIRMED:'jrs_hr_module_dev_team'};
    expect(() => assertDatabaseWriteAllowed(shared,'migration')).not.toThrow();
  });
  it('permits team runtime access without enabling migration writes', () => {
    const runtime={...safe,NODE_ENV:'development',INTEGRATION_MODE:'team',DB_NAME:'jrs_hr_module_dev_team',DB_WRITE_CONFIRMED:'',DB_SHARED_INTEGRATION_CONFIRMED:'',DB_USER:'dev_zhaoyikai'};
    expect(() => assertDatabaseWriteAllowed(runtime,'runtime')).not.toThrow();
  });
  it('blocks seed data and incomplete confirmation in team mode', () => {
    const shared={...safe,NODE_ENV:'development',INTEGRATION_MODE:'team',DB_NAME:'jrs_hr_module_dev_team',DB_WRITE_CONFIRMED:'jrs_hr_module_dev_team',DB_SHARED_INTEGRATION_CONFIRMED:'jrs_hr_module_dev_team'};
    expect(() => assertDatabaseWriteAllowed(shared,'seed')).toThrow();
    expect(() => assertDatabaseWriteAllowed({...shared,DB_SHARED_INTEGRATION_CONFIRMED:''},'migration')).toThrow();
  });
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

describe('development baseline and sequential idempotency (mock model only)', () => {
  it('creates one local HR profile and five templates while preserving edits', async () => {
    const rows={},models={};
    for(const [key,idField] of Object.entries({HrUser:'userId',Template:'templateId'})) {
      rows[key]=[];
      models[key]={findOrCreate:async ({where,defaults}) => {
        const existing=rows[key].find(row=>Object.entries(where).every(([k,v])=>row[k]===v));
        if(existing) return [existing,false];
        const row={...defaults,...where,[idField]:rows[key].length+1};rows[key].push(row);return [row,true];
      }};
    }
    const db={transaction:async callback=>callback({})};
    await seedDevelopment(db,models);
    const counts=Object.fromEntries(Object.entries(rows).map(([key,value])=>[key,value.length]));
    expect(counts).toMatchObject({HrUser:1,Template:5});
    rows.Template[0].body='Locally edited'; rows.Template[1].isActive=false;
    await seedDevelopment(db,models);
    expect(Object.fromEntries(Object.entries(rows).map(([key,value])=>[key,value.length]))).toEqual(counts);
    expect(rows.Template[0].body).toBe('Locally edited');expect(rows.Template[1].isActive).toBe(false);
  });
});
