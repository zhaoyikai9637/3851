/** @jest-environment node */
const http = require('http');
const fs = require('fs');
const path = require('path');
process.env.DB_PATH = ':memory:';
const app = require('../server/server');
const db = require('../server/config/db');
let server;
let base;
let jobId;
let interviewId;
function request(url, method = 'GET', data) {
    return new Promise((resolve, reject) => {
        const req = http.request(`${base}${url}`, { method, headers: { 'Content-Type': 'application/json' } }, res => {
            let body = ''; res.on('data', chunk => { body += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, json: () => JSON.parse(body) }));
        });
        req.on('error', reject); if (data) req.write(JSON.stringify(data)); req.end();
    });
}
const job = { title: 'Engineer', department: 'IT', type: 'Contract', closingDate: '2026-12-20', publishDate: '2026-01-01', unpublishDate: '2026-12-31', status: 'Draft' };
beforeAll(async () => {
    await db.ready;
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); await new Promise(resolve => db.close(resolve)); });
test('root opens Job Management and every HTML script / stylesheet resolves', async () => {
    const root = await request('/'); expect(root.status).toBe(302); expect(root.headers.location).toContain('job-management.html');
    for (const folder of ['job-management', 'create-job', 'edit-job', 'interview-schedule', 'interview-feedback']) {
        const url = `/pages/${folder}/${folder}.html`;
        const result = await request(url); expect(result.status).toBe(200);
        for (const match of result.body.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)) {
            const asset = new URL(match[1], `${base}${url}`); expect((await request(asset.pathname)).status).toBe(200);
        }
    }
});
test('job validation rejects blank fields, impossible dates and invalid date order', async () => {
    for (const invalid of [{ ...job, title: '  ' }, { ...job, type: 'Unknown' }, { ...job, closingDate: '2026-02-30' }, { ...job, publishDate: '2027-01-01' }, { ...job, unpublishDate: '2026-01-01' }]) expect((await request('/api/jobs', 'POST', invalid)).status).toBe(400);
});
test('create, read and update persist every job field and draft state', async () => {
    const created = await request('/api/jobs', 'POST', job); expect(created.status).toBe(201); jobId = created.json().id;
    let record = (await request(`/api/jobs/${jobId}`)).json().data; expect(record.status).toBe('Draft'); expect(record.type).toBe('Contract');
    const changed = { ...job, title: 'Updated Engineer', description: 'Full description', requirements: 'Experience', status: 'Active' };
    expect((await request(`/api/jobs/${jobId}`, 'PUT', changed)).status).toBe(200);
    record = (await request(`/api/jobs/${jobId}`)).json().data;
    expect(record).toMatchObject({ title: changed.title, description: changed.description, requirements: changed.requirements, publish_date: job.publishDate, unpublish_date: job.unpublishDate, type: 'Contract' });
    expect((await request('/api/jobs?search=does-not-exist')).json().data).toEqual([]);
    expect((await request('/api/jobs?department=HR')).json().data).toEqual([]);
});
test('publication window applies to both list and details, while preserving saved publication status', async () => {
    for (const dates of [{ publishDate: '2099-01-01', closingDate: '2099-02-01', unpublishDate: '2099-03-01' }, { publishDate: '2000-01-01', closingDate: '2000-02-01', unpublishDate: '2000-03-01' }]) {
        const created = (await request('/api/jobs', 'POST', { ...job, ...dates, status: 'Active' })).json();
        const record = (await request(`/api/jobs/${created.id}`)).json().data;
        expect(record.status).toBe('Unpublished'); expect(record.publication_status).toBe('Active');
        expect((await request('/api/jobs?status=Active')).json().data.some(item => item.id === created.id)).toBe(false);
    }
});
test('interview creation validates data and returns persistent details', async () => {
    const interview = { candidate: 'Alice <img onerror=alert(1)>', position: 'Updated Engineer', location: 'Room 1', type: 'On-site', interviewer: 'HR Manager', date: '2026-11-01T10:30', status: 'Confirmed' };
    expect((await request('/api/interviews', 'POST', { ...interview, date: '2026-02-30T10:30' })).status).toBe(400);
    expect((await request('/api/interviews', 'POST', { ...interview, candidate: '' })).status).toBe(400);
    const result = await request('/api/interviews', 'POST', interview); expect(result.status).toBe(201); interviewId = result.json().id;
    expect((await request(`/api/interviews/${interviewId}`)).json().data).toMatchObject({ ...interview, isoDate: '2026-11-01', ratings: {} });
    expect((await request('/api/interviews?isoDate=2026-11-02')).json().data).toEqual([]);
    expect((await request('/api/interviews?status=Confirmed')).json().data).toHaveLength(1);
});
test('feedback accepts custom assessment names, persists scores and updates status', async () => {
    const feedback = { comments: 'Good interview', recommendation: 'Offer', ratings: { Experience: 4.5, 'Problem Solving': 5 } };
    for (const ratings of [{ Experience: 6 }, { Experience: 1.2 }, {}, { Experience: '5' }]) expect((await request(`/api/interviews/${interviewId}/feedback`, 'PUT', { ...feedback, ratings })).status).toBe(400);
    expect((await request(`/api/interviews/${interviewId}/feedback`, 'PUT', feedback)).status).toBe(200);
    expect((await request(`/api/interviews/${interviewId}`)).json().data).toMatchObject({ ...feedback, status: 'Completed' });
    expect((await request('/api/interviews?status=Completed')).json().data).toHaveLength(1);
});
test('missing records and malformed identifiers have accurate error responses', async () => {
    for (const resource of ['jobs', 'interviews']) {
        expect((await request(`/api/${resource}/999999`)).status).toBe(404);
        expect((await request(`/api/${resource}/abc`)).status).toBe(400);
    }
    expect((await request('/api/jobs/999999', 'PUT', job)).status).toBe(404);
    expect((await request('/api/jobs/999999', 'DELETE')).status).toBe(404);
    expect((await request(`/api/jobs/${jobId}`, 'DELETE')).status).toBe(200);
    expect((await request(`/api/jobs/${jobId}`)).status).toBe(404);
    expect((await request('/api/unknown')).status).toBe(404);
});
test('reference examples fill to 100 rows without overwriting records or duplicating on rerun', async () => {
    const original = (await request('/api/jobs')).json().data;
    const first = await db.seedSamples({ backup: false });
    expect(first.after.jobs).toBeGreaterThanOrEqual(100);
    expect(first.after.interviews).toBeGreaterThanOrEqual(100);
    for (const row of original) expect((await request(`/api/jobs/${row.id}`)).json().data).toEqual(row);
    const jane = (await request('/api/interviews?search=Jane%20Doe')).json().data[0];
    expect(jane).toMatchObject({ candidate: 'Jane Doe', position: 'Software Engineer', location: 'A01', interviewer: 'Michael Tan', isoDate: '2026-07-29', ratings: { Experience: 5, 'Technical Skills': 4 } });
    const senior = (await request('/api/jobs?search=Senior%20Software%20Engineer')).json().data.find(row => row.title === 'Senior Software Engineer');
    expect(senior.description).toContain('enterprise web applications');
    expect(senior.closing_date).toBe('2026-12-31'); expect(senior.unpublish_date).toBe('2027-01-01');
    const second = await db.seedSamples({ backup: false }); expect(second.after).toEqual(first.after);
});
