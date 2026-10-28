import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export async function checkReadiness({pool,uploadDir}) {
 const [[row]]=await pool.query({sql:'SELECT version FROM JRS_INTEGRATION_VERSION WHERE id=1',timeout:3000});
 if(row?.version!==12)throw new Error('Unsupported database schema.');
 const probe=path.join(uploadDir,`.readiness-${randomUUID()}`);
 const handle=await fs.open(probe,'wx',0o600);
 try{await handle.writeFile('ready');}finally{await handle.close();await fs.unlink(probe);}
}
export function mountReadiness(app,dependencies) {
 app.get('/health/live',(req,res)=>res.set('Cache-Control','no-store').json({status:'ok'}));
 app.get('/health/ready',async(req,res)=>{
   res.set('Cache-Control','no-store');
   try{await checkReadiness(dependencies);res.json({status:'ready'});}
   catch{res.status(503).json({status:'not-ready'});}
 });
}
