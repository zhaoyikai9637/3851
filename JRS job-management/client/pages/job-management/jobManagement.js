// Fixtures remain exported for legacy filter tests; the UI always uses the API.
const initialJobs = [
    { id: 1, title: 'Software Engineer', department: 'IT', type: 'Full-time', applicants: 45, status: 'Active' },
    { id: 2, title: 'UI / UX Designer', department: 'Design', type: 'Full-time', applicants: 26, status: 'Active' },
    { id: 3, title: 'HR Executive', department: 'HR', type: 'Contract', applicants: 13, status: 'Unpublished' }
];
function filterJobs(jobs, search = '', dept = '', status = '') {
    return jobs.filter(job => job.title.toLowerCase().includes(search.trim().toLowerCase()) && (!dept || job.department === dept) && (!status || job.status === status));
}
function deleteJob(jobs, id) { return jobs.filter(job => job.id !== id); }
let jobRequest = 0;
async function fetchAndRenderJobs() {
    const request = ++jobRequest;
    ui.message('Loading jobs...');
    try {
        const { data } = await apiUtils.get('/jobs', { search: document.getElementById('searchInput').value.trim(), department: document.getElementById('departmentFilter').value, status: document.getElementById('statusFilter').value });
        if (request !== jobRequest) return;
        renderJobs(data); ui.message('');
    } catch (error) {
        if (request !== jobRequest) return;
        ui.empty(document.getElementById('jobTableBody'), 6, 'Unable to load jobs. Change a filter or reload to retry.');
        document.getElementById('resultCount').textContent = ''; ui.message(error.message, true);
    }
}
function renderJobs(jobs) {
    const tbody = document.getElementById('jobTableBody'); if (!tbody) return;
    tbody.replaceChildren(); document.getElementById('resultCount').textContent = `(${jobs.length})`;
    if (!jobs.length) { ui.empty(tbody, 6, 'No jobs found.'); return; }
    for (const job of jobs) {
        const row = tbody.insertRow();
        [job.title, job.department, job.type, job.applicants || 0].forEach(value => ui.cell(row, value));
        ui.badge(ui.cell(row, ''), job.status);
        const actions = ui.cell(row, ''); actions.className = 'row-actions';
        const edit = document.createElement('a'); edit.className = 'btn btn-primary'; edit.textContent = 'Edit'; edit.href = `../edit-job/edit-job.html?id=${encodeURIComponent(job.id)}`; actions.append(edit);
        ui.action(actions, 'Delete', async () => {
            if (!confirm('Delete this job? This cannot be undone.')) return;
            actions.querySelectorAll('button').forEach(button => { button.disabled = true; });
            try { await apiUtils.delete(`/jobs/${encodeURIComponent(job.id)}`); await fetchAndRenderJobs(); }
            catch (error) { ui.message(error.message, true); actions.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
        }, true);
    }
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('jobTableBody')) return;
    fetchAndRenderJobs();
    ['searchInput', 'departmentFilter', 'statusFilter'].forEach(id => document.getElementById(id).addEventListener(id === 'searchInput' ? 'input' : 'change', fetchAndRenderJobs));
});
if (typeof module !== 'undefined') module.exports = { initialJobs, filterJobs, deleteJob, renderJobs };
