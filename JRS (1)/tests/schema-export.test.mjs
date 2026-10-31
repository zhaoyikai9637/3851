import test from 'node:test';
import assert from 'node:assert/strict';
import {productionSchema} from '../server/production-schema.mjs';
test('production bootstrap exports table definitions and empty workspace metadata, never accounts or job records',async()=>{
 let version=12;
 const queries=[];
 const pool={query:async sql=>{
  queries.push(sql);
  if(sql.startsWith('SELECT version'))return [[{version}]];
  if(sql.startsWith('SELECT TABLE_NAME'))return [[...['hr_user','module_account','jrs_integration_version','recruiting_workspace'].map(name=>({name}))]];
  const table=sql.match(/^SHOW CREATE TABLE `([\w]+)`$/)?.[1];
  if(table)return [[{'Create Table':`CREATE TABLE \`${table}\` (id INT PRIMARY KEY) ENGINE=InnoDB AUTO_INCREMENT=234`}]];
  throw Error('Unexpected data query');
 }};
 const sql=await productionSchema(pool);
 assert.match(sql,/CREATE TABLE `MODULE_ACCOUNT`/);
 assert.doesNotMatch(sql,/AUTO_INCREMENT=234|DROP TABLE|INSERT INTO.*MODULE_ACCOUNT/);
 assert.match(sql,/INSERT INTO JRS_INTEGRATION_VERSION.*12/);
 assert.ok(queries.every(q=>q.startsWith('SELECT version')||q.startsWith('SELECT TABLE_NAME')||q.startsWith('SHOW CREATE TABLE')));
 version=10;await assert.rejects(()=>productionSchema(pool),/schema 12/);
});
