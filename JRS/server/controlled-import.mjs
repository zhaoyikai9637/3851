import {createHash} from 'node:crypto';

export const importTables=['CANDIDATE','JOB_POSITION','EMAIL_TEMPLATE','APPLICATION'];
const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const digest=value=>createHash('sha256').update(stable(value)).digest('hex');
const naturalKeys={CANDIDATE:'email',EMAIL_TEMPLATE:'template_name',JOB_POSITION:'title'};
const normalized=value=>String(value??'').trim().toLowerCase();
export function planControlledImport(batch,schema,existing) {
 const plan={version:1,baselineDigest:digest(existing),schemaDigest:digest(schema),inserts:[],skipped:[],conflicts:[]};
 if(!batch?.rows||typeof batch.rows!=='object'||Array.isArray(batch.rows))throw new Error('Provide rows grouped by canonical table name.');
 const staged={};
 for(const name of Object.keys(batch.rows))if(!importTables.includes(name))plan.conflicts.push({table:name,reason:'Table is outside the business import allowlist.'});
 for(const table of importTables){
  if(!Object.hasOwn(batch.rows,table))continue;
  const meta=schema[table],rows=batch.rows[table];
  if(!meta||!Array.isArray(rows)||rows.length>1000){plan.conflicts.push({table,reason:'Invalid schema or batch; at most 1,000 rows per table.'});continue;}
  staged[table]=[];
  for(const source of rows){
   const conflict=reason=>plan.conflicts.push({table,sourceId:source?.[meta.key],reason});
   if(!source||typeof source!=='object'||Array.isArray(source)||Object.keys(source).some(k=>!meta.columns.includes(k))){conflict('Unknown columns or invalid row.');continue;}
   const row={...source},mapped=batch.idMap?.[table]?.[row[meta.key]];
   if(mapped!==undefined)row[meta.key]=mapped;
   if(!Number.isSafeInteger(row[meta.key])||row[meta.key]<1){conflict('An explicit positive target primary key is required.');continue;}
   if(table==='CANDIDATE'&&row.account_id!=null){conflict('Account identity cannot be attached by a business import.');continue;}
   if(table==='CANDIDATE'&&(!row.email||!/^\S+@\S+\.\S+$/.test(row.email))){conflict('A valid candidate email is required.');continue;}
   if((meta.required||[]).some(k=>row[k]==null)){conflict('Required business columns are missing.');continue;}
   if(Object.values(row).some(v=>v!==null&&typeof v==='object')){conflict('Use SQL scalar values; encode JSON columns as JSON strings.');continue;}
   for(const fk of meta.foreignKeys||[])if(row[fk.column]!=null&&batch.idMap?.[fk.table]?.[row[fk.column]]!==undefined)row[fk.column]=batch.idMap[fk.table][row[fk.column]];
   const known=[...(existing[table]||[]),...staged[table]];
   const sameId=known.find(r=>String(r[meta.key])===String(row[meta.key]));
   if(sameId){
    if(Object.entries(row).every(([k,v])=>stable(sameId[k])===stable(v)))plan.skipped.push({table,sourceId:source[meta.key],targetId:row[meta.key]});
    else conflict('Primary key conflicts with authoritative data. Supply a reviewed idMap or omit this row.');
    continue;
   }
   const natural=naturalKeys[table];
   if(natural&&row[natural]&&known.some(r=>normalized(r[natural])===normalized(row[natural]))){conflict(`Existing ${natural} identity requires review; existing rows are never overwritten.`);continue;}
   const missing=(meta.foreignKeys||[]).find(fk=>row[fk.column]!=null&&![...(existing[fk.table]||[]),...(staged[fk.table]||[])].some(r=>String(r[fk.target])===String(row[fk.column])));
   if(missing){conflict(`Unresolved reference: ${missing.column}. Supply an explicit idMap to an existing or imported parent.`);continue;}
   staged[table].push(row);plan.inserts.push({table,row});
  }
 }
 return {...plan,digest:digest(plan)};
}
export function approveImport(plan,approvedDigest){
 const {digest:expected,...body}=plan;
 if(digest(body)!==expected)throw new Error('The preview changed; regenerate it before applying.');
 if(expected!==approvedDigest)throw new Error('The approved digest does not match the current database preview.');
 if(plan.conflicts.length)throw new Error('Resolve all import conflicts before applying.');
 return plan.inserts;
}

export async function inspectImport(connection,batch){
 const schema={},existing={};
 for(const table of importTables){
  const [columns]=await connection.query('SHOW COLUMNS FROM '+connection.escapeId(table));
  const keys=columns.filter(c=>c.Key==='PRI');if(keys.length!==1)throw new Error('Review table primary key: '+table);
  const [foreignKeys]=await connection.execute('SELECT COLUMN_NAME AS `column`,REFERENCED_TABLE_NAME AS `table`,REFERENCED_COLUMN_NAME AS target FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL',[table]);
  for(const fk of foreignKeys)fk.table=fk.table.toUpperCase();
  schema[table]={key:keys[0].Field,columns:columns.map(c=>c.Field),required:columns.filter(c=>c.Null==='NO'&&c.Default===null&&!c.Extra.includes('auto_increment')).map(c=>c.Field),foreignKeys};
  [existing[table]]=await connection.query('SELECT * FROM '+connection.escapeId(table)+' ORDER BY '+connection.escapeId(keys[0].Field));
 }
 for(const meta of Object.values(schema))for(const fk of meta.foreignKeys)if(!existing[fk.table]){
  // External references are identifiers only; never load authentication records.
  if(fk.table!=='HR_USER'&&fk.table!=='MODULE_ACCOUNT')throw new Error('Review external reference: '+fk.table);
  [existing[fk.table]]=await connection.query('SELECT '+connection.escapeId(fk.target)+' FROM '+connection.escapeId(fk.table)+' ORDER BY '+connection.escapeId(fk.target));
 }
 return planControlledImport(batch,schema,existing);
}
export async function applyControlledImport(connection,batch,approvedDigest){
 const plan=await inspectImport(connection,batch),operations=approveImport(plan,approvedDigest);
 for(const {table,row}of operations){
  const columns=Object.keys(row);
  await connection.execute('INSERT INTO '+connection.escapeId(table)+' ('+columns.map(k=>connection.escapeId(k)).join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')',Object.values(row));
 }
 return plan;
}
