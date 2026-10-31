import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('./',import.meta.url));
const files=readdirSync(new URL('./test/',import.meta.url)).filter(name=>name.endsWith('.test.js')).sort().map(name=>'test/'+name);
const result=spawnSync(process.execPath,['--test',...files],{cwd,env:{...process.env,DB_MODE:'demo',NODE_ENV:'test'},stdio:'inherit'});
if(result.error)console.error('Unable to start isolated applicant tests.');
process.exitCode=result.status??1;
