import express from 'express';
import path from 'node:path';
import {httpError} from './security.mjs';
import {workFacts} from './applicant-facts.mjs';
import {locationLabel} from '../JRS Applicant Portal/shared/contactFields.js';
export async function addSubmittedMaterials(pool,workspace) {
 const [rows]=await pool.query('SELECT l.recruiting_id,l.applicant_snapshot,f.file_name,f.file_type FROM JRS_APPLICATION_LINK l JOIN applications a ON a.id=l.portal_id LEFT JOIN JRS_RESUME_LINK r ON r.portal_id=a.resume_id LEFT JOIN RESUME_FILE f ON f.file_id=r.canonical_id');
 const byId=new Map(rows.map(r=>[r.recruiting_id,r]));
 for(const a of workspace.applications){const row=byId.get(a.id);if(!row?.applicant_snapshot)continue;
  const snapshot=typeof row.applicant_snapshot==='string'?JSON.parse(row.applicant_snapshot):row.applicant_snapshot;
  a.submission={candidate:{name:snapshot.fullName,email:snapshot.email,phone:snapshot.phone,location:locationLabel(snapshot.location),...workFacts(snapshot.experiences),education:(snapshot.education||[]).map(e=>[e.qualification,e.institution].filter(Boolean).join(' · ')).join('; ')||'Not recorded'},resumeUrl:row.file_name?'/recruitment/api/hr/applications/'+encodeURIComponent(a.id)+'/submitted-resume':null,resumeName:row.file_name,resumeType:row.file_type};
 }
 const [hidden]=await pool.query("SELECT l.recruiting_id FROM JRS_CANDIDATE_LINK l JOIN CANDIDATE c ON c.candidate_id=l.canonical_id WHERE c.availability_status=\'CLOSED\' AND NOT EXISTS (SELECT 1 FROM recruiting_application a WHERE a.candidate_id=l.recruiting_id)");
 const excluded=new Set(hidden.map(row=>row.recruiting_id));workspace.candidates=workspace.candidates.filter(c=>!excluded.has(c.id));
 return workspace;
}
export function submittedMaterialsRouter({pool,requireUser,uploadDir}) {
 const router=express.Router();router.use(requireUser);
 router.get('/:id/submitted-resume',async(req,res,next)=>{
  try{
   const [[file]]=await pool.execute('SELECT f.file_name,f.file_type,f.storage_key FROM JRS_APPLICATION_LINK l JOIN applications a ON a.id=l.portal_id JOIN JRS_RESUME_LINK r ON r.portal_id=a.resume_id JOIN RESUME_FILE f ON f.file_id=r.canonical_id JOIN CANDIDATE c ON c.candidate_id=f.candidate_id AND c.account_id=l.account_id WHERE l.recruiting_id=?',[req.params.id]);
   if(!file||!/^[a-f0-9]{64}$/.test(file.storage_key))throw httpError(404,'Submitted document is unavailable.');
   const pdf=file.file_type==='application/pdf',download=req.query.download==='1'||!pdf;
   res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.type(file.file_type);
   res.set('Content-Disposition',`${download?'attachment':'inline'}; filename="resume"; filename*=UTF-8''${encodeURIComponent(file.file_name.replace(/[\r\n]/g,''))}`);
   res.sendFile(path.join(uploadDir,file.storage_key),{dotfiles:'allow'},error=>{if(error)next(error);});
  }catch(error){next(error);}
 });
 router.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(error.status||500).json({error:{message:error.status?error.message:'Submitted document could not be read.'}});});
 return router;
}
