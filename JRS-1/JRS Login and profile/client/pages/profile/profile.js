document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id);
    const node = (tag, text, className) => {
        const item = document.createElement(tag);
        if (text !== undefined) item.textContent = text;
        if (className) item.className = className;
        return item;
    };
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const qualifications = { SECONDARY: 'Secondary school', CERTIFICATE: 'Certificate', DIPLOMA: 'Diploma', ASSOCIATE: 'Associate degree', BACHELOR: "Bachelor's degree", MASTER: "Master's degree", DOCTORATE: 'Doctorate', OTHER: 'Other qualification' };
    const languages = { en: 'English', zh: 'Chinese', ms: 'Malay', ta: 'Tamil', hi: 'Hindi', id: 'Indonesian', vi: 'Vietnamese', th: 'Thai', ja: 'Japanese', ko: 'Korean', fr: 'French', de: 'German', es: 'Spanish', ar: 'Arabic', pt: 'Portuguese', ru: 'Russian', bn: 'Bengali', ur: 'Urdu', fil: 'Filipino', other: 'Other language' };
    const levels = ['Basic', 'Intermediate', 'Advanced', 'Native'];
    let profile, sequence = 0, busy = false;
    const templates = {};
    for (const name of ['materials', 'summary', 'role', 'education', 'licence']) {
        const editor = $(name + 'Drawer');
        templates[name] = editor.querySelector('form').cloneNode(true);
        editor.remove();
    }
    $('skillsDrawer').remove(); $('languageDrawer').remove();
    function message(text, error = false, form) {
        $('profileMessage').textContent = text;
        $('profileMessage').classList.toggle('is-error', error);
        $('profileMessage').hidden = !text;
        if (form) {
            const feedback = form.querySelector('.profile-form-feedback');
            feedback.textContent = text; feedback.hidden = !text;
            feedback.classList.toggle('is-error', error);
        }
    }
    async function action(form, work) {
        if (busy) return;
        busy = true;
        const controls = [...document.querySelectorAll('button'), ...(form?.querySelectorAll('input,select,textarea') || [])];
        const previous = controls.map(control => control.disabled);
        controls.forEach(control => { control.disabled = true; });
        try { await work(); }
        catch (error) {
            if (error.status === 401) window.location.replace('../login/login.html');
            else message(error.message, true, form);
        } finally {
            controls.forEach((control, i) => { if (control.isConnected) control.disabled = previous[i]; });
            busy = false;
            form?.dispatchEvent(new Event('profile-ready'));
        }
    }
    function identity() {
        $('userName').textContent = profile.full_name || 'Your profile';
        $('userEmail').textContent = profile.email;
        $('userPhone').textContent = formatPhoneNumber(profile.country_code, profile.contact_number);
        $('avatarCircle').textContent = getInitials(profile.full_name);
    }
    function card(container, title, template) {
        const form = template ? template.cloneNode(true) : node('form');
        const prefix = 'profile-entry-' + (++sequence) + '-';
        form.id = prefix + 'form'; form.className = 'profile-entry-form';
        form.querySelectorAll('[id]').forEach(field => {
            field.dataset.field = field.id; field.id = prefix + field.id;
        });
        const fieldset = node('fieldset', undefined, 'profile-structured-entry');
        fieldset.append(node('legend', title));
        fieldset.append(...form.childNodes); form.append(fieldset);
        let footer = form.querySelector('.drawer-footer');
        if (!footer) { footer = node('div', undefined, 'drawer-footer'); fieldset.append(footer); }
        const save = footer.querySelector('[type="submit"]') || node('button', 'Save', 'btn-primary-small');
        save.type = 'submit'; footer.prepend(save);
        const cancel = footer.querySelector('[data-field^="cancel"]') || node('button', 'Cancel', 'btn-text');
        cancel.type = 'button'; footer.append(cancel);
        const remove = node('button', 'Delete', 'btn-text profile-entry-delete'); remove.type = 'button'; footer.append(remove);
        const feedback = node('p', '', 'profile-form-feedback'); feedback.hidden = true; feedback.setAttribute('role', 'status'); footer.before(feedback);
        const q = name => form.querySelector('[data-field="' + name + '"]');
        form.querySelectorAll('.date-year,.education-year').forEach(select => {
            const first = new Date().getFullYear() + (select.classList.contains('education-year') ? 10 : 0);
            const last = select.classList.contains('education-year') ? 1950 : 1900;
            for (let year = first; year >= last; year--) { const option = node('option', String(year)); option.value = String(year); select.append(option); }
            if (!select.classList.contains('education-year')) for (let year = first + 1; year <= 2199; year++) { const option = node('option', String(year)); option.value = String(year); select.append(option); }
        });
        form.querySelectorAll('.form-group').forEach(group => {
            const label = group.querySelector('label'), field = group.querySelector('input,select,textarea');
            if (label && field && !label.contains(field)) label.htmlFor = field.id;
        });
        form.querySelectorAll('textarea[maxlength]').forEach(input => {
            const counter = node('p', '', 'text-count'); counter.id = input.id + '-count'; input.setAttribute('aria-describedby', counter.id); input.after(counter);
            input.addEventListener('input', () => { counter.textContent = input.value.length + ' / ' + input.maxLength; });
        });
        container.append(form);
        const put = (name, value) => {
            const field = q(name); if (!field) return;
            if (field.type === 'checkbox') field.checked = Boolean(value);
            else {
                if (field.tagName === 'SELECT' && value && ![...field.options].some(option => option.value === String(value))) {
                    const option = node('option', String(value)); option.value = String(value); field.append(option);
                }
                field.value = value ?? '';
            }
            if (field.matches('textarea[maxlength]')) field.dispatchEvent(new Event('input'));
        };
        const value = name => q(name).value.trim();
        return { form, q, put, value, save, cancel, remove, feedback };
    }
    function setDate(entry, prefix, date) {
        const [year, month] = (date || '').split('-');
        entry.put(prefix + 'Year', year); entry.put(prefix + 'Month', month ? months[Number(month) - 1] : '');
    }
    function date(entry, prefix) {
        const year = entry.value(prefix + 'Year'), month = entry.value(prefix + 'Month');
        if (!year && !month) return null;
        if (!/^(19|20|21)\d{2}$/.test(year) || !months.includes(month)) throw Error('Choose both a valid month and a four-digit year.');
        return year + '-' + String(months.indexOf(month) + 1).padStart(2, '0');
    }
    function bind(entry, fill, save, remove, hasRecord) {
        fill();
        entry.cancel.addEventListener('click', () => {
            if (!hasRecord()) entry.form.remove(); else fill();
            message('', false, entry.form);
        });
        entry.form.addEventListener('submit', event => {
            event.preventDefault();
            if (busy || !entry.form.reportValidity()) return;
            // Read values before disabling inputs during the request.
            let persist;
            try { persist = save(); } catch (error) { message(error.message, true, entry.form); return; }
            action(entry.form, async () => { await persist(); fill(); message('Changes saved.', false, entry.form); });
        });
        entry.remove.addEventListener('click', () => {
            if (!hasRecord()) { entry.form.remove(); return; }
            if (!window.confirm('Delete this record?')) return;
            action(entry.form, async () => { await remove(); message('Record deleted.'); });
        });
    }
    function materialForm() {
        const entry = card(document.querySelector('.user-info-card'), 'Personal information', templates.materials);
        $('editMaterialsBtn').hidden = true; entry.remove.remove();
        const fill = () => {
            const parts = (profile.full_name || '').split(' ');
            entry.put('editFirstName', profile.first_name || parts.shift() || ''); entry.put('editLastName', profile.first_name ? profile.last_name : parts.join(' '));
            entry.put('editHomeLocation', profile.home_location); entry.put('editCountryCode', profile.country_code || '+65');
            entry.put('editContactNumber', profile.contact_number); entry.put('editEmailAddress', profile.email);
            entry.q('phonePrefixText').textContent = entry.value('editCountryCode');
        };
        entry.q('editCountryCode').addEventListener('change', () => { entry.q('phonePrefixText').textContent = entry.value('editCountryCode'); });
        bind(entry, fill, () => {
            const body = { first_name: entry.value('editFirstName'), last_name: entry.value('editLastName'), home_location: entry.value('editHomeLocation'), country_code: entry.value('editCountryCode'), contact_number: entry.value('editContactNumber') };
            return async () => { await JRS.request('/profile', { method: 'PUT', body }); Object.assign(profile, body, {full_name: [body.first_name, body.last_name].filter(Boolean).join(' ')}); identity(); };
        }, async () => {}, () => true);
    }
    function summaryForm() {
        const entry = card($('summaryContent'), 'Personal summary', templates.summary); $('addSummaryBtn').hidden = true;
        bind(entry, () => entry.put('summaryInput', profile.personal_summary), () => {
            const body = { personal_summary: entry.value('summaryInput') };
            return async () => { await JRS.request('/profile/summary', { method: 'PUT', body }); profile.personal_summary = body.personal_summary; };
        }, async () => { await JRS.request('/profile/summary', { method: 'PUT', body: { personal_summary: '' } }); profile.personal_summary = ''; entry.put('summaryInput', ''); }, () => true);
    }
    const sections = { career: ['careerList', 'role', 'Career history', 'role_id'], education: ['educationList', 'education', 'Education', 'education_id'], certifications: ['certList', 'licence', 'Licence or certification', 'cert_id'] };
    function recordForm(section, record = {}) {
        const [container, template, label, key] = sections[section];
        let baseline = {...record};
        const entry = card($(container), label + ' ' + ($(container).querySelectorAll('form').length + 1), templates[template]);
        function fill() {
            if (section === 'career') {
                entry.put('roleTitle', baseline.job_title); entry.put('roleCompany', baseline.company_name); entry.put('roleDescription', baseline.description);
                setDate(entry, 'roleStart', baseline.start_month_year); setDate(entry, 'roleEnd', baseline.end_month_year);
                entry.put('roleStillInRole', baseline.is_current_role);
                entry.q('roleEndMonth').disabled = entry.q('roleEndYear').disabled = entry.q('roleStillInRole').checked;
            } else if (section === 'education') {
                entry.put('eduCourse', baseline.qualification); entry.put('eduInstitution', baseline.institution); entry.put('eduLevel', baseline.qualification_level);
                entry.put('eduStartYear', baseline.start_year); entry.put('eduFinishedYear', baseline.finished_year || baseline.end_month_year?.slice(0, 4));
            } else {
                entry.put('certName', baseline.cert_name); entry.put('certIssuer', baseline.issuing_org); entry.put('certDescription', baseline.description);
                setDate(entry, 'certIssue', baseline.issue_month_year); setDate(entry, 'certExpiry', baseline.expiry_month_year); entry.put('certNoExpiry', baseline.no_expiry);
                entry.q('certExpiryMonth').disabled = entry.q('certExpiryYear').disabled = entry.q('certNoExpiry').checked;
            }
        }
        if (section === 'career') entry.q('roleStillInRole').addEventListener('change', () => { entry.q('roleEndMonth').disabled = entry.q('roleEndYear').disabled = entry.q('roleStillInRole').checked; });
        if (section === 'certifications') entry.q('certNoExpiry').addEventListener('change', () => { entry.q('certExpiryMonth').disabled = entry.q('certExpiryYear').disabled = entry.q('certNoExpiry').checked; });
        if (section === 'education') for (const [value, text] of Object.entries(qualifications)) { const option = node('option', text); option.value = value; entry.q('eduLevel').append(option); }
        bind(entry, fill, () => {
            let body;
            if (section === 'career') body = { job_title: entry.value('roleTitle'), company_name: entry.value('roleCompany'), description: entry.value('roleDescription'), is_current_role: entry.q('roleStillInRole').checked, start_month_year: date(entry, 'roleStart'), end_month_year: entry.q('roleStillInRole').checked ? null : date(entry, 'roleEnd') };
            else if (section === 'education') {
                const year = entry.value('eduFinishedYear');
                body = { institution: entry.value('eduInstitution'), qualification: entry.value('eduCourse'), qualification_level: entry.value('eduLevel'), start_year: entry.value('eduStartYear'), finished_year: year, is_current_study: Boolean(baseline.is_current_study), end_month_year: baseline.end_month_year || null, description: baseline.description || '' };
                if (body.is_current_study) body.end_month_year = year ? year + '-' + (baseline.end_month_year?.slice(5) || '12') : null;
            } else body = { cert_name: entry.value('certName'), issuing_org: entry.value('certIssuer'), description: entry.value('certDescription'), no_expiry: entry.q('certNoExpiry').checked, issue_month_year: date(entry, 'certIssue'), expiry_month_year: entry.q('certNoExpiry').checked ? null : date(entry, 'certExpiry') };
            return async () => {
                const id = baseline[key];
                const result = await JRS.request('/profile/' + section + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body });
                const saved = {...baseline, ...body, [key]: id || result.id};
                if (!saved[key]) throw Error('The saved record could not be confirmed. Reload your profile before adding another.');
                profile[section] = id ? profile[section].map(row => row[key] === id ? saved : row) : [...profile[section], saved]; baseline = saved;
            };
        }, async () => { await JRS.request('/profile/' + section + '/' + baseline[key], { method: 'DELETE' }); profile[section] = profile[section].filter(row => row[key] !== baseline[key]); entry.form.remove(); }, () => Boolean(baseline[key]));
        return entry;
    }
    function skillForm() {
        const entry = card($('skillTags'), 'Skills'); $('addSkillBtn').hidden = true;
        entry.form.classList.add('profile-skill-selector'); entry.remove.remove();
        const tags = node('div', undefined, 'profile-selected-skills'); tags.setAttribute('aria-label', 'Selected skills');
        const row = node('div', undefined, 'profile-skill-add-row');
        const input = node('input'); input.type = 'text'; input.maxLength = 50; input.placeholder = 'Type a skill, for example React or Customer service'; input.setAttribute('aria-label', 'Add a skill');
        const add = node('button', '+ Add skill', 'btn-outline'); add.type = 'button'; row.append(input, add);
        const count = node('small'); const fieldset = entry.form.querySelector('fieldset'); const legend = fieldset.querySelector('legend'); legend.after(tags, row, count);
        let draft = [...profile.skills];
        function renderTags() {
            tags.replaceChildren();
            for (const skill of draft) { const chip = node('button', undefined, 'profile-selected-skill'); chip.type = 'button'; chip.title = 'Remove ' + skill; chip.setAttribute('aria-label', 'Remove ' + skill); chip.append(node('span', skill), node('span', '×')); chip.addEventListener('click', () => { draft = draft.filter(item => item !== skill); renderTags(); }); tags.append(chip); }
            count.textContent = 'Add relevant skills one at a time. ' + draft.length + '/50 added.'; add.disabled = draft.length >= 50 || !input.value.trim();
        }
        entry.form.addEventListener('profile-ready', renderTags);
        function addDraft() {
            const result = addSkill(draft, input.value.replace(/\s+/g, ' '));
            if (!result.success) { message(result.error, true, entry.form); return; }
            if (draft.length >= 50) { message('You can add up to 50 skills.', true, entry.form); return; }
            draft = result.updatedSkills; input.value = ''; message('', false, entry.form); renderTags();
        }
        input.addEventListener('input', () => { message('', false, entry.form); renderTags(); }); add.addEventListener('click', addDraft);
        input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addDraft(); } });
        bind(entry, () => { draft = [...profile.skills]; input.value = ''; renderTags(); }, () => {
            const skills = [...draft]; return async () => { await JRS.request('/profile/skills', {method: 'PUT', body: {skills}}); profile.skills = skills; };
        }, async () => {}, () => true);
    }
    function languageForm(record = {}) {
        let baseline = {...record};
        const entry = card($('languageList'), 'Language ' + ($('languageList').querySelectorAll('form').length + 1));
        const grid = node('div', undefined, 'profile-form-grid profile-language-grid');
        function field(labelText, key, choices, placeholder) {
            const label = node('label', undefined, 'form-group'); label.append(node('span', labelText));
            const input = choices ? node('select') : node('input'); input.dataset.field = key; input.required = true; input.setAttribute('aria-label', labelText);
            if (choices) { const first = node('option', placeholder); first.value = ''; input.append(first); for (const [value, text] of Object.entries(choices)) { const option = node('option', text); option.value = value; input.append(option); } }
            else { input.type = 'text'; input.maxLength = 60; }
            label.append(input); grid.append(label); return label;
        }
        field('Language', 'language', languages, 'Select language');
        const other = field('Other language name', 'otherLanguage');
        field('Reading level', 'readingLevel', Object.fromEntries(levels.map(level => [level,level])), 'Select');
        field('Writing level', 'writingLevel', Object.fromEntries(levels.map(level => [level,level])), 'Select');
        entry.form.querySelector('legend').after(grid);
        function toggleOther() { other.hidden = entry.value('language') !== 'other'; entry.q('otherLanguage').disabled = other.hidden; }
        entry.q('language').addEventListener('change', toggleOther);
        function fill() {
            const code = baseline.language_code || Object.keys(languages).find(key => languages[key].toLowerCase() === baseline.language_name?.toLowerCase()) || (baseline.language_name ? 'other' : '');
            entry.put('language', code); entry.put('otherLanguage', code === 'other' ? baseline.language_name : '');
            entry.put('readingLevel', baseline.reading_level); entry.put('writingLevel', baseline.writing_level); toggleOther();
        }
        bind(entry, fill, () => {
            const code = entry.value('language');
            const saved = {language_name: code === 'other' ? entry.value('otherLanguage') : languages[code], language_code: code, reading_level: entry.value('readingLevel'), writing_level: entry.value('writingLevel'), can_read: true, can_write: true};
            if (!saved.language_name || !levels.includes(saved.reading_level) || !levels.includes(saved.writing_level)) throw Error('Choose a language and both reading and writing levels.');
            const list = profile.languages.filter(row => row.language_name !== baseline.language_name);
            if (list.some(row => row.language_name.toLowerCase() === saved.language_name.toLowerCase())) throw Error('This language has already been added.');
            return async () => { await JRS.request('/profile/languages', {method: 'PUT', body: {languages: [...list, saved]}}); profile.languages = [...list, saved]; baseline = saved; };
        }, async () => { const list = profile.languages.filter(row => row.language_name !== baseline.language_name); await JRS.request('/profile/languages', {method: 'PUT', body: {languages: list}}); profile.languages = list; entry.form.remove(); }, () => Boolean(baseline.language_name));
        return entry;
    }
    function addRecord(section) { const entry = recordForm(section); entry.form.scrollIntoView?.({behavior: 'smooth', block: 'nearest'}); entry.form.querySelector('input,select,textarea')?.focus({preventScroll: true}); }
    $('addRoleBtn').addEventListener('click', () => addRecord('career'));
    $('addEducationBtn').addEventListener('click', () => addRecord('education'));
    $('addCertBtn').addEventListener('click', () => addRecord('certifications'));
    $('addLanguageBtn').addEventListener('click', () => { const entry = languageForm(); entry.q('language').focus(); });
    $('logoutBtn').addEventListener('click', () => action(null, async () => { await JRS.request('/logout', {method: 'POST'}); window.location.href = '../login/login.html'; }));
    $('profileRetryBtn').addEventListener('click', () => window.location.reload());
    const initialControls = [...document.querySelectorAll('button')]; initialControls.forEach(button => { button.disabled = true; });
    try {
        const [, result] = await Promise.all([JRS.request('/me'), JRS.request('/profile')]); profile = result.profile;
        identity(); materialForm(); summaryForm(); skillForm();
        for (const section of Object.keys(sections)) for (const record of profile[section]) recordForm(section, record);
        for (const record of profile.languages) languageForm(record);
        document.body.classList.remove('profile-loading'); $('profileMain').setAttribute('aria-busy', 'false'); $('profileLoading').hidden = true;
        initialControls.forEach(button => { button.disabled = false; });
    } catch (error) {
        if (error.status === 401) window.location.replace('../login/login.html');
        else { document.body.classList.remove('profile-loading'); $('profileMain').setAttribute('aria-busy', 'false'); $('profileLoading').hidden = true; document.querySelector('.profile-grid').hidden = true; $('profileRetryBtn').hidden = false; $('profileRetryBtn').disabled = false; message('Unable to load your profile. Please try again.', true); }
    }
});
