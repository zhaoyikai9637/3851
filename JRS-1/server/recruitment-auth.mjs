import {createHash} from 'node:crypto';
import {httpError,verifySharedWrite} from './security.mjs';

// Read identity and revocation state on every request; never cache permissions.
export async function requireRecruitmentUser(req,pool,origin) {
 const raw=String(req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('jrs_candidate_session='))?.slice('jrs_candidate_session='.length);
 if(!/^[a-f0-9]{64}$/.test(raw||''))throw httpError(401,'Please sign in.');
 const sid='candidate:'+createHash('sha256').update(raw).digest('hex');
 const [[row]]=await pool.execute(`SELECT a.account_id,a.email AS account_email,a.role AS account_role,
  CASE WHEN JSON_VALID(s.data) THEN JSON_UNQUOTE(JSON_EXTRACT(s.data,'$.csrf')) END AS csrf,
  h.user_id AS hr_id,h.account_status AS hr_status,h.role AS hr_role,h.full_name AS hr_name,
  h.email AS hr_email,h.department AS hr_department,h.phone AS hr_phone,h.office_location AS hr_office,
  r.id,r.name,r.email,r.role,r.status,r.employee_id,r.department,r.phone,r.office_location
  FROM MODULE_SESSION s
  JOIN MODULE_ACCOUNT a ON a.account_id=CASE WHEN JSON_VALID(s.data) THEN JSON_UNQUOTE(JSON_EXTRACT(s.data,'$.account_id')) END
  LEFT JOIN HR_USER h ON h.user_id=a.hr_user_id
  LEFT JOIN recruiting_user r ON r.id=CONCAT('team-hr-',h.user_id)
  WHERE s.sid=? AND s.expires>UTC_TIMESTAMP()
  AND CASE WHEN JSON_VALID(s.data) THEN JSON_TYPE(JSON_EXTRACT(s.data,'$.account_id')) END='INTEGER'
  AND CASE WHEN JSON_VALID(s.data) THEN JSON_UNQUOTE(JSON_EXTRACT(s.data,'$.module')) END='jrs-candidate'`,[sid]);
 if(!row)throw httpError(401,'Please sign in.');
 if(row.account_role!=='hr')throw httpError(403,'HR access only.');
 if(!row.hr_id||row.hr_status!=='ACTIVE'||!['HR_MANAGER','HR_STAFF'].includes(row.hr_role))throw httpError(401,'HR profile is inactive.');
 if(!row.id||row.status!=='Active'||row.role!==row.hr_role)throw httpError(403,'HR workspace identity does not match.');
 const account={account_id:row.account_id,email:row.account_email,role:row.account_role,hr_user_id:row.hr_id,csrf:row.csrf,sid};
 verifySharedWrite(req,account,origin);
 const values=[row.hr_name,row.hr_email,row.hr_department,row.hr_phone||'',row.hr_office||''];
 const stored=[row.name,row.email,row.department,row.phone||'',row.office_location||''];
 if(values.some((value,index)=>value!==stored[index]))await pool.execute('UPDATE recruiting_user SET name=?,email=?,department=?,phone=?,office_location=? WHERE id=?',[...values,row.id]);
 req.sharedAccount=account;
 req.user={id:row.id,email:row.hr_email,name:row.hr_name,role:row.hr_role,status:row.status,employeeId:row.employee_id,department:row.hr_department,phone:row.hr_phone||'',officeLocation:row.hr_office||''};
 req.session={csrf:row.csrf};
}