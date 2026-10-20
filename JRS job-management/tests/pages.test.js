/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const read = file => fs.readFileSync(path.join(__dirname, '../client', file), 'utf8');
async function page(folder, scripts = [], api = {}, query = '') {
    const dom = new JSDOM(read(`pages/${folder}/${folder}.html`), { url: `http://localhost/pages/${folder}/${folder}.html${query}`, runScripts: 'outside-only' });
    dom.window.apiMock = api;
    dom.window.eval([read('utils/api_utils.js'), 'Object.assign(apiUtils, window.apiMock);', ...scripts.map(read), 'window.testUi = ui;'].join('\n'));
    await new Promise(resolve => dom.window.addEventListener('load', resolve));
    await new Promise(resolve => setTimeout(resolve, 0));
    return dom;
}
test('job list preserves an empty API result and renders untrusted titles as text', async () => {
    const api = { get: jest.fn().mockResolvedValue({ data: [] }) };
    const dom = await page('job-management', ['pages/job-management/jobManagement.js'], api);
    const doc = dom.window.document;
    try {
        expect(doc.getElementById('jobTableBody').textContent).toContain('No jobs found');
        api.get.mockResolvedValue({ data: [{ id: 1, title: '<img src=x onerror=alert(1)>', department: 'IT', type: 'Contract', status: 'Active' }] });
        doc.getElementById('searchInput').dispatchEvent(new dom.window.Event('input')); await new Promise(resolve => setTimeout(resolve, 0));
        expect(doc.getElementById('jobTableBody').querySelector('img')).toBeNull();
        expect(doc.getElementById('jobTableBody').textContent).toContain('<img');
        expect(doc.querySelector('#jobTableBody a').getAttribute('href')).toContain('id=1');
    } finally { dom.window.close(); }
});
test('all page titles have consistent navigation, breadcrumbs and linked labels', async () => {
    for (const folder of ['job-management','create-job','edit-job','interview-schedule','interview-feedback']) {
        const dom = await page(folder);
        try {
            const doc = dom.window.document;
            expect(doc.querySelectorAll('.nav-item')).toHaveLength(6);
            expect(Array.from(doc.querySelectorAll('.nav-item')).map(item => item.textContent)).toEqual(['Dashboard', 'Applications', 'Candidates', 'Job Postings', 'Interviews', 'Notifications']);
            expect(doc.querySelector('a.nav-item[href="../job-management/job-management.html"]')).not.toBeNull();
            expect(doc.querySelector('a.nav-item[href="../interview-schedule/interview-schedule.html"]')).not.toBeNull();
            expect(doc.querySelector('[aria-current="page"]').textContent).toBe(doc.querySelector('h1').textContent);
            expect(doc.querySelector('.nav-item.active').textContent).toBe(folder.includes('interview') ? 'Interviews' : 'Job Postings');
            doc.querySelectorAll('label.form-label').forEach(label => expect(doc.getElementById(label.htmlFor)).not.toBeNull());
        } finally { dom.window.close(); }
    }
});
test('publishing uses one request even on repeated submit and redirects only after persistence', async () => {
    let finish;
    const api = { post: jest.fn(() => new Promise(resolve => { finish = resolve; })) };
    const dom = await page('create-job', ['pages/create-job/createJob.js'], api);
    try {
        const doc = dom.window.document; const go = jest.fn(); dom.window.testUi.go = go;
        doc.getElementById('jobTitle').value = 'Engineer';
        const form = doc.getElementById('createJobForm');
        form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
        form.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
        expect(api.post).toHaveBeenCalledTimes(1); expect(go).not.toHaveBeenCalled();
        finish({ id: 1 }); await new Promise(resolve => setTimeout(resolve, 0));
        expect(go).toHaveBeenCalledWith('/pages/job-management/job-management.html');
    } finally { dom.window.close(); }
});
test('API failures stay visible and never become successful navigation', async () => {
    const api = { post: jest.fn().mockRejectedValue(new Error('Cannot save')) };
    const dom = await page('create-job', ['pages/create-job/createJob.js'], api);
    try {
        const doc = dom.window.document; const go = jest.fn(); dom.window.testUi.go = go;
        doc.getElementById('jobTitle').value = 'Engineer';
        doc.getElementById('createJobForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(doc.getElementById('pageMessage').textContent).toBe('Cannot save'); expect(go).not.toHaveBeenCalled();
        expect(doc.getElementById('publishBtn').disabled).toBe(false);
    } finally { dom.window.close(); }
});
test('100-row lists render all records with scrollable containers and correct feedback IDs', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, candidate: `Candidate ${i + 1}`, position: 'Engineer', interviewer: 'Michael Tan', date: '2026-11-01T10:00', status: 'Confirmed' }));
    const dom = await page('interview-schedule', ['pages/interview-schedule/interviewSchedule.js'], { get: jest.fn().mockResolvedValue({ data: rows }) });
    try {
        const doc = dom.window.document;
        expect(doc.querySelectorAll('#interviewTableBody tr')).toHaveLength(100);
        expect(doc.getElementById('resultCount').textContent).toBe('(100)');
        expect(doc.querySelector('#interviewTableBody tr:last-child a').href).toContain('id=100');
        expect(doc.querySelector('.table-scroll').getAttribute('tabindex')).toBe('0');
        const css = read('assets/css/styles.css'); expect(css).toContain('overflow: auto'); expect(css).toContain('position: sticky');
    } finally { dom.window.close(); }
});
test('feedback loads the selected candidate, saves custom ratings and returns to the list', async () => {
    const dom = new JSDOM(read('pages/interview-feedback/interview-feedback.html'), { url: 'http://localhost/pages/interview-feedback/interview-feedback.html?id=23', runScripts: 'outside-only' });
    const api = { get: jest.fn().mockResolvedValue({ data: { candidate: 'Tom Tan', position: 'Technical Lead', date: '2026-11-01T10:00', location: 'Room 1', interviewer: 'Michael Tan', comments: 'Saved comments', recommendation: 'Offer', ratings: { Experience: 4.5 } } }), put: jest.fn().mockResolvedValue({}) };
    dom.window.apiMock = api;
    dom.window.eval([read('utils/api_utils.js'), 'Object.assign(apiUtils, window.apiMock);', read('pages/interview-feedback/interviewFeedback.js'), 'window.testUi = ui;'].join('\n'));
    await new Promise(resolve => dom.window.addEventListener('load', resolve)); await new Promise(resolve => setTimeout(resolve, 0));
    try {
        const doc = dom.window.document; const go = jest.fn(); dom.window.testUi.go = go;
        expect(api.get).toHaveBeenCalledWith('/interviews/23');
        expect(doc.getElementById('candidateName').textContent).toBe('Tom Tan');
        expect(doc.getElementById('candidateInterviewer').textContent).toBe('Michael Tan');
        doc.getElementById('assessmentName').value = 'Problem Solving'; doc.getElementById('addAssessmentBtn').click();
        doc.querySelector('.competency-row:last-child input').value = '5';
        doc.getElementById('feedbackForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(api.put).toHaveBeenCalledWith('/interviews/23/feedback', { comments: 'Saved comments', recommendation: 'Offer', ratings: { Experience: 4.5, 'Problem Solving': 5 } });
        expect(go).toHaveBeenCalledWith('/pages/interview-schedule/interview-schedule.html');
    } finally { dom.window.close(); }
});
test('outdated filter responses cannot overwrite the latest search results', async () => {
    let resolveOld;
    const api = { get: jest.fn().mockResolvedValueOnce({ data: [] }).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce({ data: [{ id: 2, title: 'Latest', department: 'IT', type: 'Contract', status: 'Active' }] }) };
    const dom = await page('job-management', ['pages/job-management/jobManagement.js'], api);
    try {
        const doc = dom.window.document; const search = doc.getElementById('searchInput');
        search.value = 'old'; search.dispatchEvent(new dom.window.Event('input'));
        search.value = 'latest'; search.dispatchEvent(new dom.window.Event('input')); await new Promise(resolve => setTimeout(resolve, 0));
        resolveOld({ data: [] }); await new Promise(resolve => setTimeout(resolve, 0));
        expect(doc.getElementById('jobTableBody').textContent).toContain('Latest');
    } finally { dom.window.close(); }
});
test('New Job and Edit links carry users to the existing page paths', async () => {
    const dom = await page('job-management', ['pages/job-management/jobManagement.js'], { get: jest.fn().mockResolvedValue({ data: [{ id: 37, title: 'Engineer', department: 'IT', type: 'Contract', status: 'Active' }] }) });
    try {
        const doc = dom.window.document;
        expect(doc.getElementById('newJobBtn').getAttribute('href')).toBe('../create-job/create-job.html');
        expect(doc.querySelector('#jobTableBody a').getAttribute('href')).toBe('../edit-job/edit-job.html?id=37');
    } finally { dom.window.close(); }
});
test.each(['create-job', 'edit-job', 'interview-feedback'])('Cancel on %s returns to its parent list', async folder => {
    const dom = await page(folder);
    try {
        const go = jest.fn(); dom.window.testUi.go = go;
        const button = dom.window.document.querySelector('[data-cancel]');
        if (button.closest('fieldset')) button.closest('fieldset').disabled = false;
        button.click();
        expect(go).toHaveBeenCalledWith(folder === 'interview-feedback' ? '/pages/interview-schedule/interview-schedule.html' : '/pages/job-management/job-management.html');
    } finally { dom.window.close(); }
});
test.each(['saveBtn', 'savePublishBtn', 'deleteBtn'])('Edit action %s uses the selected ID and returns after success', async action => {
    const api = { get: jest.fn().mockResolvedValue({ data: { id: 37, title: 'Engineer', department: 'IT', type: 'Contract', status: 'Draft', publication_status: 'Draft' } }), put: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}) };
    const dom = await page('edit-job', ['pages/edit-job/editJob.js'], api, '?id=37');
    try {
        const go = jest.fn(); dom.window.testUi.go = go; dom.window.confirm = () => true;
        const doc = dom.window.document;
        expect(api.get).toHaveBeenCalledWith('/jobs/37');
        if (action === 'saveBtn') doc.getElementById('editJobForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
        else doc.getElementById(action).click();
        await new Promise(resolve => setTimeout(resolve, 0));
        if (action === 'deleteBtn') expect(api.delete).toHaveBeenCalledWith('/jobs/37');
        else expect(api.put).toHaveBeenCalledWith('/jobs/37', expect.objectContaining({ status: action === 'saveBtn' ? 'Draft' : 'Active' }));
        expect(go).toHaveBeenCalledWith('/pages/job-management/job-management.html');
    } finally { dom.window.close(); }
});
test('sidebar links exist before JavaScript runs and resolve from every existing page', () => {
    for (const folder of ['job-management','create-job','edit-job','interview-schedule','interview-feedback']) {
        const dom = new JSDOM(read(`pages/${folder}/${folder}.html`), { url: `http://localhost/pages/${folder}/${folder}.html` });
        try {
            const links = dom.window.document.querySelectorAll('#sidebar a');
            expect(links).toHaveLength(2);
            expect(Array.from(links).map(link => new URL(link.href).pathname)).toEqual(['/pages/job-management/job-management.html', '/pages/interview-schedule/interview-schedule.html']);
            for (const link of links) expect(fs.existsSync(path.join(__dirname, '../client', new URL(link.href).pathname))).toBe(true);
        } finally { dom.window.close(); }
    }
});
test('clicking a rating star updates the saved score while half scores remain editable', async () => {
    const api = { get: jest.fn().mockResolvedValue({ data: { candidate: 'Jane Doe', ratings: { Experience: 4.5 } } }) };
    const dom = await page('interview-feedback', ['pages/interview-feedback/interviewFeedback.js'], api, '?id=1');
    try {
        const doc = dom.window.document;
        expect(doc.querySelectorAll('.star-button.filled')).toHaveLength(4);
        expect(doc.querySelectorAll('.star-button.half')).toHaveLength(1);
        doc.querySelector('.star-button').click();
        expect(doc.querySelector('.rating-input').value).toBe('1');
        expect(doc.querySelectorAll('.star-button.filled')).toHaveLength(1);
    } finally { dom.window.close(); }
});
