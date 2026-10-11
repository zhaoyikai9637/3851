const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const v = require('../services/validation');
const { hash, random, SESSION_COOKIE } = require('../utils/tokens');

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
module.exports = { mountAuthRoutes };
