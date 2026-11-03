import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {assertReviewSettings,reviewDirectory} from '../server/review-policy.mjs';
import {childEnvironment} from '../scripts/review/environment.mjs';
const valid={DB_MODE:'review',NODE_ENV:'development',DB_HOST:'127.0.0.1',DB_PORT:'33307',DB_NAME:'jrs_review_local',DB_USER:'jrs_review_app',HOST:'127.0.0.1',PORT:'3200',APP_ORIGIN:'http://localhost:3200',JRS_STORAGE_PROVIDER:'local',JRS_DATA_DIR:path.join(reviewDirectory,'data'),CANDIDATE_MAIL_PROVIDER:'smtp',SMTP_HOST:'local-capture.invalid',SMTP_ENABLED:'true'};
test('review mode accepts only its dedicated local target and private storage',()=>{
 assert.doesNotThrow(()=>assertReviewSettings(valid));
 for(const [key,value] of Object.entries({DB_HOST:'cloud.example.test',DB_PORT:'3306',DB_NAME:'jrs_production',DB_USER:'root',NODE_ENV:'production',HOST:'0.0.0.0',PORT:'3000',JRS_STORAGE_PROVIDER:'supabase',SMTP_HOST:'smtp.example.test',JRS_DATA_DIR:path.join(reviewDirectory,'other'),RENDER:'true',RAILWAY_SERVICE_ID:'test'}))assert.throws(()=>assertReviewSettings({...valid,[key]:value}),key);
});
test('review children exclude inherited cloud credentials and configuration',()=>{
 const keys={MAILJET_SECRET_KEY:'inherited',SUPABASE_SECRET_KEY:'inherited',JRS_MAIL_ENV_FILE:'private.env',DB_HOST:'cloud',RENDER:'true'};
 const saved={};for(const key of Object.keys(keys)){saved[key]=process.env[key];process.env[key]=keys[key];}
 try{const result=childEnvironment(valid);assert.equal(result.DB_HOST,'127.0.0.1');for(const key of ['MAILJET_SECRET_KEY','SUPABASE_SECRET_KEY','JRS_MAIL_ENV_FILE','RENDER'])assert.equal(result[key],undefined);}finally{for(const key of Object.keys(keys))if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
});
