/**
 * Interview Schedule Page Script
 */

async function fetchAndRenderInterviews() {
    const searchInput = document.getElementById('searchInput');
    const dateFilter = document.getElementById('dateFilter');
    const statusFilter = document.getElementById('statusFilter');

    const params = {
        search: searchInput ? searchInput.value : '',
        isoDate: dateFilter ? dateFilter.value : '',
        status: statusFilter ? statusFilter.value : ''
    };

    try {
        if (typeof apiUtils !== 'undefined') {
            const response = await apiUtils.get('/interviews', params);
            renderInterviews(response.data || []);
        }
    } catch (error) {
        console.error('Failed to load interviews:', error);
    }
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
        const newInterviewBtn = document.getElementById('newInterviewBtn');

        if (searchInput) searchInput.addEventListener('input', fetchAndRenderInterviews);
        if (dateFilter) dateFilter.addEventListener('change', fetchAndRenderInterviews);
        if (statusFilter) statusFilter.addEventListener('change', fetchAndRenderInterviews);
        
        if (newInterviewBtn) {
            newInterviewBtn.addEventListener('click', () => {
                alert('New Interview Scheduling Modal/Form coming soon!');
            });
        }
    });
}

if (typeof module !== 'undefined') {
    module.exports = { initialInterviews: [], renderInterviews, filterInterviews };
}