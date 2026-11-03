import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const reviewRoot=fileURLToPath(new URL('../',import.meta.url));
export const reviewDirectory=path.join(reviewRoot,'.local','review');
export function assertReviewSettings(env) {
 if(env.DB_MODE!=='review'||env.NODE_ENV!=='development'||env.DB_HOST!=='127.0.0.1'||Number(env.DB_PORT)!==33307||env.DB_NAME!=='jrs_review_local'||env.DB_USER!=='jrs_review_app'||env.HOST!=='127.0.0.1'||Number(env.PORT)!==3200||env.APP_ORIGIN!=='http://localhost:3200')throw Error('Review mode requires its isolated loopback database on 33307 and application on 3200.');
 if(env.JRS_STORAGE_PROVIDER!=='local'||path.resolve(env.JRS_DATA_DIR||'.')!==path.join(reviewDirectory,'data')||env.CANDIDATE_MAIL_PROVIDER!=='smtp'||env.SMTP_HOST!=='local-capture.invalid'||env.SMTP_ENABLED!=='true')throw Error('Review mode requires private local files and a captured mail transport.');
 if(env.RENDER||env.RAILWAY_SERVICE_ID)throw Error('Review mode cannot run on a hosting service.');
}
