import {createRuntime} from '../server/runtime.mjs';
import {loadSettings} from '../server/config.mjs';
import {assertReviewSettings} from '../server/review-policy.mjs';
import {createReviewMailbox} from '../server/review-mailbox.mjs';
const settings=loadSettings();assertReviewSettings(settings);
const site=await createRuntime({mailTransport:createReviewMailbox(settings)});
const server=site.app.listen(settings.port,settings.host,()=>console.log('Local reviewer site: '+settings.origin+'/jobs\nMail and reset codes: npm run review:mailbox\nPress Ctrl+C to stop the website; review:stop stops its MySQL instance.'));
server.once('error',async error=>{console.error('Reviewer website stopped:',error.code||'LISTEN_ERROR');await site.close();process.exitCode=1;});
let closing=false;async function close(){if(closing)return;closing=true;await new Promise(resolve=>server.close(resolve));await site.close();}
process.on('SIGINT',()=>close().catch(()=>{process.exitCode=1;}));process.on('SIGTERM',()=>close().catch(()=>{process.exitCode=1;}));
