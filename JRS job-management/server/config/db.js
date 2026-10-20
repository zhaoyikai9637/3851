const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const demoSeed = require.main === module && process.argv.includes('--seed-demo');
const dbPath = process.env.DB_PATH || path.resolve(__dirname, demoSeed ? '../../demo.sqlite' : '../../database.sqlite');
const db = new sqlite3.Database(dbPath);
const run = sql => new Promise((resolve, reject) => db.run(sql, err => err ? reject(err) : resolve()));
db.ready = (async () => {
    await run(`CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, department TEXT NOT NULL,
        type TEXT NOT NULL, location TEXT, salary_range TEXT, closing_date TEXT, publish_date TEXT,
        unpublish_date TEXT, description TEXT, requirements TEXT, applicants INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active', last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(`CREATE TABLE IF NOT EXISTS interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT, candidate TEXT NOT NULL, position TEXT NOT NULL,
        location TEXT, type TEXT, interviewer TEXT, date TEXT, iso_date TEXT, status TEXT DEFAULT 'Pending',
        comments TEXT, recommendation TEXT, ratings TEXT DEFAULT '{}'
    )`);
    const columns = await new Promise((resolve, reject) => db.all('PRAGMA table_info(interviews)', (err, rows) => err ? reject(err) : resolve(rows)));
    if (!columns.some(column => column.name === 'ratings')) await run("ALTER TABLE interviews ADD COLUMN ratings TEXT DEFAULT '{}'");
})();
// Consumers await ready before querying, including schema upgrades on existing databases.
db.ready.catch(err => console.error('Database initialization failed:', err.message));
module.exports = db;

if (demoSeed) {
const seedRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));
async function seed() {
    await db.ready;
    const count = await new Promise((resolve, reject) => db.get('SELECT (SELECT COUNT(*) FROM jobs) + (SELECT COUNT(*) FROM interviews) AS total', (err, row) => err ? reject(err) : resolve(row.total)));
    if (count) throw new Error('Target database is not empty. No records were changed. Use a new DB_PATH for demo data.');
    await seedRun('BEGIN TRANSACTION');
    try {
        const roles = ['Software Engineer', 'UI / UX Designer', 'HR Executive', 'Data Analyst', 'QA Engineer'];
        const departments = ['IT', 'Design', 'HR', 'IT', 'IT'];
        for (let index = 0; index < 100; index++) {
            const title = `${roles[index % roles.length]} ${String(index + 1).padStart(3, '0')}`;
            await seedRun('INSERT INTO jobs (title,department,type,location,salary_range,applicants,status,description,requirements) VALUES (?,?,?,?,?,?,?,?,?)',
                [title, departments[index % 5], index % 3 ? 'Full-time' : 'Contract', index % 2 ? 'Singapore' : 'Remote', 'SGD 5,000 - 9,000', index * 3, index % 10 === 0 ? 'Draft' : index % 7 === 0 ? 'Unpublished' : 'Active', `Demo opening ${index + 1}. Build and support our recruitment platform.`, 'Relevant experience and communication skills.']);
            const date = `2026-11-${String(index % 28 + 1).padStart(2, '0')}T${index % 2 ? '14' : '10'}:00`;
            await seedRun('INSERT INTO interviews (candidate,position,location,type,interviewer,date,iso_date,status) VALUES (?,?,?,?,?,?,?,?)',
                [`Demo Candidate ${String(index + 1).padStart(3, '0')}`, title, index % 2 ? 'Meeting Room B04' : 'https://example.com/demo-meeting', index % 2 ? 'On-site' : 'Online', ['Michael Tan', 'Sarah Lim', 'Daniel Wong'][index % 3], date, date.slice(0, 10), index % 3 ? 'Confirmed' : 'Pending']);
        }
        await seedRun('COMMIT');
        console.log(`Created 100 jobs and 100 interviews in ${dbPath}`);
    } catch (error) { await seedRun('ROLLBACK'); throw error; }
}
seed().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.close());

}
// Fill a working database with examples without replacing existing records.
db.seedSamples = async function seedSamples({ backup = true } = {}) {
    await db.ready;
    const query = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
    const execute = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, error => error ? reject(error) : resolve()));
    const before = (await query('SELECT (SELECT COUNT(*) FROM jobs) AS jobs, (SELECT COUNT(*) FROM interviews) AS interviews'))[0];
    let backupPath;
    if (backup && dbPath !== ':memory:') {
        backupPath = `${dbPath}.before-samples-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
        await execute('VACUUM INTO ?', [backupPath]);
    }
    await execute('BEGIN IMMEDIATE');
    try {
        const jobSamples = [
            ['Software Engineer', 'IT', 'Full-time', 'SGD 6,000 - 9,000', 45, 'Active'],
            ['UI / UX Designer', 'Design', 'Full-time', 'SGD 5,000 - 8,000', 26, 'Active'],
            ['HR Executive', 'HR', 'Contract', 'SGD 3,500 - 5,000', 13, 'Unpublished'],
            ['Senior Software Engineer', 'IT', 'Full-time', 'SGD 6,000 - 9,000', 45, 'Active']
        ];
        const description = 'Responsible for designing, developing and maintaining enterprise web applications.\nWork closely with Product Managers, QA Engineers and UI/UX Designers.\nParticipate in Agile sprint planning, code reviews and deployment.';
        const requirements = "Bachelor's Degree in Computer Science\n3+ years experience with Java / Spring Boot\nStrong communication and teamwork skills";
        const insertJob = async ([title, department, type, salary, applicants, status]) => execute(
            'INSERT INTO jobs (title,department,type,location,salary_range,applicants,status,closing_date,publish_date,unpublish_date,description,requirements) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [title, department, type, 'Singapore', salary, applicants, status, '2026-12-31', '2026-07-01', '2027-01-01', description, requirements]);
        for (const sample of jobSamples) {
            if (!(await query('SELECT id FROM jobs WHERE title=?', [sample[0]])).length) await insertJob(sample);
        }
        let count = (await query('SELECT COUNT(*) AS count FROM jobs'))[0].count;
        for (let index = 1; count < 100; index++) {
            const role = jobSamples[(index - 1) % 3];
            const title = `${role[0]} - Sample ${String(index).padStart(3, '0')}`;
            if ((await query('SELECT id FROM jobs WHERE title=?', [title])).length) continue;
            await insertJob([title, role[1], index % 4 ? role[2] : 'Part-time', role[3], index % 56, index % 10 === 0 ? 'Draft' : role[5]]); count++;
        }
        const interviews = [
            ['Jane Doe', 'Software Engineer', 'A01', 'Online', 'Michael Tan', '2026-07-29T10:00', 'Confirmed', { Experience: 5, 'Technical Skills': 4, 'Communication & Culture Fit': 3, Teamwork: 3 }, 'Strong understanding of data structures and C# fundamentals.\nDemonstrates good architectural thinking during the design phase.', 'Offer'],
            ['Alex Tan', 'UI / UX Designer', 'B04', 'On-site', 'Sarah Lim', '2026-07-29T14:00', 'Pending', {}, '', null],
            ['Mary Smith', 'HR Executive', 'D16', 'On-site', 'Daniel Wong', '2026-07-30T09:00', 'Confirmed', {}, '', null]
        ];
        const insertInterview = async sample => execute('INSERT INTO interviews (candidate,position,location,type,interviewer,date,iso_date,status,ratings,comments,recommendation) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [...sample.slice(0, 6), sample[5].slice(0, 10), sample[6], JSON.stringify(sample[7]), sample[8], sample[9]]);
        for (const sample of interviews) if (!(await query('SELECT id FROM interviews WHERE candidate=?', [sample[0]])).length) await insertInterview(sample);
        count = (await query('SELECT COUNT(*) AS count FROM interviews'))[0].count;
        const firstNames = ['Emma', 'Liam', 'Olivia', 'Noah', 'Sophia', 'Ethan', 'Chloe', 'Lucas', 'Grace', 'Ryan'];
        const surnames = ['Lim', 'Wong', 'Chen', 'Lee', 'Tan', 'Ng', 'Goh', 'Teo', 'Koh', 'Ong'];
        for (let index = 1; count < 100; index++) {
            const name = `${firstNames[(index - 1) % 10]} ${surnames[Math.floor((index - 1) / 10) % 10]} (Sample ${index})`;
            if ((await query('SELECT id FROM interviews WHERE candidate=?', [name])).length) continue;
            const base = interviews[(index - 1) % 3];
            const date = `2026-11-${String((index - 1) % 28 + 1).padStart(2, '0')}T${index % 2 ? '10' : '14'}:00`;
            const completed = index % 8 === 0;
            await insertInterview([name, base[1], base[2], base[3], base[4], date, completed ? 'Completed' : index % 3 ? 'Confirmed' : 'Pending', completed ? { Experience: 4, 'Technical Skills': 3.5, Communication: 4, Teamwork: 4.5 } : {}, completed ? 'Sample feedback: communicates clearly and demonstrates relevant experience.' : '', completed ? 'Further Consideration' : null]); count++;
        }
        await execute('COMMIT');
        const after = (await query('SELECT (SELECT COUNT(*) FROM jobs) AS jobs, (SELECT COUNT(*) FROM interviews) AS interviews'))[0];
        return { before, after, backupPath };
    } catch (error) { await execute('ROLLBACK'); throw error; }
};
if (require.main === module && process.argv.includes('--seed-samples')) {
    db.seedSamples().then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.close());
}
