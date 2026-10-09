/**
 * Job Management Page Script
 */

async function fetchAndRenderJobs() {
    const searchInput = document.getElementById('searchInput');
    const departmentFilter = document.getElementById('departmentFilter');
    const statusFilter = document.getElementById('statusFilter');

    const params = {
        search: searchInput ? searchInput.value : '',
        department: departmentFilter ? departmentFilter.value : '',
        status: statusFilter ? statusFilter.value : ''
    };

    try {
        if (typeof apiUtils !== 'undefined') {
            const response = await apiUtils.get('/jobs', params);
            renderJobs(response.data || []);
            return;
        }
    } catch (error) {
        console.warn('API request failed, using local fallback:', error);
    }
}

function renderJobs(jobs) {
    const tbody = document.getElementById('jobTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    jobs.forEach(job => {
        const badgeClass = job.status === 'Active' ? 'badge-success' : 'badge-danger';
        const row = document.createElement('tr');
        row.setAttribute('data-id', job.id);
        row.innerHTML = `
            <td style="font-weight: 500;">${job.title}</td>
            <td>${job.department}</td>
            <td>${job.type}</td>
            <td>${job.applicants || 0}</td>
            <td><span class="badge ${badgeClass}">${job.status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-primary btn-edit" onclick="handleEditJob(${job.id})" style="padding: 6px 16px; font-size: 13px;">Edit</button>
                    <button class="btn btn-danger btn-delete" onclick="handleDeleteJob(${job.id})" style="padding: 6px 16px; font-size: 13px;">Delete</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function handleEditJob(jobId) {
    window.location.href = `../edit-job/edit-job.html?id=${jobId}`;
}

async function handleDeleteJob(id) {
    if (!confirm('Are you sure you want to delete this job?')) return;
    try {
        if (typeof apiUtils !== 'undefined') {
            await apiUtils.delete(`/jobs/${id}`);
            fetchAndRenderJobs();
        }
    } catch (error) {
        alert('Failed to delete job: ' + error.message);
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        fetchAndRenderJobs();

        const searchInput = document.getElementById('searchInput');
        const departmentFilter = document.getElementById('departmentFilter');
        const statusFilter = document.getElementById('statusFilter');
        const newJobBtn = document.getElementById('newJobBtn');

        if (searchInput) searchInput.addEventListener('input', fetchAndRenderJobs);
        if (departmentFilter) departmentFilter.addEventListener('change', fetchAndRenderJobs);
        if (statusFilter) statusFilter.addEventListener('change', fetchAndRenderJobs);
        if (newJobBtn) {
            newJobBtn.addEventListener('click', () => {
                window.location.href = '../create-job/create-job.html';
            });
        }
    });
}

if (typeof module !== 'undefined') {
    module.exports = { initialJobs: [], renderJobs };
}