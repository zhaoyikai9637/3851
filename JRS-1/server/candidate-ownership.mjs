import {httpError} from './security.mjs';

// Ownership is derived from the canonical account link, never from browser flags.
export async function applyCandidateOwnership(db,workspace,{visibleOnly=false}={}) {
 const [rows]=await db.query("SELECT l.recruiting_id,c.account_id FROM JRS_CANDIDATE_LINK l JOIN CANDIDATE c ON c.candidate_id=l.canonical_id JOIN MODULE_ACCOUNT a ON a.account_id=c.account_id WHERE a.role='candidate'");
 const owned=new Set(rows.filter(row=>Number(row.account_id)>0).map(row=>row.recruiting_id));
 const received=new Set(workspace.applications.map(a=>a.candidateId));
 for(const c of workspace.candidates){const applicant=owned.has(c.id);c.profileSource=applicant?'applicant':'hr';c.canEditProfile=!applicant;c.canUploadResume=!applicant;c.canReceiveApplication=!applicant;}
 if(visibleOnly)workspace.candidates=workspace.candidates.filter(c=>received.has(c.id));
 return workspace;
}
export async function assertCandidateReadAccess(pool,id) {
 const [[row]]=await pool.execute("SELECT r.id,a.role,EXISTS(SELECT 1 FROM recruiting_application p WHERE p.candidate_id=r.id) AS has_application FROM recruiting_candidate r LEFT JOIN JRS_CANDIDATE_LINK l ON l.recruiting_id=r.id LEFT JOIN CANDIDATE c ON c.candidate_id=l.canonical_id LEFT JOIN MODULE_ACCOUNT a ON a.account_id=c.account_id WHERE r.id=?",[id]);
 if(!row||!Number(row.has_application))throw httpError(404,'Candidate record is unavailable.');
}
export async function assertManualCandidateEmail(db,address) {
 const [[owned]]=await db.query("SELECT a.account_id FROM MODULE_ACCOUNT a LEFT JOIN CANDIDATE c ON c.account_id=a.account_id WHERE a.role='candidate' AND (a.email=? OR c.email=?) LIMIT 1",[address,address]);
 if(owned)throw httpError(403,'Registered applicants submit their own applications.');
}
