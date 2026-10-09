const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/jobs
router.get('/', (req, res) => {
    const { search, department, status } = req.query;
    let sql = "SELECT * FROM jobs WHERE 1=1";
    let params = [];

    if (search) {
        sql += " AND title LIKE ?";
        params.push(`%${search}%`);
    }
    if (department) {
        sql += " AND department = ?";
        params.push(department);
    }
    if (status) {
        sql += " AND status = ?";
        params.push(status);
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// POST /api/jobs
router.post('/', (req, res) => {
    const { title, department, type, location, salaryRange, closingDate, description, requirements } = req.body;
    const sql = `INSERT INTO jobs (title, department, type, location, salary_range, closing_date, description, requirements) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [title, department, type, location, salaryRange, closingDate, description, requirements];

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Job created successfully', id: this.lastID });
    });
});

// PUT /api/jobs/:id
router.put('/:id', (req, res) => {
    const id = req.params.id;
    const { title, department, location, type, salaryRange, closingDate, publishDate, unpublishDate, description, requirements, status } = req.body;
    const sql = `UPDATE jobs SET title=?, department=?, location=?, type=?, salary_range=?, closing_date=?, publish_date=?, unpublish_date=?, description=?, requirements=?, status=?, last_updated=CURRENT_TIMESTAMP WHERE id=?`;
    const params = [title, department, location, type, salaryRange, closingDate, publishDate, unpublishDate, description, requirements, status, id];

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Job updated successfully' });
    });
});

// DELETE /api/jobs/:id
router.delete('/:id', (req, res) => {
    const id = req.params.id;
    db.run("DELETE FROM jobs WHERE id = ?", [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Job deleted successfully' });
    });
});

module.exports = router;