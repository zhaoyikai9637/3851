import { fileURLToPath } from 'node:url';
import { createDatabase } from './db.js';
import { defineModels } from './models.js';
import { createServices } from './services.js';
import { loadConfig } from './config.js';
import { DatabaseSessionStore } from './session-store.js';
import { createApp } from './app.js';
import { loadIdentityAdapter } from './team-auth.js';
import { assertDatabaseWriteAllowed } from './database-safety.js';
// Module CSRF session persistence writes only to the approved dedicated database.
assertDatabaseWriteAllowed();
const config=loadConfig();
const db=createDatabase(); const models=defineModels(db);
try {
  await db.authenticate();
  // No sync({force:true}) or sync({alter:true}). Migrations are explicit commands.
  await models.Session.count();
  const identity=await loadIdentityAdapter(config,models);
  const app=createApp({identity,services:createServices(models,config),config,sessionStore:new DatabaseSessionStore(models.Session),staticDir:fileURLToPath(new URL('../../client/dist',import.meta.url))});
  const server=app.listen(config.port,config.host,()=>console.log(`JRS API ready at http://${config.host}:${config.port}; docs: /api/docs`));
  const {Op}=await import('sequelize');
  const cleanup=setInterval(()=>models.Session.destroy({where:{expires:{[Op.lt]:new Date()}}}).catch(()=>console.error('Session cleanup failed')),3600000); cleanup.unref();
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{clearInterval(cleanup);server.close(async()=>{await db.close();process.exit(0);});});
} catch(e) {console.error('Startup failed. Check MySQL and run npm run db:migrate.',e.message);await db.close();process.exitCode=1;}
