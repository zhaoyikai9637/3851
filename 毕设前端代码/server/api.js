// Central API module: account and candidate handlers, plus the HR integration entry.
// Request authentication, CSRF/origin checks and error middleware are supplied by app.js.
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises');
const multer = require('multer');
const v = require('./services/validation');
const { hash, random, SESSION_COOKIE } = require('./utils/tokens');

// Account APIs: registration, shared login, sessions and password recovery.
function mountAuthRoutes(app, { repo, config, mailer, now, limit, auth, sessionId, cookieOptions }) {
    const dummyHash = bcrypt.hashSync(random(), 10);
    app.post('/api/register', async (req, res) => {
        await limit(req, 'register', 10, 3600);
        const email = v.email(req.body.email), password = v.password(req.body.password);
        const first = v.text(req.body.first_name, 'First name', 50, true), last = v.text(req.body.last_name, 'Last name', 49);
        try { await repo.register(email, await bcrypt.hash(password, 12), first, last); }
        catch (error) { if (error.code === 'ER_DUP_ENTRY') v.fail('Account already exists. Log in or use password recovery.', 409); throw error; }
        res.status(201).json({ valid: true });
    });
    app.post('/api/login', async (req, res) => {
        await limit(req, 'login-ip', 30, 900);
        const email = v.email(req.body.email);
        await limit(req, 'login-email', 10, 900, email);
        // Existing bcrypt passwords may predate the new 8-character creation policy.
        const password = req.body.password;
        if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) v.fail('Invalid email or password.', 401);
        const token = random(), csrf = random();
        const user = await repo.login(email, password, { sid: `candidate:${hash(token)}`, csrf, expires: new Date(now().getTime() + config.sessionMs) }, dummyHash);
        if (!user) v.fail('Invalid email or password. If this is an old test account, use password recovery.', 401);
        const previous = sessionId(req);
        if (previous) await repo.logout(previous);
        res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: config.sessionMs });
        res.json({ valid: true, user, csrfToken: csrf });
    });
    app.get('/api/me', auth, (req, res) => res.json({ valid: true, user: { account_id: req.user.account_id, email: req.user.email, role: req.user.role }, csrfToken: req.user.csrf }));
    app.post('/api/logout', auth, async (req, res) => { await repo.logout(req.sid); res.clearCookie(SESSION_COOKIE, cookieOptions); res.json({ valid: true }); });
    const codeHash = (accountId, code) => crypto.createHmac('sha256', config.resetSecret).update(`reset-code:${accountId}:${code}`).digest('hex');
    app.post('/api/forgot-password', async (req, res) => {
        await limit(req, 'reset-ip', 10, 3600);
        const email = v.email(req.body.email);
        await limit(req, 'reset-email-minute', 1, 60, email);
        await limit(req, 'reset-email-hour', 5, 3600, email);
        if (!mailer.ready) v.fail('Password recovery is not configured. Contact the administrator.', 503);
        const account = await repo.findAccount(email);
        if (account?.role === 'candidate') {
            const code = crypto.randomInt(1000, 10000).toString(), sentAt = now();
            const digest = codeHash(account.account_id, code);
            if (await repo.saveReset(account.account_id, digest, new Date(sentAt.getTime() + 600000), sentAt)) {
                try { await mailer.sendCode(account.email, code); }
                catch (error) {
                    await repo.discardReset(account.account_id, digest);
                    // Keep account existence private; log delivery failure without addresses or codes.
                    console.error('Password recovery email delivery failed:', error.code || 'SMTP_ERROR');
                }
            }
        }
        res.json({ valid: true, message: 'If a candidate account exists, a verification code will be sent.' });
    });
    app.post('/api/check-email', async (req, res) => {
        await limit(req, 'verify-ip', 30, 900);
        const email = v.email(req.body.email), code = req.body.code;
        if (typeof code !== 'string' || !/^\d{4}$/.test(code)) v.fail('Enter a 4-digit code.');
        const account = await repo.findAccount(email), token = random(), time = now();
        if (!account || account.role !== 'candidate' || !await repo.verifyCode(account.account_id, codeHash(account.account_id, code), hash(token), new Date(time.getTime() + 600000), time)) v.fail('Invalid or expired code. Request a new code after five failed attempts.');
        res.json({ valid: true, resetToken: token });
    });
    app.post('/api/set-new-password', async (req, res) => {
        await limit(req, 'password-reset', 10, 900);
        const token = req.body.resetToken;
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) v.fail('A valid reset credential is required.');
        const password = v.password(req.body.newPassword);
        if (!await repo.consumeReset(hash(token), await bcrypt.hash(password, 12), now())) v.fail('Reset credential is invalid, expired or already used.');
        res.clearCookie(SESSION_COOKIE, cookieOptions);
        res.json({ valid: true });
    });
}

// Candidate APIs: profile sections and private resume files.
function mountProfileRoutes(app, { repo, config, limit, auth, candidate, inspectFile }) {
    app.use('/api/profile', auth, candidate);
    app.get('/api/profile', async (req, res) => res.json({ valid: true, profile: await repo.profile(req.user.account_id) }));
    app.put('/api/profile', async (req, res) => { await repo.updateProfile(req.candidate.candidate_id, v.profile(req.body)); res.json({ valid: true }); });
    app.put('/api/profile/summary', async (req, res) => {
        await repo.updateProfile(req.candidate.candidate_id, { personal_summary: v.text(req.body.personal_summary, 'Summary', 2000) });
        res.json({ valid: true });
    });
    for (const type of ['skills', 'languages']) app.put(`/api/profile/${type}`, async (req, res) => {
        await repo.replaceList(req.candidate.candidate_id, type, v[type](req.body[type])); res.json({ valid: true });
    });
    for (const section of Object.keys(v.sections)) {
        app.post(`/api/profile/${section}`, async (req, res) => {
            const id = await repo.saveSection(req.candidate.candidate_id, section, null, v.sections[section].validate(req.body));
            res.status(201).json({ valid: true, id });
        });
        app.put(`/api/profile/${section}/:id`, async (req, res) => {
            const id = await repo.saveSection(req.candidate.candidate_id, section, v.id(req.params.id), v.sections[section].validate(req.body));
            if (!id) v.fail('Record not found.', 404);
            res.json({ valid: true, id });
        });
        app.delete(`/api/profile/${section}/:id`, async (req, res) => {
            if (!await repo.deleteSection(req.candidate.candidate_id, section, v.id(req.params.id))) v.fail('Record not found.', 404);
            res.json({ valid: true });
        });
    }
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
    app.post('/api/profile/resume', async (req, res, next) => { await limit(req, 'upload', 20, 3600, String(req.user.account_id)); next(); }, upload.single('resume'), async (req, res) => {
        const type = await inspectFile(req.file), key = random();
        const name = v.text(path.basename(req.file.originalname.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, ''), 'Filename', 255, true);
        await fs.mkdir(config.uploadDir, { recursive: true });
        const filename = path.join(config.uploadDir, key);
        await fs.writeFile(filename, req.file.buffer, { flag: 'wx', mode: 0o600 });
        let id;
        try { id = await repo.addResume(req.candidate.candidate_id, { name, key, type, size: req.file.size }); }
        catch (error) { await fs.unlink(filename); throw error; }
        res.status(201).json({ valid: true, id });
    });
    app.get('/api/profile/resume/:id', async (req, res, next) => {
        const file = await repo.resume(req.candidate.candidate_id, v.id(req.params.id));
        if (!file || !/^[a-f0-9]{64}$/.test(file.storage_key)) v.fail('File not found.', 404);
        res.set('Content-Type', file.file_type);
        // The authenticated, validated storage key may live under a hidden project/upload directory.
        res.download(path.join(config.uploadDir, file.storage_key), file.file_name, { dotfiles: 'allow' }, error => { if (error) next(error); });
    });
}

// Register APIs in the original order so candidate guards and HR isolation are preserved.
function mountApi(app, dependencies) {
    mountAuthRoutes(app, dependencies);
    mountProfileRoutes(app, dependencies);
    if (dependencies.repo.pool) {
        const { createHrIntegration } = require('./services/hr-integration');
        app.use('/hr', createHrIntegration({ repository: dependencies.repo, config: dependencies.config, auth: dependencies.auth }));
    }
}

module.exports = { mountApi, mountAuthRoutes, mountProfileRoutes };
