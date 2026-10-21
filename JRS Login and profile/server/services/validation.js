const { validatePhoneNumberLength } = require('../../client/utils/materials_summary_utils');
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function text(value, label, max, required = false) {
    if (typeof value !== 'string') { if (value == null && !required) return ''; fail(`${label} must be text.`); }
    const clean = value.trim();
    if ((required && !clean) || clean.length > max) fail(`${label} is required and/or exceeds ${max} characters.`);
    return clean;
}
function email(value) {
    const result = text(value, 'Email', 150, true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Enter a valid email address.');
    return result;
}
function password(value) {
    if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) fail('Password must contain at least 8 characters and at most 72 UTF-8 bytes.');
    return value;
}
function id(value) { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) fail('Invalid record ID.'); return n; }
function bool(value) { if (typeof value !== 'boolean') fail('Expected true or false.'); return value; }
function month(value, label) {
    const v = text(value, label, 7);
    if (v && !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(v)) fail(`${label} must be YYYY-MM.`);
    return v || null;
}
function ordered(start, end) { if (start && end && end < start) fail('End date must not precede start date.'); }
function profile(body) {
    const first_name = text(body.first_name, 'First name', 50, true);
    const last_name = text(body.last_name, 'Last name', 49);
    const country_code = text(body.country_code, 'Country code', 10, true);
    if (!/^\+\d{1,3}(?:-\d{3})?$/.test(country_code)) fail('Invalid country code.');
    const contact_number = text(body.contact_number, 'Phone number', 20);
    const check = validatePhoneNumberLength(country_code, contact_number);
    if (!check.valid) fail(check.error);
    return { first_name, last_name, full_name: `${first_name} ${last_name}`.trim(), country_code, contact_number,
        home_location: text(body.home_location, 'Home location', 200) };
}
const sections = {
    career: { table: 'CAREER_HISTORY', key: 'role_id', validate(b) {
        const is_current_role = bool(b.is_current_role);
        const start_month_year = month(b.start_month_year, 'Start date');
        const end_month_year = is_current_role ? null : month(b.end_month_year, 'End date');
        ordered(start_month_year, end_month_year);
        return { job_title: text(b.job_title, 'Job title', 150, true), company_name: text(b.company_name, 'Company', 150, true),
            start_month_year, end_month_year, is_current_role, description: text(b.description, 'Description', 2000) };
    } },
    education: { table: 'EDUCATION', key: 'education_id', validate(b) {
        const is_current_study = bool(b.is_current_study);
        const finished_year = text(b.finished_year, 'Finished year', 4);
        if (finished_year && !/^(19|20|21)\d{2}$/.test(finished_year)) fail('Invalid finished year.');
        return { institution: text(b.institution, 'Institution', 150, true), qualification: text(b.qualification, 'Qualification', 150, true),
            is_current_study, finished_year: is_current_study ? null : finished_year || null,
            end_month_year: is_current_study ? month(b.end_month_year, 'Expected finish') : null,
            description: text(b.description, 'Course highlights', 2000) };
    } },
    certifications: { table: 'CERTIFICATION', key: 'cert_id', validate(b) {
        const no_expiry = bool(b.no_expiry), issue_month_year = month(b.issue_month_year, 'Issue date');
        const expiry_month_year = no_expiry ? null : month(b.expiry_month_year, 'Expiry date');
        ordered(issue_month_year, expiry_month_year);
        return { cert_name: text(b.cert_name, 'Certificate name', 150, true), issuing_org: text(b.issuing_org, 'Issuer', 150),
            issue_month_year, expiry_month_year, no_expiry, description: text(b.description, 'Description', 2000) };
    } }
};
function skills(value) {
    if (!Array.isArray(value) || value.length > 50) fail('Provide at most 50 skills.');
    const result = value.map(v => text(v, 'Skill', 50, true));
    if (new Set(result.map(v => v.toLowerCase())).size !== result.length) fail('Duplicate skills are not allowed.');
    return result;
}
function languages(value) {
    if (!Array.isArray(value) || value.length > 50) fail('Provide at most 50 languages.');
    const result = value.map(v => ({ language_name: text(v.language_name, 'Language', 80, true), can_read: bool(v.can_read), can_write: bool(v.can_write) }));
    if (result.some(v => !v.can_read && !v.can_write)) fail('Select reading or writing for each language.');
    if (new Set(result.map(v => v.language_name.toLowerCase())).size !== result.length) fail('Duplicate languages are not allowed.');
    return result;
}
module.exports = { fail, text, email, password, id, profile, sections, skills, languages };

