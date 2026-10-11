const path = require('node:path');
const fs = require('node:fs/promises');
const multer = require('multer');
const v = require('../services/validation');
const { random } = require('../utils/tokens');

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
        res.download(path.join(config.uploadDir, file.storage_key), file.file_name, error => { if (error) next(error); });
    });
}
module.exports = { mountProfileRoutes };
