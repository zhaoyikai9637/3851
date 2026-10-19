document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id);
    let profile, draftSkills = [];
    const editing = { career: null, education: null, certifications: null };
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
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
        $(id).addEventListener('submit', event => { event.preventDefault(); action($(id).querySelector('[type="submit"]'), handler); });
    }
    function value(id) { return $(id).value.trim(); }
    function set(id, text) { $(id).value = text || ''; }
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
    function card(container, title, lines, edit, remove) {
        const node = element('div', undefined, 'profile-card-item');
        node.append(element('div', title, 'card-title'));
        for (const line of lines.filter(Boolean)) node.append(element('div', line, 'card-subtext'));
        if (edit) { const button = element('button', 'Edit', 'btn-text'); button.type = 'button'; button.addEventListener('click', edit); node.append(button); }
        if (remove) { const button = element('button', 'Delete', 'btn-text'); button.type = 'button'; button.addEventListener('click', () => action(button, remove)); node.append(button); }
        container.append(node);
        return node;
    }
    async function remove(section, id) {
        if (!window.confirm('Delete this record?')) return;
        await JRS.request(`/profile/${section}/${id}`, { method: 'DELETE' }); await load();
    }
    function names() {
        if (profile.first_name) return [profile.first_name, profile.last_name || ''];
        const parts = (profile.full_name || '').split(' '); return [parts.shift() || '', parts.join(' ')];
    }
    function render() {
        $('userName').textContent = profile.full_name || 'Your profile';
        $('userEmail').textContent = profile.email;
        $('userPhone').textContent = formatPhoneNumber(profile.country_code, profile.contact_number);
        $('avatarCircle').textContent = getInitials(profile.full_name);
        for (const id of ['summaryContent', 'careerList', 'educationList', 'certList', 'skillTags', 'languageList']) $(id).replaceChildren();
        if (profile.personal_summary) card($('summaryContent'), '', [profile.personal_summary], editSummary);
        $('addSummaryBtn').textContent = profile.personal_summary ? 'Edit summary' : 'Add summary';
        for (const row of profile.career) card($('careerList'), row.job_title, [row.company_name,
            `${row.start_month_year || ''} — ${row.is_current_role ? 'Present' : row.end_month_year || ''}`, row.description],
            () => editCareer(row), () => remove('career', row.role_id));
        for (const row of profile.education) card($('educationList'), row.qualification,
            [row.institution, row.is_current_study ? `Expected finish: ${row.end_month_year || 'Not specified'}` : `Completed: ${row.finished_year || 'Not specified'}`, row.description],
            () => editEducation(row), () => remove('education', row.education_id));
        for (const row of profile.certifications) card($('certList'), row.cert_name,
            [row.issuing_org, row.issue_month_year ? `Issued: ${row.issue_month_year}` : '', row.no_expiry ? 'No expiry' : row.expiry_month_year ? `Expires: ${row.expiry_month_year}` : '', row.description],
            () => editCertificate(row), () => remove('certifications', row.cert_id));
        for (const skill of profile.skills) $('skillTags').append(element('span', skill, 'skill-chip'));
        if (profile.languages.length) card($('languageList'), 'Languages', [
            `Reading: ${profile.languages.filter(l => l.can_read).map(l => l.language_name).join(', ') || 'None'}`,
            `Writing: ${profile.languages.filter(l => l.can_write).map(l => l.language_name).join(', ') || 'None'}`
        ], editLanguages);
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
    function editSummary() { set('summaryInput', profile.personal_summary); open('summaryDrawer'); }
    $('addSummaryBtn').addEventListener('click', editSummary);
    bindForm('summaryForm', async () => {
        await JRS.request('/profile/summary', { method: 'PUT', body: { personal_summary: value('summaryInput') } });
        await load(); close(); message('Summary saved.');
    });
    function editCareer(row = {}) {
        editing.career = row.role_id || null;
        $('roleForm').reset(); set('roleTitle', row.job_title); set('roleCompany', row.company_name); set('roleDescription', row.description);
        setDate('roleStartMonth', 'roleStartYear', row.start_month_year); setDate('roleEndMonth', 'roleEndYear', row.end_month_year);
        $('roleStillInRole').checked = Boolean(row.is_current_role); updateRoleDates(); open('roleDrawer');
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
        $('eduComplete').checked = !row.is_current_study; updateEducation(); open('educationDrawer');
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
        $('certNoExpiry').checked = Boolean(row.no_expiry); updateExpiry(); open('licenceDrawer');
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
    function editLanguages() {
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
