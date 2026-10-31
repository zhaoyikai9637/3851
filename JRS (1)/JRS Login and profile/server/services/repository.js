const bcrypt = require('bcrypt');
const { transaction } = require('../config/db');
const { sections } = require('./validation');
// MySQL DATETIME strings represent UTC, not the Windows machine's local timezone.
const sqlDate = value => new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value) ? value.replace(' ','T')+'Z' : value);

class Repository {
    constructor(pool, {integratedRoot=false} = {}) { this.pool = pool; this.integratedRoot=integratedRoot; }
    async rateLimit(key, expires, limit) {
        await this.pool.query('INSERT INTO JRS_RATE_LIMIT (bucket_key, hits, expires_at) VALUES (?, 1, ?) ON DUPLICATE KEY UPDATE hits = hits + 1', [key, expires]);
        const [[row]] = await this.pool.query('SELECT hits FROM JRS_RATE_LIMIT WHERE bucket_key = ?', [key]);
        return row.hits <= limit;
    }
    async findAccount(email) {
        const [[row]] = await this.pool.query('SELECT account_id, email, password_hash, role FROM MODULE_ACCOUNT WHERE email = ?', [email]);
        return row;
    }
    async recoveryAccount(email) {
        const [[row]] = await this.pool.query(`SELECT a.account_id, a.email, a.role,
            CASE WHEN a.role = 'candidate' AND c.candidate_id IS NOT NULL THEN 1
                 WHEN a.role = 'hr' AND h.account_status = 'ACTIVE' AND h.role IN ('HR_MANAGER','HR_STAFF') THEN 1
                 ELSE 0 END AS recovery_eligible
            FROM MODULE_ACCOUNT a LEFT JOIN CANDIDATE c ON c.account_id = a.account_id
            LEFT JOIN HR_USER h ON h.user_id = a.hr_user_id WHERE a.email = ?`, [email]);
        return row;
    }
    async register(email, hash, first, last) {
        return transaction(this.pool, async db => {
            const [result] = await db.query("INSERT INTO MODULE_ACCOUNT (email, password_hash, role) VALUES (?, ?, 'candidate')", [email, hash]);
            // Never claim historical CANDIDATE rows based on a newly registered email.
            await db.query('INSERT INTO CANDIDATE (account_id, email, full_name, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
                [result.insertId, email, `${first} ${last}`.trim(), first, last]);
            return result.insertId;
        });
    }
    async login(email, password, session, dummyHash) {
        return transaction(this.pool, async db => {
            const [[account]] = await db.query('SELECT account_id, email, password_hash, role, hr_user_id FROM MODULE_ACCOUNT WHERE email = ? FOR UPDATE', [email]);
            const hashed = account && /^\$2[aby]\$\d{2}\$/.test(account.password_hash);
            const matches = await bcrypt.compare(password, hashed ? account.password_hash : dummyHash);
            if (!account || !hashed || !matches || !['candidate', 'hr'].includes(account.role)) return null;
            if (account.role === 'hr') {
                const [[hr]] = await db.query("SELECT user_id FROM HR_USER WHERE user_id = ? AND account_status = 'ACTIVE' AND role IN ('HR_MANAGER', 'HR_STAFF')", [account.hr_user_id]);
                if (!hr) return null;
            }
            if (account.role === 'candidate') {
            const [[candidate]] = await db.query('SELECT candidate_id FROM CANDIDATE WHERE account_id = ?', [account.account_id]);
            if (!candidate) {
                // Existing accounts with no historical profile can create a new empty profile.
                const [[legacy]] = await db.query('SELECT candidate_id FROM CANDIDATE WHERE email = ? AND account_id IS NULL LIMIT 1', [account.email]);
                if (legacy) { const e = new Error('Existing profile requires account linking by the database administrator.'); e.status = 409; throw e; }
                await db.query('INSERT INTO CANDIDATE (account_id, email, full_name) VALUES (?, ?, ?)', [account.account_id, account.email, '']);
            }
            }
            await db.query('INSERT INTO MODULE_SESSION (sid, data, expires) VALUES (?, ?, ?)',
                [session.sid, JSON.stringify({ module: 'jrs-candidate', account_id: account.account_id, csrf: session.csrf }), session.expires]);
            return { account_id: account.account_id, email: account.email, role: account.role };
        });
    }
    async session(sid) {
        const [[row]] = await this.pool.query('SELECT data FROM MODULE_SESSION WHERE sid = ? AND expires > UTC_TIMESTAMP()', [sid]);
        if (!row) return null;
        let data; try { data = JSON.parse(row.data); } catch { return null; }
        if (data.module !== 'jrs-candidate' || !Number.isSafeInteger(data.account_id)) return null;
        const [[account]] = await this.pool.query("SELECT account_id, email, role, hr_user_id FROM MODULE_ACCOUNT WHERE account_id = ? AND role IN ('candidate', 'hr')", [data.account_id]);
        if (account?.role === 'hr' && !await this.hrIdentity(account.account_id)) return null;
        return account ? { ...account, csrf: data.csrf } : null;
    }
    async hrIdentity(accountId) {
        const [[row]] = await this.pool.query(`SELECT h.* FROM HR_USER h JOIN MODULE_ACCOUNT a ON a.hr_user_id = h.user_id
            WHERE a.account_id = ? AND a.role = 'hr' AND h.account_status = 'ACTIVE' AND h.role IN ('HR_MANAGER', 'HR_STAFF')`, [accountId]);
        return row;
    }
    async logout(sid) { await this.pool.query('DELETE FROM MODULE_SESSION WHERE sid = ?', [sid]); }
    async changePassword(accountId, currentPassword, newPassword) {
        require('./validation').password(newPassword);
        if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword) > 72) return false;
        return transaction(this.pool, async db => {
            const [[account]] = await db.query('SELECT password_hash FROM MODULE_ACCOUNT WHERE account_id = ? FOR UPDATE', [accountId]);
            if (!account || !await bcrypt.compare(currentPassword, account.password_hash)) return false;
            await db.query('UPDATE MODULE_ACCOUNT SET password_hash = ?, updated_at = UTC_TIMESTAMP() WHERE account_id = ?', [await bcrypt.hash(newPassword, 12), accountId]);
            await db.query(`DELETE FROM MODULE_SESSION WHERE sid LIKE 'candidate:%' AND JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(data), data, '{}'), '$.account_id')) = ?`, [String(accountId)]);
            return true;
        });
    }
    async saveReset(accountId, codeHash, expires, sentAt, link = false) {
        return transaction(this.pool, async db => {
            // Same lock order as login/reset consumption, including for the first reset request.
            await db.query('SELECT account_id FROM MODULE_ACCOUNT WHERE account_id = ? FOR UPDATE', [accountId]);
            const [[previous]] = await db.query('SELECT sent_at FROM JRS_PASSWORD_RESET WHERE account_id = ? FOR UPDATE', [accountId]);
            if (previous && sentAt - sqlDate(previous.sent_at) < 60000) return false;
            await db.query(`INSERT INTO JRS_PASSWORD_RESET (account_id, code_hash, expires_at, attempts, sent_at, token_hash, token_expires_at)
                VALUES (?, ?, ?, 0, ?, ?, ?) ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at),
                attempts = 0, sent_at = VALUES(sent_at), token_hash = VALUES(token_hash), token_expires_at = VALUES(token_expires_at)`, [accountId, link ? null : codeHash, expires, sentAt, link ? codeHash : null, link ? expires : null]);
            return true;
        });
    }
    async discardReset(accountId, codeHash, link = false) {
        await this.pool.query(`DELETE FROM JRS_PASSWORD_RESET WHERE account_id = ? AND ${link ? 'token_hash' : 'code_hash'} = ?`, [accountId, codeHash]);
    }
    async verifyCode(accountId, codeHash, tokenHash, tokenExpires, now) {
        return transaction(this.pool, async db => {
            const [[row]] = await db.query('SELECT * FROM JRS_PASSWORD_RESET WHERE account_id = ? FOR UPDATE', [accountId]);
            if (!row || !row.code_hash || row.attempts >= 5 || sqlDate(row.expires_at) <= now) return false;
            if (row.code_hash !== codeHash) {
                await db.query('UPDATE JRS_PASSWORD_RESET SET attempts = attempts + 1 WHERE account_id = ?', [accountId]);
                return false;
            }
            await db.query('UPDATE JRS_PASSWORD_RESET SET code_hash = NULL, token_hash = ?, token_expires_at = ? WHERE account_id = ?', [tokenHash, tokenExpires, accountId]);
            return true;
        });
    }
    async consumeReset(tokenHash, passwordHash, now) {
        const [[lookup]] = await this.pool.query('SELECT account_id FROM JRS_PASSWORD_RESET WHERE token_hash = ?', [tokenHash]);
        if (!lookup) return false;
        return transaction(this.pool, async db => {
            const [[account]] = await db.query('SELECT account_id, role FROM MODULE_ACCOUNT WHERE account_id = ? FOR UPDATE', [lookup.account_id]);
            if (!account || account.role !== 'candidate') return false;
            const [[candidate]] = await db.query('SELECT candidate_id FROM CANDIDATE WHERE account_id = ?', [lookup.account_id]);
            if (!candidate) return false;
            const [[row]] = await db.query('SELECT account_id, token_expires_at FROM JRS_PASSWORD_RESET WHERE token_hash = ? FOR UPDATE', [tokenHash]);
            if (!row || !row.token_expires_at || sqlDate(row.token_expires_at) <= now) return false;
            await db.query('UPDATE MODULE_ACCOUNT SET password_hash = ?, updated_at = UTC_TIMESTAMP() WHERE account_id = ?', [passwordHash, row.account_id]);
            await db.query(`DELETE FROM MODULE_SESSION WHERE sid LIKE 'candidate:%' AND
                JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(data), data, '{}'), '$.account_id')) = ?`, [String(row.account_id)]);
            await db.query('DELETE FROM JRS_PASSWORD_RESET WHERE account_id = ?', [row.account_id]);
            return true;
        });
    }
    async candidate(accountId) {
        const [[row]] = await this.pool.query('SELECT * FROM CANDIDATE WHERE account_id = ?', [accountId]);
        return row;
    }
    async profile(accountId) {
        const row = await this.candidate(accountId);
        if (!row) return null;
        for (const [section, schema] of Object.entries(sections)) {
            const [records] = await this.pool.query(`SELECT * FROM ${schema.table} WHERE candidate_id = ? ORDER BY ${schema.key}`, [row.candidate_id]);
            row[section] = records;
        }
        const [skills] = await this.pool.query('SELECT skill_name FROM SKILL WHERE candidate_id = ? ORDER BY skill_id', [row.candidate_id]);
        row.skills = skills.map(s => s.skill_name);
        [row.languages] = await this.pool.query('SELECT language_name, can_read, can_write FROM LANGUAGE WHERE candidate_id = ? ORDER BY language_id', [row.candidate_id]);
        [row.resumes] = await this.pool.query('SELECT file_id, file_name, file_type, file_size, uploaded_at FROM RESUME_FILE WHERE candidate_id = ? ORDER BY file_id DESC', [row.candidate_id]);
        return row;
    }
    async updateProfile(candidateId, values) {
        if(this.integratedRoot && Object.hasOwn(values,'home_location'))values={...values,structured_location:null};
        const columns = Object.keys(values); // All keys originate in server validators.
        await this.pool.query(`UPDATE CANDIDATE SET ${columns.map(k => `${k} = ?`).join(', ')}, updated_at = UTC_TIMESTAMP() WHERE candidate_id = ?`, [...Object.values(values), candidateId]);
    }
    async saveSection(candidateId, section, recordId, values) {
        const { table, key } = sections[section];
        if (recordId) {
            return transaction(this.pool, async db => {
                const [[existing]] = await db.query(`SELECT ${key} FROM ${table} WHERE ${key} = ? AND candidate_id = ? FOR UPDATE`, [recordId, candidateId]);
                if (!existing) return null;
                await db.query(`UPDATE ${table} SET ${Object.keys(values).map(k => `${k} = ?`).join(', ')} WHERE ${key} = ? AND candidate_id = ?`, [...Object.values(values), recordId, candidateId]);
                return recordId;
            });
        }
        const [result] = await this.pool.query(`INSERT INTO ${table} (${['candidate_id', ...Object.keys(values)].join(', ')}) VALUES (${Array(Object.keys(values).length + 1).fill('?').join(', ')})`, [candidateId, ...Object.values(values)]);
        return result.insertId;
    }
    async deleteSection(candidateId, section, recordId) {
        const { table, key } = sections[section];
        const [result] = await this.pool.query(`DELETE FROM ${table} WHERE ${key} = ? AND candidate_id = ?`, [recordId, candidateId]);
        return result.affectedRows > 0;
    }
    async replaceList(candidateId, type, items) {
        return transaction(this.pool, async db => {
            await db.query('SELECT candidate_id FROM CANDIDATE WHERE candidate_id = ? FOR UPDATE', [candidateId]);
            const table = type === 'skills' ? 'SKILL' : 'LANGUAGE';
            await db.query(`DELETE FROM ${table} WHERE candidate_id = ?`, [candidateId]);
            for (const item of items) {
                if (type === 'skills') await db.query('INSERT INTO SKILL (candidate_id, skill_name) VALUES (?, ?)', [candidateId, item]);
                else await db.query('INSERT INTO LANGUAGE (candidate_id, language_name, can_read, can_write) VALUES (?, ?, ?, ?)', [candidateId, item.language_name, item.can_read, item.can_write]);
            }
        });
    }
    async addResume(candidateId, file) {
        const [result] = await this.pool.query('INSERT INTO RESUME_FILE (candidate_id, file_name, storage_key, file_type, file_size) VALUES (?, ?, ?, ?, ?)', [candidateId, file.name, file.key, file.type, file.size]);
        return result.insertId;
    }
    async resume(candidateId, fileId) {
        const [[row]] = await this.pool.query('SELECT * FROM RESUME_FILE WHERE candidate_id = ? AND file_id = ?', [candidateId, fileId]);
        return row;
    }
}
module.exports = { Repository };
