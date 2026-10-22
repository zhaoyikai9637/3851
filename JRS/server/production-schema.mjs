export async function productionSchema(pool) {
 const [[row]]=await pool.query('SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1');
 if(row?.version!==11)throw new Error('Export requires reviewed schema 11.');
 const [tables]=await pool.query("SELECT TABLE_NAME AS name FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
 if(!['hr_user','module_account','jrs_integration_version','recruiting_workspace'].every(name=>tables.some(t=>t.name.toLowerCase()===name)))throw new Error('Required integration tables are missing.');
 // Windows MySQL folds names to lowercase. Linux must retain canonical module
 // names, while the applicant portal and namespaced recruitment tables are lowercase.
 const canonical=name=>name.toLowerCase().startsWith('recruiting_')||['users','applicant_profiles','jobs','resumes','applications'].includes(name.toLowerCase())?name.toLowerCase():name.toUpperCase();
 const statements=['-- Schema-only bootstrap for an EMPTY jrs_production database. Review before import.',
   '-- No accounts, candidates, jobs, sessions, uploads or email history are copied.',
   'SET NAMES utf8mb4;','SET FOREIGN_KEY_CHECKS=0;'];
 for(const {name} of tables){
   if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name))throw new Error('Unexpected table identifier.');
   const [[table]]=await pool.query('SHOW CREATE TABLE `'+name+'`');
   const ddl=table['Create Table'].replace(/\bAUTO_INCREMENT=\d+\s*/g,'')
     .replace(/(CREATE TABLE|REFERENCES) `([A-Za-z][A-Za-z0-9_]*)`/g,(_,prefix,name)=>prefix+' `'+canonical(name)+'`');
   if(/REFERENCES `[^`]+`\s*\./i.test(ddl))throw new Error('Cross-database references require manual review.');
   statements.push(ddl+';');
 }
 statements.push('SET FOREIGN_KEY_CHECKS=1;',
   "INSERT INTO recruiting_workspace(id,revision,created_at,updated_at) VALUES(1,0,UTC_TIMESTAMP(),UTC_TIMESTAMP());",
   'INSERT INTO JRS_INTEGRATION_VERSION(id,version) VALUES(1,11);');
 return statements.join('\n\n')+'\n';
}
