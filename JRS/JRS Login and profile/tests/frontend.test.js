const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '../client');
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
let dom, state, request;
beforeEach(async () => {
    dom = new JSDOM(fs.readFileSync(path.join(root, 'pages/profile/profile.html'), 'utf8'), {
        url: 'http://localhost:3001/pages/profile/profile.html', runScripts: 'outside-only'
    });
    await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
    state = { candidate_id: 1, full_name: 'Alice Test', first_name: 'Alice', last_name: 'Test', email: 'alice@example.test',
        country_code: '+65', contact_number: '', personal_summary: '<img src=x onerror="alert(1)">',
        home_location: '', career: [{ role_id: 7, job_title: 'Developer', company_name: 'Company', start_month_year: '2025-01', is_current_role: true, description: 'Original details' }],
        education: [], certifications: [], skills: ['SQL'], languages: [], resumes: [] };
    request = jest.fn(async (url, options) => {
        if (url === '/me') return { valid: true };
        if (!options) return { valid: true, profile: structuredClone(state) };
        if (url === '/profile/career/7') Object.assign(state.career[0], options.body);
        else if (url === '/profile') Object.assign(state, options.body);
        else if (url === '/profile/skills') state.skills = options.body.skills;
        else if (url === '/profile/languages') state.languages = options.body.languages;
        return { valid: true };
    });
    dom.window.JRS = { request };
    for (const file of ['utils/profile_utils.js', 'utils/materials_summary_utils.js', 'utils/skills_utils.js', 'pages/profile/profile.js']) {
        dom.window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
    }
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    await settle();
});
afterEach(() => dom.window.close());
test('untrusted summary is rendered literally, without injected DOM elements', () => {
    const summary = dom.window.document.getElementById('summaryContent');
    expect(summary.textContent).toContain('<img src=x');
    expect(summary.querySelector('img')).toBeNull();
});
test('editing a career record fills fields and submits PUT to the original ID', async () => {
    const doc = dom.window.document;
    doc.querySelector('#careerList button').click();
    expect(doc.getElementById('roleTitle').value).toBe('Developer');
    expect(doc.getElementById('roleDescription').value).toBe('Original details');
    expect(doc.getElementById('roleStillInRole').checked).toBe(true);
    doc.getElementById('roleTitle').value = 'Updated role';
    doc.getElementById('roleForm').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(request).toHaveBeenCalledWith('/profile/career/7', expect.objectContaining({ method: 'PUT', body: expect.objectContaining({ job_title: 'Updated role' }) }));
    expect(doc.querySelectorAll('#careerList .profile-card-item')).toHaveLength(1);
    expect(doc.getElementById('careerList').textContent).toContain('Updated role');
});
test('skills draft changes are discarded by Cancel', () => {
    const doc = dom.window.document;
    doc.getElementById('addSkillBtn').click();
    doc.getElementById('skillInput').value = 'JavaScript'; doc.getElementById('addSkillTagBtn').click();
    expect(doc.getElementById('addedSkillsContainer').textContent).toContain('JavaScript');
    doc.getElementById('cancelSkillsBtn').click(); doc.getElementById('addSkillBtn').click();
    expect(doc.getElementById('addedSkillsContainer').textContent).not.toContain('JavaScript');
    expect(state.skills).toEqual(['SQL']);
});
test('basic details submit phone and home location; failed saves keep the drawer open', async () => {
    const doc = dom.window.document;
    doc.getElementById('editMaterialsBtn').click();
    doc.getElementById('editHomeLocation').value = 'Singapore';
    doc.getElementById('editContactNumber').value = '91234567';
    request.mockRejectedValueOnce(new Error('Connection lost'));
    doc.getElementById('materialsForm').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(doc.getElementById('materialsDrawer').classList.contains('open')).toBe(true);
    expect(doc.getElementById('profileMessage').textContent).toBe('Connection lost');
    expect(request).toHaveBeenCalledWith('/profile', expect.objectContaining({ body: expect.objectContaining({ home_location: 'Singapore', contact_number: '91234567' }) }));
});
test('all local HTML resources exist and no inline event handlers remain', () => {
    function walk(folder) {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            const filename = path.join(folder, entry.name);
            if (entry.isDirectory()) { walk(filename); continue; }
            if (!filename.endsWith('.html')) continue;
            const html = fs.readFileSync(filename, 'utf8');
            expect(html).not.toMatch(/\son\w+\s*=/i);
            for (const match of html.matchAll(/(?:src|href|action)="([^"]+)"/g)) {
                if (/^(https?:|#)/.test(match[1]) || match[1] === '/jobs') continue; // Public route supplied by the integrated server.
                expect(fs.existsSync(match[1].startsWith('/') ? path.join(root, match[1].slice(1)) : path.resolve(folder, match[1]))).toBe(true);
            }
            const script = filename.replace(/\.html$/, '.js');
            if (fs.existsSync(script)) {
                for (const match of fs.readFileSync(script, 'utf8').matchAll(/window\.location\.(?:href\s*=\s*|replace\(\s*)['"]([^'"]+)['"]/g)) {
                    expect(fs.existsSync(path.resolve(folder, match[1]))).toBe(true);
                }
            }
        }
    }
    walk(root);
});
