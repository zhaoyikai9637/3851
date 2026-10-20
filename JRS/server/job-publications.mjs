import { z } from 'zod';
import { namespacePool } from './sql-namespace.mjs';
import { httpError } from './security.mjs';
const date = z.string().refine(value => value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), 'Enter a valid date.');
export function publicationState(status, dates = {}, now = new Date()) {
  const today = now.toLocaleDateString('en-CA', {timeZone:'Asia/Singapore'});
  const visible = status === 'Active' && (!dates.publishDate || dates.publishDate <= today) && (!dates.unpublishDate || today < dates.unpublishDate);
  return {visible, accepting:visible && (!dates.closingDate || today <= dates.closingDate)};
}
export const publicationSchema = z.object({ salaryRange: z.string().trim().max(80), closingDate: date, publishDate: date, unpublishDate: date }).strict().superRefine((data, context) => {
  if (data.publishDate && data.closingDate && data.closingDate < data.publishDate) context.addIssue({ code: 'custom', message: 'Application deadline must not be before publication.', path: ['closingDate'] });
  if (data.publishDate && data.unpublishDate && data.unpublishDate < data.publishDate) context.addIssue({ code: 'custom', message: 'Unpublish date must not be before publication.', path: ['unpublishDate'] });
  if (data.closingDate && data.unpublishDate && data.unpublishDate <= data.closingDate) context.addIssue({code:'custom',message:'Unpublish date must be after the application deadline.',path:['unpublishDate']});
});
export function jobPublicationServices(pool, recruitment, bridge) {
  return {
    async jobPublications() {
      const [items] = await pool.query('SELECT j.id,j.title,j.status,COALESCE(p.salary_range,\'\') AS salaryRange,p.closing_date AS closingDate,p.publish_date AS publishDate,p.unpublish_date AS unpublishDate FROM recruiting_job_position j LEFT JOIN JRS_JOB_PUBLICATION p ON p.recruiting_id=j.id ORDER BY j.title');
      return { items };
    },
    async saveJobPublication(userId, id, body) {
      const data = publicationSchema.parse(body), connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query('SELECT revision FROM recruiting_workspace WHERE id=1 FOR UPDATE');
        const [[job]] = await connection.execute('SELECT id FROM recruiting_job_position WHERE id=?', [id]);
        if (!job) throw httpError(404, 'Job not found.');
        await connection.execute('INSERT INTO JRS_JOB_PUBLICATION(recruiting_id,salary_range,closing_date,publish_date,unpublish_date) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE salary_range=VALUES(salary_range),closing_date=VALUES(closing_date),publish_date=VALUES(publish_date),unpublish_date=VALUES(unpublish_date)', [id, data.salaryRange, data.closingDate || null, data.publishDate || null, data.unpublishDate || null]);
        const state = await recruitment.load(namespacePool(connection));
        await bridge.mirror(connection, state, state);
        await connection.execute('UPDATE recruiting_workspace SET revision=revision+1,updated_at=? WHERE id=1', [new Date().toISOString()]);
        await connection.commit();
        return data;
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    },
  };
}
