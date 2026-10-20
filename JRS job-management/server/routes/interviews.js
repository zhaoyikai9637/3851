const router = require('express').Router();
const db = require('../config/db');
const recommendations = ['Offer', 'Reject', 'Further Consideration'];
function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function validId(value) { return /^[1-9]\d*$/.test(String(value)); }

const present = row => {
    let ratings = {};
    try { ratings = JSON.parse(row.ratings || '{}'); } catch (_) { /* Legacy row. */ }
    return { ...row, isoDate: row.iso_date, ratings };
};
router.param('id', (req, res, next, id) => validId(id) ? next() : res.status(400).json({ error: 'Invalid interview ID' }));
router.get('/', (req, res) => {
    const { search, isoDate, status } = req.query;
    let sql = 'SELECT * FROM interviews WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND candidate LIKE ?'; params.push(`%${search}%`); }
    if (isoDate) { sql += ' AND iso_date=?'; params.push(isoDate); }
    if (status) { sql += ' AND status=?'; params.push(status); }
    db.all(`${sql} ORDER BY iso_date, date, id`, params, (err, rows) => err
        ? res.status(500).json({ error: 'Unable to load interviews' }) : res.json({ data: rows.map(present) }));
});
router.get('/:id', (req, res) => {
    db.get('SELECT * FROM interviews WHERE id=?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Unable to load interview' });
        if (!row) return res.status(404).json({ error: 'Interview not found' });
        res.json({ data: present(row) });
    });
});
router.post('/', (req, res) => {
    const { candidate, position, location, type, interviewer, date, status = 'Pending' } = req.body;
    if ([candidate, position, location, interviewer].some(value => typeof value !== 'string' || !value.trim())) return res.status(400).json({ error: 'Candidate, position, location and interviewer are required.' });
    if (!['Online', 'On-site'].includes(type) || !['Pending', 'Confirmed'].includes(status)) return res.status(400).json({ error: 'Invalid interview type or status.' });
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(date) || !validDate(date.slice(0, 10))) return res.status(400).json({ error: 'A valid interview date and time are required.' });
    db.run('INSERT INTO interviews (candidate,position,location,type,interviewer,date,iso_date,status) VALUES (?,?,?,?,?,?,?,?)',
        [candidate.trim(), position.trim(), location.trim(), type, interviewer.trim(), date, date.slice(0, 10), status], function(err) {
            if (err) return res.status(500).json({ error: 'Unable to create interview' });
            res.status(201).json({ id: this.lastID });
        });
});
router.put('/:id/feedback', (req, res) => {
    const { comments = '', recommendation, ratings } = req.body;
    if (!recommendations.includes(recommendation)) return res.status(400).json({ error: 'Select a valid recommendation.' });
    if (typeof comments !== 'string' || !ratings || Array.isArray(ratings) || typeof ratings !== 'object' || !Object.keys(ratings).length ||
        Object.entries(ratings).some(([name, score]) => !name.trim() || name.length > 80 || typeof score !== 'number' || !Number.isFinite(score) || score < 0.5 || score > 5 || score * 2 % 1 !== 0)) {
        return res.status(400).json({ error: 'Each assessment needs a name and a rating from 0.5 to 5 in 0.5 steps.' });
    }
    db.run("UPDATE interviews SET comments=?, recommendation=?, ratings=?, status='Completed' WHERE id=?", [comments, recommendation, JSON.stringify(ratings), req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Unable to save feedback' });
        if (!this.changes) return res.status(404).json({ error: 'Interview not found' });
        res.json({ message: 'Feedback saved successfully' });
    });
});
module.exports = router;
