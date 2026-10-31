const path = require('node:path');
const { createApp } = require('../../integrations/hr/server/app.cjs');
const { createRepository } = require('../../integrations/hr/server/repository.cjs');
const { publicUser } = require('../../integrations/hr/server/auth.cjs');
const { HttpError } = require('../../integrations/hr/server/errors.cjs');
function createHrIntegration({ repository, config, auth }) {
    const cfg = { origin: config.origin, secure: config.production, sessionHours: config.sessionMs / 3600000,
        publicDir: path.resolve(__dirname, '../../integrations/hr/dist'), writesEnabled: true,
        mail: { enabled: false } };
    const sharedAuth = {
        async login(req, res) { throw new HttpError(409, 'Use the shared JRS login page.'); },
        async requireUser(req, res, next) {
            await auth(req, res, () => {});
                if (req.user.role !== 'hr') throw new HttpError(403, 'HR access only.');
                const identity = await repository.hrIdentity(req.user.account_id);
                if (!identity) throw new HttpError(403, 'HR account is inactive.');
                const id = `team-hr-${identity.user_id}`;
                const [[row]] = await repository.pool.execute('SELECT * FROM jrs_portal_hr_user WHERE id=?', [id]);
                if (!row || row.status !== 'Active' || row.role !== identity.role) throw new HttpError(403, 'HR workspace account is unavailable.');
                req.sharedAccount = req.user;
                req.user = publicUser({ ...row, name: identity.full_name, email: identity.email });
                req.session = { csrf: req.sharedAccount.csrf };
                next();
        },
        async logout(req, res) {
            await repository.logout(req.sid);
            const { SESSION_COOKIE } = require('../utils/tokens');
            res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' });
            res.json({ ok: true });
        },
        async changePassword(req, res) {
            const changed = await repository.changePassword(req.sharedAccount.account_id, req.body.currentPassword, req.body.newPassword);
            if (!changed) throw new HttpError(422, 'Current password is incorrect.');
            const { SESSION_COOKIE } = require('../utils/tokens');
            res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' });
            res.json({ ok: true });
        }
    };
    return createApp({ repo: createRepository(repository.pool), cfg, sharedAuth });
}
module.exports = { createHrIntegration };
