document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id);
    let profile, draftSkills = [], savingSkills = false;
    const editing = { career: null, education: null, certifications: null };
    const descriptionObservers = [];
    let descriptionId = 0;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    const currentYear = new Date().getFullYear();
    document.querySelectorAll('.date-year').forEach(select => {
        for (const [label, first, last, step] of [
            ['Current and past years', currentYear, 1900, -1],
            ['Future years', currentYear + 1, 2199, 1]
        ]) {
            const group = element('optgroup'); group.label = label;
            for (let year = first; step > 0 ? year <= last : year >= last; year += step) {
                const option = element('option', String(year)); option.value = String(year); group.append(option);
            }
            select.append(group);
        }
    });
    document.querySelectorAll('textarea[maxlength="2000"]').forEach(input => {
        const counter = element('p', '', 'text-count');
        counter.id = input.id + 'Count';
        input.setAttribute('aria-describedby', counter.id);
        input.after(counter);
        function updateCount() {
            counter.textContent = input.value.length + ' / 2000';
            counter.classList.toggle('is-over-limit', input.value.length > 2000);
            input.setCustomValidity(input.value.length > 2000 ? 'Use no more than 2000 characters.' : '');
        }
        input.addEventListener('input', updateCount); updateCount();
    });
    function message(text, error = false) {
        $('profileMessage').textContent = text;
        $('profileMessage').classList.toggle('is-error', error);
        $('profileMessage').hidden = !text;
    }
    function close() {
        document.querySelectorAll('.drawer').forEach(d => d.classList.remove('open'));
        $('drawerBackdrop').style.display = 'none';
    }
    function open(id) { message(''); $(id).classList.add('open'); $('drawerBackdrop').style.display = 'block'; }
    async function load() { profile = (await JRS.request('/profile')).profile; render(); }
    async function action(button, work) {
        if (button?.disabled) return;
        if (button) button.disabled = true;
        try { await work(); }
        catch (err) {
            if (err.status === 401) { window.location.replace('../login/login.html'); return; }
            message(err.message, true);
        } finally { if (button) button.disabled = false; }
    }
    function bindForm(id, handler) {
        $(id).addEventListener('submit', event => {
            event.preventDefault();
            action($(id).querySelector('[type="submit"]'), async () => {
                if ([...$(id).querySelectorAll('textarea')].some(input => input.value.length > 2000)) throw new Error('Use no more than 2000 characters.');
                await handler();
            });
        });
    }
    function value(id) { return $(id).value.trim(); }
    function set(id, text) { $(id).value = text || ''; if ($(id).matches('textarea')) $(id).dispatchEvent(new Event('input')); }
    function date(monthId, yearId) {
        const y = value(yearId), m = value(monthId);
        if (!y && !m) return null;
        if (!/^(19|20|21)\d{2}$/.test(y) || !months.includes(m)) throw new Error('Choose both a valid month and a four-digit year.');
        return `${y}-${String(months.indexOf(m) + 1).padStart(2, '0')}`;
    }
    function setDate(monthId, yearId, input) {
        const [y, m] = (input || '').split('-');
        set(yearId, y); set(monthId, m ? months[Number(m) - 1] : '');
    }
    function monthLabel(input) {
        const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(input || '');
        return match ? months[Number(match[2]) - 1].slice(0, 3) + ' ' + match[1] : 'Not specified';
    }
    function recordCard(container, { title, subtitle, dates, description, edit, section, id }) {
        const node = element('article', undefined, 'profile-card-item profile-record');
        const heading = element('h4', title, 'record-title');
        const editButton = element('button', undefined, 'record-edit');
        editButton.type = 'button';
        editButton.setAttribute('aria-label', 'Edit ' + (title || 'personal summary'));
        editButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 4 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z"/></svg>';
        editButton.addEventListener('click', edit);
        const actions = element('div', undefined, 'record-actions');
        const deleteButton = element('button', undefined, 'record-edit record-trash');
        deleteButton.type = 'button';
        deleteButton.setAttribute('aria-label', 'Delete ' + (title || 'personal summary'));
        deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/></svg>';
        deleteButton.addEventListener('click', () => action(deleteButton, () => deleteRecord(section, id)));
        actions.append(editButton, deleteButton);
        if (title) node.append(heading);
        node.append(actions);
        if (subtitle) node.append(element('p', subtitle, 'record-subtitle'));
        if (dates.some(Boolean)) node.append(element('p', dates.filter(Boolean).join(' · '), 'record-dates'));
        if (description) {
            const text = element('p', description, 'record-description');
            text.id = 'record-description-' + (++descriptionId);
            const toggle = element('button', undefined, 'record-more');
            toggle.type = 'button';
            toggle.setAttribute('aria-controls', text.id);
            toggle.setAttribute('aria-expanded', 'false');
            const label = element('span', 'More');
            toggle.append(label);
            toggle.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg>');
            toggle.hidden = description.length <= 180;
            toggle.addEventListener('click', () => {
                const expanded = toggle.getAttribute('aria-expanded') !== 'true';
                toggle.setAttribute('aria-expanded', String(expanded));
                text.classList.toggle('is-expanded', expanded);
                label.textContent = expanded ? 'Less' : 'More';
            });
            node.append(text, toggle);
            if (typeof ResizeObserver !== 'undefined') {
                const observer = new ResizeObserver(() => {
                    if (toggle.getAttribute('aria-expanded') === 'true') return;
                    toggle.hidden = text.scrollHeight <= text.clientHeight + 1;
                });
                observer.observe(text);
                descriptionObservers.push(observer);
            }
        }
        if (section === 'summary') node.classList.add('profile-record-summary');
        container.append(node);
    }
    async function deleteRecord(section, id) {
        if (!window.confirm('Delete this record?')) return;
        if (section === 'summary') await JRS.request('/profile/summary', { method: 'PUT', body: { personal_summary: '' } });
        else if (section === 'languages') await JRS.request('/profile/languages', { method: 'PUT', body: { languages: id ? profile.languages.filter(row => row.language_name !== id) : [] } });
        else await JRS.request('/profile/' + section + '/' + id, { method: 'DELETE' });
        await load(); close(); message('Record deleted.');
    }
    function recordDrawer(drawerId, section, id) {
        const drawer = $(drawerId);
        drawer.querySelector('h2').textContent = (id ? 'Edit ' : 'Add ') + ({ career: 'role', education: 'education', certifications: 'licence or certification' }[section]);
        let button = drawer.querySelector('.record-delete');
        if (!button) {
            button = element('button', 'Delete', 'btn-text record-delete');
            button.type = 'button';
            button.addEventListener('click', () => action(button, () => deleteRecord(section, editing[section])));
            drawer.querySelector('.drawer-footer').append(button);
        }
        button.hidden = !id;
        open(drawerId);
    }
    function names() {
        if (profile.first_name) return [profile.first_name, profile.last_name || ''];
        const parts = (profile.full_name || '').split(' '); return [parts.shift() || '', parts.join(' ')];
    }
    function render() {
        descriptionObservers.splice(0).forEach(observer => observer.disconnect());
        $('userName').textContent = profile.full_name || 'Your profile';
        $('userEmail').textContent = profile.email;
        $('userPhone').textContent = formatPhoneNumber(profile.country_code, profile.contact_number);
        $('avatarCircle').textContent = getInitials(profile.full_name);
        for (const id of ['summaryContent', 'careerList', 'educationList', 'certList', 'skillTags', 'languageList']) $(id).replaceChildren();
        if (profile.personal_summary) recordCard($('summaryContent'), { title: '', dates: [], description: profile.personal_summary, edit: editSummary, section: 'summary' });
        $('addSummaryBtn').hidden = Boolean(profile.personal_summary);
        for (const row of profile.career) recordCard($('careerList'), {
            title: row.job_title, subtitle: row.company_name,
            dates: [monthLabel(row.start_month_year) + ' – ' + (row.is_current_role ? 'Present' : monthLabel(row.end_month_year))],
            description: row.description, edit: () => editCareer(row), section: 'career', id: row.role_id
        });
        for (const row of profile.education) recordCard($('educationList'), {
            title: row.qualification, subtitle: row.institution,
            dates: [row.is_current_study ? 'Expected finish ' + monthLabel(row.end_month_year) : 'Finished ' + (row.finished_year || 'Not specified')],
            description: row.description, edit: () => editEducation(row), section: 'education', id: row.education_id
        });
        const currentMonth = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit' });
        for (const row of profile.certifications) recordCard($('certList'), {
            title: row.cert_name, subtitle: row.issuing_org,
            dates: [row.issue_month_year ? 'Issued ' + monthLabel(row.issue_month_year) : '', row.no_expiry ? 'No expiry' : row.expiry_month_year ? (row.expiry_month_year < currentMonth ? 'Expired ' : 'Expires ') + monthLabel(row.expiry_month_year) : ''],
            description: row.description, edit: () => editCertificate(row), section: 'certifications', id: row.cert_id
        });
        for (const skill of profile.skills) {
            const chip = element('span', undefined, 'skill-chip');
            const button = element('button', '×', 'remove-skill-btn');
            button.type = 'button'; button.setAttribute('aria-label', 'Remove ' + skill);
            button.disabled = savingSkills;
            button.addEventListener('click', () => action(button, async () => {
                if (savingSkills) return;
                savingSkills = true;
                const controls = [...document.querySelectorAll('#skillTags button'), $('addSkillBtn'), $('saveSkillsBtn')];
                controls.forEach(control => { control.disabled = true; });
                try {
                    await JRS.request('/profile/skills', { method: 'PUT', body: { skills: profile.skills.filter(item => item !== skill) } });
                    await load(); message('Skill removed.');
                } finally {
                    savingSkills = false;
                    [...controls, ...document.querySelectorAll('#skillTags button')].forEach(control => { control.disabled = false; });
                }
            }));
            chip.append(element('span', skill), button); $('skillTags').append(chip);
        }
        if (profile.languages.length) {
            recordCard($('languageList'), {
                title: '', dates: [], edit: editLanguages, section: 'languages'
            });
            const card = $('languageList').lastElementChild;
            card.classList.add('profile-record-languages');
            card.querySelector('[aria-label^="Edit "]').setAttribute('aria-label', 'Edit languages');
            card.querySelector('[aria-label^="Delete "]').setAttribute('aria-label', 'Delete all languages');
            for (const [label, flag] of [['Reading', 'can_read'], ['Writing', 'can_write']]) {
                const line = element('p', undefined, 'language-detail');
                line.append(element('strong', label + ': '), element('span', profile.languages.filter(row => row[flag]).map(row => row.language_name).join(', ') || 'None'));
                card.append(line);
            }
        }
    }
    $('drawerBackdrop').addEventListener('click', close);
    document.querySelectorAll('.drawer-close, .drawer [id^="cancel"]').forEach(button => button.addEventListener('click', close));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    $('logoutBtn').addEventListener('click', () => action($('logoutBtn'), async () => {
        await JRS.request('/logout', { method: 'POST' }); window.location.href = '../login/login.html';
    }));
    $('editMaterialsBtn').addEventListener('click', () => {
        const [first, last] = names(); set('editFirstName', first); set('editLastName', last);
        set('editHomeLocation', profile.home_location); set('editContactNumber', profile.contact_number);
        set('editCountryCode', profile.country_code || '+65'); set('editEmailAddress', profile.email);
        $('phonePrefixText').textContent = value('editCountryCode'); open('materialsDrawer');
    });
    $('editCountryCode').addEventListener('change', () => { $('phonePrefixText').textContent = value('editCountryCode'); });
    bindForm('materialsForm', async () => {
        await JRS.request('/profile', { method: 'PUT', body: { first_name: value('editFirstName'), last_name: value('editLastName'),
            home_location: value('editHomeLocation'), contact_number: value('editContactNumber'), country_code: value('editCountryCode') } });
        await load(); close(); message('Personal details saved.');
    });
    const summaryDelete = element('button', 'Delete', 'btn-text record-delete');
    summaryDelete.type = 'button';
    summaryDelete.addEventListener('click', () => action(summaryDelete, () => deleteRecord('summary')));
    $('summaryDrawer').querySelector('.drawer-footer').append(summaryDelete);
    function editSummary() {
        set('summaryInput', profile.personal_summary);
        summaryDelete.hidden = !profile.personal_summary;
        $('summaryDrawer').querySelector('h2').textContent = profile.personal_summary ? 'Edit personal summary' : 'Add personal summary';
        open('summaryDrawer');
    }
    $('addSummaryBtn').addEventListener('click', editSummary);
    bindForm('summaryForm', async () => {
        await JRS.request('/profile/summary', { method: 'PUT', body: { personal_summary: value('summaryInput') } });
        await load(); close(); message('Summary saved.');
    });
    function editCareer(row = {}) {
        editing.career = row.role_id || null;
        $('roleForm').reset(); set('roleTitle', row.job_title); set('roleCompany', row.company_name); set('roleDescription', row.description);
        setDate('roleStartMonth', 'roleStartYear', row.start_month_year); setDate('roleEndMonth', 'roleEndYear', row.end_month_year);
        $('roleStillInRole').checked = Boolean(row.is_current_role); updateRoleDates(); recordDrawer('roleDrawer', 'career', editing.career);
    }
    function updateRoleDates() { $('roleEndMonth').disabled = $('roleEndYear').disabled = $('roleStillInRole').checked; }
    $('roleStillInRole').addEventListener('change', updateRoleDates);
    $('addRoleBtn').addEventListener('click', () => editCareer());
    async function saveSection(section, body) {
        const id = editing[section];
        await JRS.request(`/profile/${section}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body });
        await load(); close(); message('Record saved.');
    }
    bindForm('roleForm', () => saveSection('career', { job_title: value('roleTitle'), company_name: value('roleCompany'),
        description: value('roleDescription'), is_current_role: $('roleStillInRole').checked,
        start_month_year: date('roleStartMonth', 'roleStartYear'), end_month_year: $('roleStillInRole').checked ? null : date('roleEndMonth', 'roleEndYear') }));
    function updateEducation() {
        $('finishedFieldGroup').style.display = $('eduComplete').checked ? 'block' : 'none';
        $('expectedFinishFieldGroup').style.display = $('eduComplete').checked ? 'none' : 'block';
    }
    function editEducation(row = {}) {
        editing.education = row.education_id || null; $('educationForm').reset();
        set('eduCourse', row.qualification); set('eduInstitution', row.institution); set('eduHighlights', row.description);
        set('eduFinishedYear', row.finished_year); setDate('eduExpectedMonth', 'eduExpectedYear', row.end_month_year);
        $('eduComplete').checked = !row.is_current_study; updateEducation(); recordDrawer('educationDrawer', 'education', editing.education);
    }
    $('eduComplete').addEventListener('change', updateEducation);
    $('addEducationBtn').addEventListener('click', () => editEducation());
    bindForm('educationForm', () => saveSection('education', { qualification: value('eduCourse'), institution: value('eduInstitution'),
        description: value('eduHighlights'), is_current_study: !$('eduComplete').checked,
        finished_year: $('eduComplete').checked ? value('eduFinishedYear') : '',
        end_month_year: $('eduComplete').checked ? null : date('eduExpectedMonth', 'eduExpectedYear') }));
    function updateExpiry() { $('certExpiryMonth').disabled = $('certExpiryYear').disabled = $('certNoExpiry').checked; }
    function editCertificate(row = {}) {
        editing.certifications = row.cert_id || null; $('licenceForm').reset();
        set('certName', row.cert_name); set('certIssuer', row.issuing_org); set('certDescription', row.description);
        setDate('certIssueMonth', 'certIssueYear', row.issue_month_year); setDate('certExpiryMonth', 'certExpiryYear', row.expiry_month_year);
        $('certNoExpiry').checked = Boolean(row.no_expiry); updateExpiry(); recordDrawer('licenceDrawer', 'certifications', editing.certifications);
    }
    $('certNoExpiry').addEventListener('change', updateExpiry);
    $('addCertBtn').addEventListener('click', () => editCertificate());
    bindForm('licenceForm', () => saveSection('certifications', { cert_name: value('certName'), issuing_org: value('certIssuer'),
        description: value('certDescription'), no_expiry: $('certNoExpiry').checked, issue_month_year: date('certIssueMonth', 'certIssueYear'),
        expiry_month_year: $('certNoExpiry').checked ? null : date('certExpiryMonth', 'certExpiryYear') }));
    function renderDraftSkills() {
        $('addedSkillsContainer').replaceChildren();
        if (!draftSkills.length) $('addedSkillsContainer').append(element('span', 'No skills have been added'));
        draftSkills.forEach((skill, i) => {
            const chip = element('span', undefined, 'skill-chip'), button = element('button', '×', 'btn-text');
            button.type = 'button'; button.setAttribute('aria-label', `Remove ${skill}`);
            button.addEventListener('click', () => { draftSkills.splice(i, 1); renderDraftSkills(); });
            chip.append(element('span', skill), button); $('addedSkillsContainer').append(chip);
        });
    }
    function addDraftSkill() {
        const result = addSkill(draftSkills, value('skillInput'));
        if (!result.success) { message(result.error, true); return; }
        draftSkills = result.updatedSkills; set('skillInput', ''); renderDraftSkills();
    }
    $('addSkillBtn').addEventListener('click', () => { draftSkills = [...profile.skills]; set('skillInput', ''); renderDraftSkills(); open('skillsDrawer'); });
    $('addSkillTagBtn').addEventListener('click', addDraftSkill);
    $('skillInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addDraftSkill(); } });
    $('saveSkillsBtn').addEventListener('click', () => action($('saveSkillsBtn'), async () => {
        await JRS.request('/profile/skills', { method: 'PUT', body: { skills: draftSkills } }); await load(); close(); message('Skills saved.');
    }));
    const languageDelete = element('button', 'Delete', 'btn-text record-delete');
    languageDelete.type = 'button';
    languageDelete.addEventListener('click', () => action(languageDelete, () => deleteRecord('languages')));
    $('languageDrawer').querySelector('.drawer-footer').append(languageDelete);
    function editLanguages() {
        languageDelete.hidden = !profile.languages.length;
        $('languageDrawer').querySelector('h2').textContent = profile.languages.length ? 'Edit languages' : 'Add language';
        set('langReading', profile.languages.filter(l => l.can_read).map(l => l.language_name).join(', '));
        set('langWriting', profile.languages.filter(l => l.can_write).map(l => l.language_name).join(', ')); open('languageDrawer');
    }
    $('addLanguageBtn').addEventListener('click', editLanguages);
    bindForm('languageForm', async () => {
        const map = new Map();
        for (const [input, flag] of [['langReading', 'can_read'], ['langWriting', 'can_write']]) {
            for (const name of value(input).split(/[,，]/).map(s => s.trim()).filter(Boolean)) {
                const key = name.toLowerCase();
                if (!map.has(key)) map.set(key, { language_name: name, can_read: false, can_write: false });
                map.get(key)[flag] = true;
            }
        }
        await JRS.request('/profile/languages', { method: 'PUT', body: { languages: [...map.values()] } }); await load(); close(); message('Languages saved.');
    });
    // Keep controls disabled until identity/profile loading succeeds.
    const initialControls = [...document.querySelectorAll('button')];
    initialControls.forEach(button => { button.disabled = true; });
    try {
        await JRS.request('/me'); await load(); initialControls.forEach(button => { button.disabled = false; });
    } catch (err) {
        if (err.status === 401) window.location.replace('../login/login.html');
        else message(`Unable to load your profile: ${err.message} Reload to retry.`, true);
    }
});
