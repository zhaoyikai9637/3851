/**
 * Interview Schedule Page Script
 */

const fallbackInterviews = [
    { id: 1, candidate: 'Jane Doe', position: 'Software Engineer', location: 'A01', type: 'Online', interviewer: 'Michael Tan', date: '29 Jul 2026 10 : 00', isoDate: '2026-07-29', status: 'Confirmed' },
    { id: 2, candidate: 'Alex Tan', position: 'UI Designer', location: 'B04', type: 'On-site', interviewer: 'Sarah Lim', date: '29 Jul 2026 14 : 00', isoDate: '2026-07-29', status: 'Pending' },
    { id: 3, candidate: 'Mary Smith', position: 'HR Executive', location: 'D16', type: 'On-site', interviewer: 'Daniel Wong', date: '30 Jul 2026 9 : 00', isoDate: '2026-07-30', status: 'Confirmed' }
];

async function fetchAndRenderInterviews() {
    const searchInput = document.getElementById('searchInput');
    const dateFilter = document.getElementById('dateFilter');
    const statusFilter = document.getElementById('statusFilter');

    const query = searchInput ? searchInput.value : '';
    const date = dateFilter ? dateFilter.value : '';
    const status = statusFilter ? statusFilter.value : '';

    try {
        if (typeof apiUtils !== 'undefined') {
            const response = await apiUtils.get('/interviews', { search: query, isoDate: date, status: status });
            if (response && response.data && response.data.length > 0) {
                renderInterviews(response.data);
                return;
            }
        }
    } catch (error) {
        console.warn('API request failed, falling back to local data:', error);
    }

    const filtered = filterInterviews(fallbackInterviews, query, date, status);
    renderInterviews(filtered);
}

function renderInterviews(interviewsList) {
    const tbody = document.getElementById('interviewTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    interviewsList.forEach(item => {
        const statusBadgeClass = item.status === 'Confirmed' ? 'badge-success' : 'badge-warning';
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 500;">${item.candidate}</td>
            <td>${item.position}</td>
            <td>${item.location}</td>
            <td><span class="type-badge">${item.type}</span></td>
            <td>${item.interviewer}</td>
            <td>${item.date}</td>
            <td><span class="badge ${statusBadgeClass}">${item.status}</span></td>
            <td>
                <button class="btn btn-primary btn-view" onclick="window.location.href='../interview-feedback/interview-feedback.html?id=${item.id}'" style="padding: 6px 16px; font-size: 13px;">View</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterInterviews(list, searchQuery, dateQuery, statusQuery) {
    return list.filter(item => {
        const matchesName = item.candidate.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDate = dateQuery ? item.isoDate === dateQuery : true;
        const matchesStatus = statusQuery ? item.status === statusQuery : true;
        return matchesName && matchesDate && matchesStatus;
    });
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        fetchAndRenderInterviews();

        const searchInput = document.getElementById('searchInput');
        const dateFilter = document.getElementById('dateFilter');
        const statusFilter = document.getElementById('statusFilter');

        if (searchInput) searchInput.addEventListener('input', fetchAndRenderInterviews);
        if (dateFilter) dateFilter.addEventListener('change', fetchAndRenderInterviews);
        if (statusFilter) statusFilter.addEventListener('change', fetchAndRenderInterviews);
    });
}

if (typeof module !== 'undefined') {
    module.exports = { initialInterviews: fallbackInterviews, renderInterviews, filterInterviews };
}