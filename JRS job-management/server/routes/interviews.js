const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/interviews
router.get('/', (req, res) => {
    const { search, isoDate, status } = req.query;
    let sql = "SELECT * FROM interviews WHERE 1=1";
    let params = [];

    if (search) {
        sql += " AND candidate LIKE ?";
        params.push(`%${search}%`);
    }
    if (isoDate) {
        sql += " AND iso_date = ?";
        params.push(isoDate);
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

module.exports = router;