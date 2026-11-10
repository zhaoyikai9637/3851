const { validatePhoneNumberLength } = require('../../client/utils/materials_summary_utils');
const { passwordPolicyError } = require('../../client/utils/password-policy');
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
    const error = passwordPolicyError(value);
    if (error) fail(error);
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
            start_month_year, end_month_year, is_current_role, description: text(b.description, 'Description', 5000) };
    } },
    education: { table: 'EDUCATION', key: 'education_id', validate(b) {
        const is_current_study = bool(b.is_current_study);
        const finished_year = text(b.finished_year, 'Finished year', 4);
        if (finished_year && !/^(19|20|21)\d{2}$/.test(finished_year)) fail('Invalid finished year.');
        const structured = {};
        if (Object.hasOwn(b, 'start_year')) {
            structured.start_year = text(b.start_year, 'Start year', 4) || null;
            if (structured.start_year && !/^(19|20|21)\d{2}$/.test(structured.start_year)) fail('Invalid start year.');
            if (structured.start_year && finished_year && structured.start_year > finished_year) fail('Graduation year must not precede start year.');
        }
        if (Object.hasOwn(b, 'qualification_level')) {
            structured.qualification_level = text(b.qualification_level, 'Qualification level', 32) || null;
            if (structured.qualification_level && !['SECONDARY','CERTIFICATE','DIPLOMA','ASSOCIATE','BACHELOR','MASTER','DOCTORATE','OTHER'].includes(structured.qualification_level)) fail('Select a valid qualification level.');
        }
        return { ...structured, institution: text(b.institution, 'Institution', 150, true), qualification: text(b.qualification, 'Qualification', 150, true),
            is_current_study, finished_year: is_current_study && !Object.hasOwn(b, 'start_year') ? null : finished_year || null,
            end_month_year: is_current_study ? month(b.end_month_year, 'Expected finish') : null,
            description: text(b.description, 'Course highlights', 5000) };
    } },
    certifications: { table: 'CERTIFICATION', key: 'cert_id', validate(b) {
        const no_expiry = bool(b.no_expiry), issue_month_year = month(b.issue_month_year, 'Issue date');
        const expiry_month_year = no_expiry ? null : month(b.expiry_month_year, 'Expiry date');
        ordered(issue_month_year, expiry_month_year);
        return { cert_name: text(b.cert_name, 'Certificate name', 150, true), issuing_org: text(b.issuing_org, 'Issuer', 150),
            issue_month_year, expiry_month_year, no_expiry, description: text(b.description, 'Description', 5000) };
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
    const result = value.map(v => {
        const row = { language_name: text(v.language_name, 'Language', 80, true), can_read: bool(v.can_read), can_write: bool(v.can_write) };
        if (Object.hasOwn(v, 'language_code')) {
            row.language_code = text(v.language_code, 'Language code', 16) || null;
            if (row.language_code && !['en','zh','ms','ta','hi','id','vi','th','ja','ko','fr','de','es','ar','pt','ru','bn','ur','fil','other'].includes(row.language_code)) fail('Select a valid language.');
        }
        for (const key of ['reading_level', 'writing_level']) if (Object.hasOwn(v, key)) {
            row[key] = text(v[key], 'Language level', 16) || null;
            if (row[key] && !['Basic','Intermediate','Advanced','Native'].includes(row[key])) fail('Select a valid language level.');
        }
        return row;
    });
    if (result.some(v => !v.can_read && !v.can_write)) fail('Select reading or writing for each language.');
    if (new Set(result.map(v => v.language_name.toLowerCase())).size !== result.length) fail('Duplicate languages are not allowed.');
    return result;
}
module.exports = { fail, text, email, password, id, profile, sections, skills, languages };
