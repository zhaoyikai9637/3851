import { httpError } from './security.mjs';
import { publicationState } from './job-publications.mjs';
import templateVariables from '../jrs-hr-module/shared/template-variables.json' with {type:'json'};

const publicStatus = stage => ({ 'Pending Review': 'Submitted', Interview: 'Interview', Offer: 'Decision', Hired: 'Accepted', Rejected: 'Rejected' }[stage] || 'In Review');
const templateKind = type => ({ INTERVIEW_INVITE: 'Interview Invite', OFFER_LETTER: 'Offer Letter', ACCEPTED: 'Accepted', REJECTED: 'Rejected', APPLICATION_REJECTION: 'Application Rejection', INTERVIEW_REJECTION: 'Interview Rejection', OFFER_WITHDRAWAL: 'Offer Withdrawal', OFFER_DECLINED_ACKNOWLEDGEMENT: 'Offer Declined Acknowledgement' }[type] || 'In Progress');
const convertVariables = value => value.replace(/\[([A-Za-z][A-Za-z0-9_]*)\]/g, (original, key) => Object.hasOwn(templateVariables,key) ? '{{'+templateVariables[key]+'}}' : original);

export function createRecruitmentBridge(pool, { experimentalApplicantPortal = false } = {}) {
  async function templates(connection) {
    const [rows] = await connection.query('SELECT * FROM EMAIL_TEMPLATE');
    for (const t of rows) await connection.execute('INSERT INTO recruiting_email_template(id,name,kind,subject,body,active,updated_at) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),kind=VALUES(kind),subject=VALUES(subject),body=VALUES(body),active=VALUES(active),updated_at=VALUES(updated_at)', [
      `canonical-template-${t.template_id}`, t.template_name, templateKind(t.usage_type), convertVariables(t.subject), convertVariables(t.body), Number(t.is_active), new Date(t.updated_at).toISOString(),
    ]);
  }

  async function mirror(connection, before, after) {
    const [[owner]] = await connection.query("SELECT user_id FROM HR_USER WHERE account_status='ACTIVE' ORDER BY user_id LIMIT 1");
    if (!owner) throw httpError(409, 'An active canonical HR profile is required.');
    for (const job of after.jobs) {
      const [[link]] = await connection.execute('SELECT * FROM JRS_JOB_LINK WHERE recruiting_id=?', [job.id]);
      const [[publication]] = await connection.execute('SELECT * FROM JRS_JOB_PUBLICATION WHERE recruiting_id=?', [job.id]);
      const open = publicationState(job.status,{publishDate:publication?.publish_date,unpublishDate:publication?.unpublish_date,closingDate:publication?.closing_date}).accepting;
      const fields = [job.title, job.department, job.location, job.mode, job.type, job.experience, publication?.salary_range || '', job.description.slice(0, 500), JSON.stringify([job.description]), JSON.stringify(job.requirements), '[]', '[]', '[]', publication?.closing_date || null, open];
      let portalId = link?.portal_id ?? null;
      if (experimentalApplicantPortal) {
        if (portalId !== null) {
          await connection.execute('UPDATE jobs SET title=?,department=?,location=?,work_mode=?,employment_type=?,experience_level=?,salary_range=?,summary=?,responsibilities=?,requirements=?,preferred_qualifications=?,benefits=?,role_questions=?,closing_date=?,is_open=?,updated_at=UTC_TIMESTAMP() WHERE id=?', [...fields, portalId]);
        } else {
          const [inserted] = await connection.execute('INSERT INTO jobs(title,department,location,work_mode,employment_type,experience_level,salary_range,summary,responsibilities,requirements,preferred_qualifications,benefits,role_questions,closing_date,is_open,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())', fields);
          portalId = inserted.insertId;
        }
      }
      if (link) {
        await connection.execute('UPDATE JOB_POSITION SET title=?,updated_at=UTC_TIMESTAMP() WHERE position_id=?', [job.title, link.canonical_id]);
        if (experimentalApplicantPortal && link.portal_id === null) await connection.execute('UPDATE JRS_JOB_LINK SET portal_id=? WHERE recruiting_id=?', [portalId, job.id]);
      } else {
        await connection.execute('INSERT INTO JOB_POSITION(title) VALUES(?)', [job.title]);
        const [[canonical]] = await connection.query('SELECT LAST_INSERT_ID() AS id');
        await connection.execute('INSERT INTO JRS_JOB_LINK(recruiting_id,portal_id,canonical_id) VALUES(?,?,?)', [job.id, portalId, canonical.id]);
      }
    }
    for (const c of after.candidates) {
      const [[link]] = await connection.execute('SELECT canonical_id FROM JRS_CANDIDATE_LINK WHERE recruiting_id=?', [c.id]);
      if(link) {
        const previous=before.candidates?.find(row=>row.id===c.id);
        const fields={};
        for(const [key,column] of [['name','full_name'],['email','email'],['phone','contact_number'],['location','home_location']])if(previous&&previous[key]!==c[key])fields[column]=c[key];
        if(Object.hasOwn(fields,'contact_number'))fields.country_code='';
        if(Object.hasOwn(fields,'home_location'))fields.structured_location=null;
        const keys=Object.keys(fields);
        if(keys.length)await connection.execute('UPDATE CANDIDATE SET '+keys.map(key=>'\`'+key+'\`=?').join(',')+' WHERE candidate_id=?',[...Object.values(fields),link.canonical_id]);
      }
      if (!link) {
        await connection.execute('INSERT INTO CANDIDATE(full_name,email) VALUES(?,?)', [c.name, c.email]);
        const [[canonical]] = await connection.query('SELECT LAST_INSERT_ID() AS id');
        await connection.execute('INSERT INTO JRS_CANDIDATE_LINK(recruiting_id,canonical_id) VALUES(?,?)', [c.id, canonical.id]);
      }
    }
    for (const a of after.applications) {
      const [[link]] = await connection.execute('SELECT canonical_id FROM JRS_HR_APPLICATION_LINK WHERE recruiting_id=?', [a.id]);
      if (!link) {
        const [[candidate]] = await connection.execute('SELECT canonical_id FROM JRS_CANDIDATE_LINK WHERE recruiting_id=?', [a.candidateId]);
        const [[job]] = await connection.execute('SELECT canonical_id FROM JRS_JOB_LINK WHERE recruiting_id=?', [a.jobId]);
        await connection.execute('INSERT INTO APPLICATION(candidate_id,position_id,assigned_hr_user_id,current_status,applied_at) VALUES(?,?,?,?,?)', [candidate.canonical_id, job.canonical_id, owner.user_id, a.stage, a.appliedDate]);
        const [[canonical]] = await connection.query('SELECT LAST_INSERT_ID() AS id');
        await connection.execute('INSERT INTO JRS_HR_APPLICATION_LINK(recruiting_id,canonical_id) VALUES(?,?)', [a.id, canonical.id]);
      } else {
        await connection.execute('UPDATE APPLICATION SET current_status=?,updated_at=UTC_TIMESTAMP() WHERE application_id=?', [a.stage, link.canonical_id]);
      }
      if (experimentalApplicantPortal) {
        const [[portal]] = await connection.execute('SELECT portal_id,withdrawn FROM JRS_APPLICATION_LINK WHERE recruiting_id=?', [a.id]);
        if (portal && !portal.withdrawn) await connection.execute('UPDATE applications SET status=?,status_message=?,updated_at=UTC_TIMESTAMP() WHERE id=?', [publicStatus(a.stage), `Recruitment stage: ${a.stage}.`, portal.portal_id]);
      }
    }
    const oldEvents = new Set(before.systemNotifications.map(n => n.id));
    for (const n of after.systemNotifications.filter(n => !oldEvents.has(n.id))) {
      const [[link]] = await connection.execute('SELECT canonical_id FROM JRS_HR_APPLICATION_LINK WHERE recruiting_id=?', [n.applicationId]);
      await connection.execute('INSERT IGNORE INTO SYSTEM_NOTIFICATION(recipient_user_id,application_id,notification_type,title,message,source_module,event_key,is_read) VALUES(?,?,?,?,?,?,?,0)', [owner.user_id, link?.canonical_id || null, n.eventType === 'New Application' ? 'NEW_APPLICATION' : 'STATUS_UPDATE', n.title.slice(0, 180), n.title, n.sourceModule || 'Applications', `recruiting:${n.id}`]);
    }
  }

  return { templates, mirror, publicStatus };
}
