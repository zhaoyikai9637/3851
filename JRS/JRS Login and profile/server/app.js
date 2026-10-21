const express = require('express');
const path = require('node:path');
const multer = require('multer');
const v = require('./services/validation');
const { inspectResume } = require('./services/files');
const { mountApi } = require('./api');
const { hash, SESSION_COOKIE } = require('./utils/tokens');

function createApp({ repository: repo, config, mailer, now = () => new Date(), inspectFile = inspectResume }) {
    const app = express();
    app.disable('x-powered-by');
    const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' };
    app.use((req, res, next) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Referrer-Policy', 'same-origin');
        res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
        if (config.production) res.set('Strict-Transport-Security', 'max-age=31536000');
        if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
        next();
    });
    // Same-origin deployment; cross-origin writes are rejected, including login CSRF.
    app.use('/api', (req, res, next) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            if ((req.get('origin') && req.get('origin') !== config.origin) || req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ valid: false, error: 'Origin not allowed.' });
        }
        next();
    });
    app.use(express.json({ limit: '64kb' }));
    app.use((req, res, next) => { req.body ||= {}; next(); });
    async function limit(req, label, count, seconds, subject = req.ip) {
        const time = now().getTime(), window = Math.floor(time / (seconds * 1000));
        const key = hash(`${label}:${subject}:${window}`);
        if (!await repo.rateLimit(key, new Date((window + 1) * seconds * 1000), count)) v.fail('Too many requests. Please try again later.', 429);
    }
    function sessionId(req) {
        const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${SESSION_COOKIE}=`));
        const token = cookie?.slice(SESSION_COOKIE.length + 1);
        return /^[a-f0-9]{64}$/.test(token || '') ? `candidate:${hash(token)}` : null;
    }
    async function auth(req, res, next) {
        req.sid = sessionId(req);
        req.user = req.sid ? await repo.session(req.sid) : null;
        if (!req.user) v.fail('Please log in.', 401);
        if (!['GET', 'HEAD'].includes(req.method) && req.get('x-csrf-token') !== req.user.csrf) v.fail('Invalid request token. Reload the page.', 403);
        next();
    }
    async function candidate(req, res, next) {
        if (req.user.role !== 'candidate') v.fail('Candidate access only.', 403);
        req.candidate = await repo.candidate(req.user.account_id);
        if (!req.candidate) v.fail('Candidate profile is unavailable.', 409);
        next();
    }
    mountApi(app, { repo, config, mailer, now, limit, auth, candidate, inspectFile, sessionId, cookieOptions });
    app.use('/api', (req, res) => res.status(404).json({ valid: false, error: 'API not found.' }));
    app.get('/', (req, res) => res.redirect('/pages/login/login.html'));
    // Only frontend assets are exposed; .env, source and uploads are outside this root.
    app.use(express.static(path.join(__dirname, '../client'), { dotfiles: 'deny', index: false }));
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const status = error instanceof multer.MulterError ? 400 : error.status || (error.code === 'ENOENT' ? 404 : 500);
        if (status >= 500 && !error.status) console.error('Request failed:', error.code || 'INTERNAL_ERROR');
        res.status(status).json({ valid: false, error: status >= 500 && !error.status ? 'Server error. Please try again later.' : error instanceof multer.MulterError ? 'Upload one file of at most 5 MB.' : status === 404 && !error.status ? 'Not found.' : error.message });
    });
    return app;
}
module.exports = { createApp, hash };
