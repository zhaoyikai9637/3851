const initialInterviews = [
    { id: 1, candidate: 'Jane Doe', isoDate: '2026-07-29', status: 'Confirmed' },
    { id: 2, candidate: 'Alex Tan', isoDate: '2026-07-29', status: 'Pending' },
    { id: 3, candidate: 'Mary Smith', isoDate: '2026-07-30', status: 'Confirmed' }
];
function filterInterviews(list, search = '', date = '', status = '') {
    return list.filter(item => item.candidate.toLowerCase().includes(search.trim().toLowerCase()) && (!date || (item.isoDate || item.iso_date) === date) && (!status || item.status === status));
}
let interviewRequest = 0;
async function fetchAndRenderInterviews() {
    const request = ++interviewRequest;
    ui.message('Loading interviews...');
    try {
        const { data } = await apiUtils.get('/interviews', { search: document.getElementById('searchInput').value.trim(), isoDate: document.getElementById('dateFilter').value, status: document.getElementById('statusFilter').value });
        if (request !== interviewRequest) return;
        renderInterviews(data); ui.message('');
    } catch (error) {
        if (request !== interviewRequest) return;
        ui.empty(document.getElementById('interviewTableBody'), 8, 'Unable to load interviews. Change a filter or reload to retry.');
        document.getElementById('resultCount').textContent = ''; ui.message(error.message, true);
    }
}
function renderInterviews(list) {
    const tbody = document.getElementById('interviewTableBody'); if (!tbody) return;
    tbody.replaceChildren(); document.getElementById('resultCount').textContent = `(${list.length})`;
    if (!list.length) { ui.empty(tbody, 8, 'No interviews found.'); return; }
    list.forEach(item => {
        const row = tbody.insertRow();
        [item.candidate, item.position, item.location, item.type, item.interviewer, (item.date || '').replace('T', ' ')].forEach(value => ui.cell(row, value));
        ui.badge(ui.cell(row, ''), item.status);
        const cell = ui.cell(row, ''); const link = document.createElement('a'); link.className = 'btn btn-primary'; link.textContent = item.status === 'Completed' ? 'View Feedback' : 'Add Feedback'; link.href = `../interview-feedback/interview-feedback.html?id=${encodeURIComponent(item.id)}`; cell.append(link);
    });
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('interviewTableBody')) return;
    fetchAndRenderInterviews();
    ['searchInput', 'dateFilter', 'statusFilter'].forEach(id => document.getElementById(id).addEventListener(id === 'searchInput' ? 'input' : 'change', fetchAndRenderInterviews));
    const dialog = document.getElementById('interviewDialog');
    document.getElementById('newInterviewBtn').addEventListener('click', async () => {
        const button = document.getElementById('newInterviewBtn'); button.disabled = true;
        try {
            const { data } = await apiUtils.get('/jobs', { status: 'Active' });
            const position = document.getElementById('position'); position.replaceChildren(new Option('Select an active job', ''));
            data.forEach(job => position.add(new Option(`${job.title} (${job.department})`, job.title)));
            if (position.options.length === 1) { ui.message('Create or publish an open job before scheduling an interview.', true); return; }
            document.getElementById('dialogError').textContent = ''; dialog.showModal();
        } catch (error) { ui.message(error.message, true); }
        finally { button.disabled = false; }
    });
    document.getElementById('closeDialogBtn').addEventListener('click', () => dialog.close());
    const form = document.getElementById('interviewForm');
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (form.dataset.saving === 'true') return;
        form.dataset.saving = 'true'; ui.busy(form, true);
        const value = id => document.getElementById(id).value.trim();
        try {
            await apiUtils.post('/interviews', { candidate: value('candidate'), position: value('position'), location: value('interviewLocation'), type: value('interviewType'), interviewer: value('interviewer'), date: value('interviewDate'), status: value('interviewStatus') });
            dialog.close(); form.reset();
            document.getElementById('searchInput').value = ''; document.getElementById('dateFilter').value = ''; document.getElementById('statusFilter').value = '';
            await fetchAndRenderInterviews();
        } catch (error) { document.getElementById('dialogError').textContent = error.message; }
        finally { form.dataset.saving = 'false'; ui.busy(form, false); }
    });
});
if (typeof module !== 'undefined') module.exports = { initialInterviews, filterInterviews, renderInterviews };
