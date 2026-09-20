const { validateLanguageInput, validateResumeFile } = require('./language_resume_utils');

describe('Aim A - Language and Resume Upload Drawers Unit Tests', () => {

    test('UT-30: Should pass validation when reading or writing language is provided', () => {
        expect(validateLanguageInput('English', '').valid).toBe(true);
        expect(validateLanguageInput('', 'Chinese').valid).toBe(true);
    });

    test('UT-31: Should fail validation when both reading and writing are empty', () => {
        const result = validateLanguageInput('', '');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Please enter at least one language for reading or writing.');
    });

    test('UT-32: Should accept valid resume file formats (pdf/docx)', () => {
        const mockPdf = { name: 'my_resume.pdf', size: 1024 * 1024 }; // 1MB
        expect(validateResumeFile(mockPdf).valid).toBe(true);
    });

    test('UT-33: Should reject unsupported file formats (e.g. png/exe)', () => {
        const mockImg = { name: 'photo.png', size: 500 * 1024 };
        const result = validateResumeFile(mockImg);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid file type');
    });

    test('UT-34: Should reject resume file exceeding 5MB limit', () => {
        const largeFile = { name: 'large_resume.pdf', size: 6 * 1024 * 1024 }; // 6MB
        const result = validateResumeFile(largeFile);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('File size exceeds the 5MB limit.');
    });
});