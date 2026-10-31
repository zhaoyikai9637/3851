// Additive candidate fixtures. Default mode only checks schema; never migrates it.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { loadConfig, ROOT } = require('../server/config/config');
const { createPool, transaction } = require('../server/config/db');
const validation = require('../server/services/validation');

const fixtures = [
    { first: 'Alex', last: 'Tan', email: 'jrs.seed.alex@example.test', title: 'Frontend Developer Intern', company: 'Fictional Horizon Studio',
        qualification: 'Bachelor of Information Technology', institution: 'Fictional Institute of Technology',
        skills: ['HTML', 'CSS', 'JavaScript', 'React'], summary: 'Fictional test candidate interested in accessible interfaces and web development.' },
    { first: 'Jamie', last: 'Lim', email: 'jrs.seed.jamie@example.test', title: 'Backend Developer Intern', company: 'Fictional Cedar Systems',
        qualification: 'Bachelor of Computer Science', institution: 'Fictional Computing College',
        skills: ['Node.js', 'Express', 'MySQL', 'Git'], summary: 'Fictional test candidate focused on APIs, databases and reliable backend services.' },
    { first: 'Morgan', last: 'Lee', email: 'jrs.seed.morgan@example.test', title: 'Software Testing Intern', company: 'Fictional River Labs',
        qualification: 'Bachelor of Software Engineering', institution: 'Fictional Engineering College',
        skills: ['Software Testing', 'SQL', 'Playwright', 'JavaScript'], summary: 'Fictional test candidate interested in software quality and automated testing.' }
];
const columns = {
    MODULE_ACCOUNT: ['account_id', 'email', 'password_hash', 'role'],
    CANDIDATE: ['candidate_id', 'account_id', 'email', 'full_name', 'first_name', 'last_name', 'country_code', 'contact_number', 'home_location', 'personal_summary'],
    CAREER_HISTORY: ['candidate_id', 'job_title', 'company_name', 'start_month_year', 'end_month_year', 'is_current_role', 'description'],
    EDUCATION: ['candidate_id', 'institution', 'qualification', 'finished_year', 'end_month_year', 'is_current_study', 'description'],
    CERTIFICATION: ['candidate_id', 'cert_name', 'issuing_org', 'issue_month_year', 'expiry_month_year', 'no_expiry', 'description'],
    SKILL: ['candidate_id', 'skill_name'], LANGUAGE: ['candidate_id', 'language_name', 'can_read', 'can_write']
};
async function insert(db, table, values) {
    const keys = Object.keys(values);
    const [result] = await db.execute(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, Object.values(values));
    return result.insertId;
}
async function run() {
    const config = loadConfig();
    const apply = process.argv.includes('--apply');
    const expected = process.argv.find(arg => arg.startsWith('--database='))?.slice(11);
    if (apply && expected !== config.db.database) throw new Error('Pass --apply --database=EXACT_DATABASE_NAME to import.');
    const pool = createPool({ ...config, db: { ...config.db, connectTimeout: 10000 } });
    try {
        const [schema] = await pool.query('SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
        for (const [table, names] of Object.entries(columns)) for (const name of names) {
            if (!schema.some(row => row.TABLE_NAME === table && row.COLUMN_NAME === name)) {
                throw new Error(`Missing ${table}.${name}; no data imported. Review the schema first.`);
            }
        }
        const [engines] = await pool.query('SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
        if (Object.keys(columns).some(table => !engines.some(row => row.TABLE_NAME === table && row.ENGINE === 'InnoDB'))) {
            throw new Error('All target tables must use InnoDB for atomic import.');
        }
        console.log(`Database: ${config.db.database}. Three candidate profiles; no updates to existing records.`);
        if (!apply) { console.log('READ-ONLY: schema ready. No database writes performed.'); return; }
        // Save random test passwords privately before inserting; never print passwords or hashes.
        const folder = path.join(ROOT, '.local-backup/seed-candidates');
        await fs.mkdir(folder, { recursive: true });
        const file = path.join(folder, `${crypto.randomUUID()}.json`);
        const accounts = fixtures.map(row => ({ email: row.email, password: 'Jrs!' + crypto.randomBytes(18).toString('base64url') }));
        await fs.writeFile(file, JSON.stringify({ database: config.db.database, createdAt: new Date().toISOString(), accounts }, null, 2), { flag: 'wx', mode: 0o600 });
        const hashes = await Promise.all(accounts.map(account => bcrypt.hash(account.password, 12)));
        const result = await transaction(pool, async db => {
            const added = [], skipped = [];
            for (const [index, row] of fixtures.entries()) {
                const [[existing]] = await db.execute('SELECT account_id FROM MODULE_ACCOUNT WHERE email = ?', [row.email]);
                const [[candidate]] = await db.execute('SELECT candidate_id FROM CANDIDATE WHERE email = ?', [row.email]);
                if (existing || candidate) { skipped.push(row.email); continue; }
                const accountId = await insert(db, 'MODULE_ACCOUNT', { email: validation.email(row.email), password_hash: hashes[index], role: 'candidate' });
                const basic = validation.profile({ first_name: row.first, last_name: row.last, country_code: '+65', contact_number: '', home_location: 'Singapore' });
                const candidateId = await insert(db, 'CANDIDATE', { account_id: accountId, email: row.email, ...basic, personal_summary: row.summary });
                await insert(db, 'CAREER_HISTORY', { candidate_id: candidateId, ...validation.sections.career.validate({ job_title: row.title, company_name: row.company, start_month_year: '2025-06', end_month_year: '2025-12', is_current_role: false, description: 'Fictional internship record for testing profile display and editing.' }) });
                await insert(db, 'EDUCATION', { candidate_id: candidateId, ...validation.sections.education.validate({ institution: row.institution, qualification: row.qualification, is_current_study: true, finished_year: '', end_month_year: '2027-06', description: 'Coursework includes programming, databases and a software development project.' }) });
                await insert(db, 'CERTIFICATION', { candidate_id: candidateId, ...validation.sections.certifications.validate({ cert_name: 'Web Development Fundamentals', issuing_org: 'Fictional Learning Academy', issue_month_year: '2025-03', no_expiry: true, description: 'Fictional training certificate for testing.' }) });
                for (const skill of validation.skills(row.skills)) await insert(db, 'SKILL', { candidate_id: candidateId, skill_name: skill });
                for (const language of validation.languages([{ language_name: 'English', can_read: true, can_write: true }, { language_name: 'Chinese', can_read: true, can_write: true }])) await insert(db, 'LANGUAGE', { candidate_id: candidateId, ...language });
                for (const table of ['CAREER_HISTORY', 'EDUCATION', 'CERTIFICATION', 'SKILL', 'LANGUAGE']) {
                    const [[check]] = await db.execute(`SELECT COUNT(*) AS total FROM ${table} WHERE candidate_id = ?`, [candidateId]);
                    const expectedCount = table === 'SKILL' ? row.skills.length : table === 'LANGUAGE' ? 2 : 1;
                    if (Number(check.total) !== expectedCount) throw new Error(`Verification failed for ${table}; rolling back all inserts.`);
                }
                added.push({ email: row.email, accountId, candidateId });
            }
            return { added, skipped };
        });
        // Audit only new IDs and emails; original random credentials remain in the private file.
        await fs.writeFile(file + '.result.json', JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
        console.log(JSON.stringify(result));
        console.log(`Private test credentials: ${file}`);
        console.log('No mail sent; no session/reset records or resume file references fabricated.');
    } finally { await pool.end(); }
}
if (require.main === module) run().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
