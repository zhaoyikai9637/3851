// Test double only: never imported by server.js. HTTP tests exercise the real app/middleware.
const bcrypt = require('bcrypt');
class MemoryRepository {
    constructor(clock = () => new Date()) {
        this.clock = clock; this.accounts = []; this.candidates = []; this.sessions = new Map();
        this.resets = new Map(); this.limits = new Map(); this.files = []; this.nextId = 1;
    }
    async rateLimit(key, expires, limit) { const n = (this.limits.get(key) || 0) + 1; this.limits.set(key, n); return n <= limit; }
    async findAccount(email) { return this.accounts.find(a => a.email === email); }
    async recoveryAccount(email) {
        const account = await this.findAccount(email);
        return account ? {...account,recovery_eligible:account.recovery_eligible ?? ['candidate','hr'].includes(account.role)} : null;
    }
    async register(email, hash, first, last) {
        if (await this.findAccount(email)) { const e = new Error(); e.code = 'ER_DUP_ENTRY'; throw e; }
        const id = this.accounts.length + 1;
        this.accounts.push({ account_id: id, email, password_hash: hash, role: 'candidate' });
        this.candidates.push({ candidate_id: id, account_id: id, email, full_name: `${first} ${last}`.trim(), first_name: first, last_name: last,
            country_code: '+65', contact_number: '', home_location: '', personal_summary: '', career: [], education: [], certifications: [], skills: [], languages: [], resumes: [] });
        return id;
    }
    async login(email, password, session, dummyHash) {
        const a = await this.findAccount(email), validHash = a && /^\$2[aby]\$/.test(a.password_hash);
        const good = await bcrypt.compare(password, validHash ? a.password_hash : dummyHash);
        if (!validHash || !good || a.role !== 'candidate') return null;
        this.sessions.set(session.sid, { ...session, account_id: a.account_id });
        return { account_id: a.account_id, email, role: a.role };
    }
    async session(sid) {
        const s = this.sessions.get(sid);
        if (!s || s.expires <= this.clock()) return null;
        const a = this.accounts.find(a => a.account_id === s.account_id);
        return a?.role === 'candidate' ? { account_id: a.account_id, email: a.email, role: a.role, csrf: s.csrf } : null;
    }
    async logout(sid) { this.sessions.delete(sid); }
    async saveReset(id, code_hash, expires_at, sent_at, link = false) {
        const old = this.resets.get(id);
        if (old && sent_at - old.sent_at < 60000) return false;
        this.resets.set(id, { code_hash:link?null:code_hash, expires_at, sent_at, attempts: 0, ...(link ? {token_hash:code_hash,token_expires_at:expires_at} : {}) }); return true;
    }
    async discardReset(id, digest, link = false) { if (this.resets.get(id)?.[link?'token_hash':'code_hash'] === digest) this.resets.delete(id); }
    async verifyCode(id, digest, token_hash, token_expires_at, now) {
        const r = this.resets.get(id);
        if (!r || !r.code_hash || r.attempts >= 5 || r.expires_at <= now) return false;
        if (r.code_hash !== digest) { r.attempts++; return false; }
        Object.assign(r, { code_hash: null, token_hash, token_expires_at }); return true;
    }
    async consumeReset(digest, password_hash, now) {
        const pair = [...this.resets].find(([, r]) => r.token_hash === digest);
        if (!pair || pair[1].token_expires_at <= now) return false;
        const id = pair[0]; this.resets.delete(id);
        if (this.accounts.find(a => a.account_id === id)?.role !== 'candidate') return false;
        this.accounts.find(a => a.account_id === id).password_hash = password_hash;
        for (const [sid, s] of this.sessions) if (s.account_id === id) this.sessions.delete(sid);
        return true;
    }
    async candidate(id) { return this.candidates.find(c => c.account_id === id); }
    async profile(id) { return structuredClone(await this.candidate(id)); }
    async updateProfile(id, fields) { Object.assign(this.candidates.find(c => c.candidate_id === id), fields); }
    async saveSection(id, section, recordId, values) {
        const key = { career: 'role_id', education: 'education_id', certifications: 'cert_id' }[section];
        const list = this.candidates.find(c => c.candidate_id === id)[section];
        if (recordId) { const row = list.find(r => r[key] === recordId); if (!row) return null; Object.assign(row, values); return recordId; }
        const newId = this.nextId++; list.push({ ...values, [key]: newId, candidate_id: id }); return newId;
    }
    async deleteSection(id, section, recordId) {
        const key = { career: 'role_id', education: 'education_id', certifications: 'cert_id' }[section];
        const list = this.candidates.find(c => c.candidate_id === id)[section], index = list.findIndex(r => r[key] === recordId);
        if (index < 0) return false; list.splice(index, 1); return true;
    }
    async replaceList(id, type, values) { this.candidates.find(c => c.candidate_id === id)[type] = structuredClone(values); }
    async addResume(id, file) {
        const row = { file_id: this.nextId++, candidate_id: id, file_name: file.name, storage_key: file.key, file_type: file.type, file_size: file.size };
        this.files.push(row); this.candidates.find(c => c.candidate_id === id).resumes.push(row); return row.file_id;
    }
    async resume(id, fileId) { return this.files.find(f => f.candidate_id === id && f.file_id === fileId); }
}
module.exports = { MemoryRepository };
