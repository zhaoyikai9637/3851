/* Display-only HTML adaptation of the team's Jobs, Resume and Status pages.
 * Fixtures never call job/application APIs or change the real candidate profile.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id);
    const root = $('displayContent');
    const page = document.body.dataset.page;
    const jobs = window.JRS_PORTAL_JOBS.map(job => ({ ...job, mode: job.workMode, level: job.experienceLevel, type: job.employmentType, skills: job.requirements.join(" ") }));
    function jobsPage() {
        root.innerHTML = `<div class="page-stack"><section class="search-surface surface"><div><p class="eyebrow">APPLICANT JOB SEARCH</p><h2>Find a suitable role</h2><p>Choose the one role that best matches your skills and experience.</p></div><form id="searchForm" class="job-search-form"><input class="form-control" id="jobSearch" aria-label="Search jobs" placeholder="Search by job title, skill, or department" maxlength="100"><button class="btn btn-primary" type="submit">Search jobs</button></form></section><div class="jobs-layout"><aside class="surface filters-panel"><h2>Filters</h2><form id="filterForm"><div class="filter-fields" id="filterFields"></div><div class="filter-buttons"><button class="btn btn-primary" type="submit">Apply filters</button><button class="btn" type="reset">Reset</button></div></form></aside><section class="jobs-results" aria-label="Job results"><div class="results-heading"><div><p class="eyebrow">CURRENT VACANCIES</p><h2 id="resultCount"></h2></div></div><div id="jobList" class="job-list" aria-live="polite"></div></section></div></div><dialog id="jobDialog" aria-labelledby="detailTitle"><p class="eyebrow">ROLE DETAILS</p><h2 id="detailTitle"></h2><p id="detailSummary"></p><p id="detailMeta"></p><div id="detailSections"></div><div class="dialog-actions"><button class="btn btn-primary" disabled>Continue to application</button><button class="btn" id="closeDetails" type="button">Close</button></div></dialog>`;
        const filters = [['department', 'Department'], ['location', 'Location'], ['mode', 'Work mode'], ['level', 'Experience level']];
        for (const [key, label] of filters) {
            const field = document.createElement('label'); field.className = 'form-label-group';
            const span = document.createElement('span'); span.textContent = label;
            const select = document.createElement('select'); select.id = key; select.className = 'form-select';
            select.add(new Option('All ' + ({ department: 'departments', location: 'locations', mode: 'work modes', level: 'experience levels' })[key], ''));
            for (const value of new Set(jobs.map(job => job[key]))) select.add(new Option(value, value));
            field.append(span, select); $('filterFields').append(field);
        }
        function render() {
            const search = $('jobSearch').value.trim().toLowerCase();
            const matches = jobs.filter(job => (job.title + ' ' + job.department + ' ' + job.skills).toLowerCase().includes(search) && filters.every(([key]) => !$(key).value || job[key] === $(key).value));
            $('resultCount').textContent = `${matches.length} open role${matches.length === 1 ? '' : 's'}`;
            $('jobList').replaceChildren();
            for (const job of matches) {
                const card = document.createElement('article'); card.className = 'job-card surface';
                // All interpolated fields below are fixed local fixtures, never account data.
                card.innerHTML = `<div><div class="job-title-row"><div><span class="department-badge">${job.department}</span><h3>${job.title}</h3></div><span class="job-type">${job.type}</span></div><p class="job-summary">${job.summary}</p><div class="job-meta-list"><span>${job.location}</span><span>${job.mode}</span><span>${job.level}</span><span>Closes ${job.closingDate}</span></div></div><div class="job-card-action"><button class="btn" type="button">View details</button></div>`;
                card.querySelector('button').addEventListener('click', () => {
                    $('detailTitle').textContent = job.title;
                    $('detailSummary').textContent = job.summary;
                    $('detailMeta').textContent = `${job.department} · ${job.location} · ${job.workMode} · ${job.salaryRange} · Closes ${job.closingDate}`;
                    $('detailSections').replaceChildren();
                    for (const [key, title] of [['responsibilities', 'Responsibilities'], ['requirements', 'Essential requirements'], ['preferredQualifications', 'Preferred qualifications'], ['benefits', 'Benefits and hiring process']]) {
                        const heading = document.createElement('h3'); heading.textContent = title;
                        const list = document.createElement('ul');
                        for (const text of job[key]) { const item = document.createElement('li'); item.textContent = text; list.append(item); }
                        $('detailSections').append(heading, list);
                    }
                    $('jobDialog').showModal();
                });
                $('jobList').append(card);
            }
            if (!matches.length) { const empty = document.createElement('div'); empty.className = 'empty-state surface'; empty.textContent = 'No matching roles. Try another search or reset the filters.'; $('jobList').append(empty); }
        }
        for (const id of ['searchForm', 'filterForm']) $(id).addEventListener('submit', event => { event.preventDefault(); render(); });
        $('filterForm').addEventListener('reset', event => { event.preventDefault(); for (const [key] of filters) $(key).value = ''; $('jobSearch').value = ''; render(); });
        $('closeDetails').addEventListener('click', () => $('jobDialog').close());
        render();
    }
    function resumePage() {
        const data = window.JRS_PORTAL_PROFILE;
        root.innerHTML = `<div class="page-stack resume-page"><section class="surface resume-summary-section showcase-panel"><div class="resume-summary-icon" aria-hidden="true">▤</div><div><p class="eyebrow">RESUME FILES</p><h2>Upload your first resume</h2><p>A resume is required before you can submit an application.</p></div><button class="btn btn-primary" disabled>Upload resume</button></section><section class="surface visibility-section showcase-panel"><div><p class="eyebrow">RECRUITER VISIBILITY</p><h2>Can recruiters contact you?</h2><p>Keep your profile available when you are open to a new role. Close it when you no longer want recruitment messages.</p></div><div class="visibility-choice"><button class="visibility-option selected" type="button" disabled><span><strong>Available</strong><small>Recruiters can find my profile</small></span></button><button class="visibility-option" type="button" disabled><span><strong>Closed</strong><small>Do not show my profile to recruiters</small></span></button></div></section><section class="surface showcase-panel"><h2>Contact information</h2><p>These details will be used for your application and recruiter contact.</p><div class="preview-grid"><label class="preview-label">Phone number<input id="resumePhone" class="form-control" disabled></label><label class="preview-label">Current location<input id="resumeLocation" class="form-control" disabled></label></div></section><section class="surface showcase-panel"><div class="section-heading with-action"><div><h2>Education</h2><p>Include the school, qualification, study period, and graduation year.</p></div><button class="btn" disabled>Add education</button></div><div id="resumeEducation" class="structured-list"></div></section><section class="surface showcase-panel"><div class="section-heading with-action"><div><h2>Languages</h2><p>Record reading and writing ability separately.</p></div><button class="btn" disabled>Add language</button></div><div id="resumeLanguages" class="structured-list"></div></section><div class="sticky-save-bar"><span>Profile visible to recruiters</span><button class="btn btn-primary" disabled>Save profile</button></div></div>`;
        $('resumePhone').value = data.phone; $('resumeLocation').value = data.location;
        function entries(target, rows, fields, name) {
            rows.forEach((row, index) => {
                const entry = document.createElement('fieldset'); entry.className = 'structured-entry';
                const legend = document.createElement('legend'); legend.textContent = `${name} ${index + 1}`; entry.append(legend);
                const grid = document.createElement('div'); grid.className = 'preview-grid';
                for (const [key, title] of fields) {
                    const label = document.createElement('label'); label.className = 'preview-label'; label.textContent = title;
                    const input = document.createElement('input'); input.className = 'form-control'; input.disabled = true; input.value = row[key];
                    label.append(input); grid.append(label);
                }
                entry.append(grid); $(target).append(entry);
            });
        }
        entries('resumeEducation', data.education, [['institution','School or university'],['qualification','Qualification'],['startYear','Start year'],['graduationYear','Graduation year']], 'Education');
        entries('resumeLanguages', data.languages, [['language','Language'],['readingLevel','Reading level'],['writingLevel','Writing level']], 'Language');
    }
    function statusPage() {
        root.innerHTML = `<div class="page-stack"><section class="empty-state surface large"><div class="resume-summary-icon" aria-hidden="true">▤</div><h2>No current application</h2><p>Review the company's open positions and choose the single role that best fits your experience.</p><a class="btn btn-primary btn-lg" href="../jobs/jobs.html">Find a suitable role →</a></section></div>`;
    }
    // Authenticate through the existing cookie session, never through the team's demo-session API.
    try {
        await JRS.request('/me');
        const { profile } = await JRS.request('/profile');
        $('identityName').textContent = profile.full_name || 'My profile';
        $('identityAvatar').textContent = (profile.full_name || 'P').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
        if (page === 'jobs') jobsPage(); else if (page === 'resume') resumePage(); else statusPage();
    } catch (error) {
        if (error.status === 401) { window.location.replace('../login/login.html'); return; }
        root.textContent = 'Unable to load the portal. ' + error.message;
    }
    $('logoutBtn').addEventListener('click', async () => {
        $('logoutBtn').disabled = true;
        try { await JRS.request('/logout', { method: 'POST' }); window.location.href = '../login/login.html'; }
        catch (error) { $('portalMessage').textContent = error.message; $('portalMessage').hidden = false; $('logoutBtn').disabled = false; }
    });
});


