import express from 'express';
import {createRequire} from 'node:module';
import {httpError} from './security.mjs';
const require=createRequire(import.meta.url),M=require('../JRS HR/dist/state.js');
export function applicationCommunicationRouter({pool,requireUser,native=false}){
 const router=express.Router();
 router.get('/:id/communication-context',requireUser,async(req,res,next)=>{try{
  const id=req.params.id;if(native?!/^[A-Za-z0-9_-]{1,100}$/.test(id):!(/^[1-9]\d*$/.test(id)&&Number(id)<=2147483647))throw httpError(404,'Application not found.');
  const [[row]]=await pool.execute(`SELECT l.canonical_id AS applicationId,l.recruiting_id AS recruitingId,r.stage AS currentStatus,c.full_name AS candidateName,j.title AS positionTitle FROM JRS_HR_APPLICATION_LINK l JOIN recruiting_application r ON r.id=l.recruiting_id JOIN APPLICATION a ON a.application_id=l.canonical_id JOIN CANDIDATE c ON c.candidate_id=a.candidate_id JOIN JOB_POSITION j ON j.position_id=a.position_id WHERE l.${native?'recruiting_id':'canonical_id'}=?`,[id]);
  if(!row)throw httpError(404,'Application not found.');
  const [[templates],[meetings],[events],[offers]]=await Promise.all([
   pool.execute('SELECT id,name,kind,active FROM recruiting_email_template WHERE active=1'),
   pool.execute("SELECT id FROM recruiting_interview WHERE application_id=? AND status='Scheduled'",[row.recruitingId]),
   pool.execute("SELECT from_stage AS source FROM recruiting_audit_log WHERE application_id=? AND to_stage='Rejected' ORDER BY at_time DESC,id DESC LIMIT 1",[row.recruitingId]),
   pool.execute('SELECT approval,expiry,status FROM recruiting_offer WHERE id=?',[row.recruitingId])
  ]);
  const a={id:row.recruitingId,stage:row.currentStatus,offer:offers[0]},db={interviews:meetings.map(i=>({...i,applicationId:a.id,status:'Scheduled'})),activity:events.map(e=>({applicationId:a.id,to:'Rejected',from:e.source}))};
  res.set('Cache-Control','no-store').json({...row,applicationId:Number(row.applicationId),eligibleTemplateIds:templates.filter(t=>M.templateAllowed(db,a,t)).map(t=>/^canonical-template-(\d+)$/.exec(t.id)?.[1]).filter(Boolean).map(Number)});
 }catch(error){next(error);}});
 router.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(error.status||500).json({error:{message:error.status?error.message:'Application context could not be loaded.'}});});return router;
}
