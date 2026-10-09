const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

db.serialize(() => {
    // Jobs Table
    db.run(`
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            department TEXT NOT NULL,
            type TEXT NOT NULL,
            location TEXT,
            salary_range TEXT,
            closing_date TEXT,
            publish_date TEXT,
            unpublish_date TEXT,
            description TEXT,
            requirements TEXT,
            applicants INTEGER DEFAULT 0,
            status TEXT DEFAULT 'Active',
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Interviews Table
    db.run(`
        CREATE TABLE IF NOT EXISTS interviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate TEXT NOT NULL,
            position TEXT NOT NULL,
            location TEXT,
            type TEXT,
            interviewer TEXT,
            date TEXT,
            iso_date TEXT,
            status TEXT DEFAULT 'Pending',
            comments TEXT,
            recommendation TEXT
        )
    `);

    // Init Sample Data
    db.get("SELECT COUNT(*) AS count FROM jobs", (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO jobs (title, department, type, location, salary_range, applicants, status) VALUES 
                ('Software Engineer', 'IT', 'Full-time', 'Singapore', 'SGD 6,000 - 9,000', 45, 'Active'),
                ('UI / UX Designer', 'Design', 'Full-time', 'Singapore', 'SGD 5,000 - 8,000', 26, 'Active'),
                ('HR Executive', 'HR', 'Contract', 'Singapore', 'SGD 3,500 - 5,000', 13, 'Unpublished')
            `);
        }
    });
});

module.exports = db;