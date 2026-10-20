const router = require('express').Router();
const db = require('../config/db');
const jobTypes = ['Full-time', 'Part-time', 'Contract'];
const jobStatuses = ['Active', 'Unpublished', 'Draft'];
function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function validateJob(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'A job object is required.';
    if (['title', 'department', 'type'].some(key => typeof data[key] !== 'string' || !data[key].trim())) return 'Job title, department and employment type are required.';
    if (!jobTypes.includes(data.type)) return 'Invalid employment type.';
    if (data.status && !jobStatuses.includes(data.status)) return 'Invalid job status.';
    if (['location', 'salaryRange', 'description', 'requirements'].some(key => data[key] != null && typeof data[key] !== 'string')) return 'Job fields must contain text.';
    for (const key of ['closingDate', 'publishDate', 'unpublishDate']) {
        if (data[key] && !validDate(data[key])) return 'Enter valid dates in YYYY-MM-DD format.';
    }
    if (data.publishDate && data.closingDate && data.publishDate > data.closingDate) return 'Publish date must be on or before the application deadline.';
    if (data.publishDate && data.unpublishDate && data.publishDate > data.unpublishDate) return 'Unpublish date must be on or after the publish date.';
    if (data.closingDate && data.unpublishDate && data.closingDate >= data.unpublishDate) return 'Unpublish date must be after the application deadline.';
    return null;
}
function validId(value) { return /^[1-9]\d*$/.test(String(value)); }


// Dates use the workspace timezone (Asia/Shanghai). Closing is a separate application deadline.
const effectiveStatus = `CASE WHEN status = 'Active' AND
    ((publish_date IS NOT NULL AND publish_date != '' AND publish_date > date('now', '+8 hours')) OR
    (unpublish_date IS NOT NULL AND unpublish_date != '' AND unpublish_date <= date('now', '+8 hours')))
    THEN 'Unpublished' ELSE status END`;
const select = `SELECT jobs.*, status AS publication_status, ${effectiveStatus} AS effective_status FROM jobs`;
const present = row => ({ ...row, status: row.effective_status });
router.param('id', (req, res, next, id) => validId(id) ? next() : res.status(400).json({ error: 'Invalid job ID' }));
router.get('/', (req, res) => {
    const { search, department, status } = req.query;
    let sql = `${select} WHERE 1=1`;
    const params = [];
    if (search) { sql += ' AND title LIKE ?'; params.push(`%${search}%`); }
    if (department) { sql += ' AND department = ?'; params.push(department); }
    if (status) { sql += ` AND (${effectiveStatus}) = ?`; params.push(status); }
    db.all(`${sql} ORDER BY id DESC`, params, (err, rows) => err
        ? res.status(500).json({ error: 'Unable to load jobs' }) : res.json({ data: rows.map(present) }));
});
router.get('/:id', (req, res) => {
    db.get(`${select} WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Unable to load job' });
        if (!row) return res.status(404).json({ error: 'Job not found' });
        res.json({ data: present(row) });
    });
});
function save(req, res, update) {
    const data = req.body;
    const error = validateJob(data);
    if (error) return res.status(400).json({ error });
    const fields = ['title', 'department', 'type', 'location', 'salary_range', 'closing_date', 'publish_date', 'unpublish_date', 'description', 'requirements', 'status'];
    const values = [data.title.trim(), data.department.trim(), data.type, data.location || '', data.salaryRange || '', data.closingDate || '', data.publishDate || '', data.unpublishDate || '', data.description || '', data.requirements || '', data.status || 'Active'];
    const sql = update
        ? `UPDATE jobs SET ${fields.map(field => `${field}=?`).join(',')}, last_updated=CURRENT_TIMESTAMP WHERE id=?`
        : `INSERT INTO jobs (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`;
    if (update) values.push(req.params.id);
    db.run(sql, values, function(err) {
        if (err) return res.status(500).json({ error: 'Unable to save job' });
        if (update && !this.changes) return res.status(404).json({ error: 'Job not found' });
        res.status(update ? 200 : 201).json({ id: update ? Number(req.params.id) : this.lastID, message: 'Job saved successfully' });
    });
}
router.post('/', (req, res) => save(req, res, false));
router.put('/:id', (req, res) => save(req, res, true));
router.delete('/:id', (req, res) => {
    db.run('DELETE FROM jobs WHERE id=?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Unable to delete job' });
        if (!this.changes) return res.status(404).json({ error: 'Job not found' });
        res.json({ message: 'Job deleted successfully' });
    });
});
module.exports = router;
