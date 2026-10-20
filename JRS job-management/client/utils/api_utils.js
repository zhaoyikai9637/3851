/**
 * Utility module for API calls to the backend server.
 */
const API_BASE_URL = '/api';

async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || `HTTP Error: ${response.status}`);
        }
        if (response.status === 204) return {};
        return await response.json();
    } catch (error) {
        console.error(`[API Request Error] ${options.method || 'GET'} ${url}:`, error.message);
        throw error;
    }
}

const apiUtils = {
    get: (endpoint, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;
        return request(fullEndpoint, { method: 'GET' });
    },
    post: (endpoint, data) => request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint, data) => request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (endpoint) => request(endpoint, { method: 'DELETE' })
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = apiUtils;
}

/* Shared navigation and safe DOM helpers for all workspace pages. */
const ui = {
    jobs: '/pages/job-management/job-management.html',
    interviews: '/pages/interview-schedule/interview-schedule.html',
    go(url) { window.location.assign(url); },
    message(text, error = false) {
        const element = document.getElementById('pageMessage');
        if (element) { element.textContent = text; element.className = error ? 'message error' : 'message'; }
    },
    cell(row, text) { const cell = row.insertCell(); cell.textContent = text ?? ''; return cell; },
    empty(tbody, columns, text) {
        tbody.replaceChildren(); const row = tbody.insertRow(); const cell = ui.cell(row, text); cell.colSpan = columns;
    },
    action(cell, label, action, danger = false) {
        const button = document.createElement('button'); button.type = 'button'; button.className = `btn ${danger ? 'btn-light-danger' : 'btn-primary'}`;
        button.textContent = label; button.addEventListener('click', action); cell.append(button); return button;
    },
    badge(cell, status) {
        const span = document.createElement('span'); span.className = `badge ${['Active', 'Confirmed', 'Completed'].includes(status) ? 'badge-success' : status === 'Unpublished' ? 'badge-danger' : 'badge-warning'}`;
        span.textContent = status; cell.append(span);
    },
    busy(form, busy) { form.querySelectorAll('button').forEach(button => { button.disabled = busy; }); }
};
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => {
    const section = document.body.dataset.section;
    const title = document.querySelector('h1').textContent;
    const parentTitle = section === 'jobs' ? 'Job Management' : 'Interview Schedule';
    const crumbs = document.createElement('nav'); crumbs.className = 'breadcrumbs'; crumbs.setAttribute('aria-label', 'Breadcrumb');
    const link = document.createElement('a'); link.href = section === 'jobs' ? ui.jobs : ui.interviews; link.textContent = parentTitle;
    if (title === parentTitle) { const current = document.createElement('span'); current.textContent = title; current.setAttribute('aria-current', 'page'); crumbs.append(current); }
    else { crumbs.append(link, document.createTextNode(' / ')); const current = document.createElement('span'); current.textContent = title; current.setAttribute('aria-current', 'page'); crumbs.append(current); }
    document.querySelector('.content-body').prepend(crumbs);
    document.querySelectorAll('label.form-label').forEach(label => { const field = label.parentElement.querySelector('input,select,textarea'); if (field) label.htmlFor = field.id; });
    document.querySelectorAll('[data-cancel]').forEach(button => button.addEventListener('click', () => ui.go(section === 'jobs' ? ui.jobs : ui.interviews)));
});

const jobForm = {
    fields: { jobTitle: 'title', department: 'department', location: 'location', employmentType: 'type', salaryRange: 'salary_range', closingDate: 'closing_date', publishDate: 'publish_date', unpublishDate: 'unpublish_date', jobDescription: 'description', requirements: 'requirements' },
    read(status) {
        const value = id => document.getElementById(id).value.trim();
        return { title: value('jobTitle'), department: value('department'), location: value('location'), type: value('employmentType'), salaryRange: value('salaryRange'), closingDate: value('closingDate'), publishDate: value('publishDate'), unpublishDate: value('unpublishDate'), description: value('jobDescription'), requirements: value('requirements'), status };
    },
    fill(job) {
        for (const [id, field] of Object.entries(this.fields)) {
            const element = document.getElementById(id);
            const value = job[field] || '';
            if (element.tagName === 'SELECT' && value && !Array.from(element.options).some(option => option.value === value)) element.add(new Option(value, value));
            element.value = value;
        }
    },
    async save(form, status, id) {
        if (!form.reportValidity() || form.dataset.saving === 'true') return;
        form.dataset.saving = 'true'; ui.busy(form, true); ui.message('Saving...');
        try {
            const data = this.read(status);
            if (id) await apiUtils.put(`/jobs/${encodeURIComponent(id)}`, data);
            else await apiUtils.post('/jobs', data);
            ui.go(ui.jobs);
        } catch (error) { ui.message(error.message, true); }
        finally { form.dataset.saving = 'false'; ui.busy(form, false); }
    }
};
