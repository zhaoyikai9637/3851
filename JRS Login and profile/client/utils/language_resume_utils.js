/**
 * Utility Functions for Language & Resumé Upload Drawers
 */

function validateLanguageInput(reading, writing) {
    if (!reading && !writing) {
        return { valid: false, error: 'Please enter at least one language for reading or writing.' };
    }
    return { valid: true };
}

function validateResumeFile(file) {
    if (!file) {
        return { valid: false, error: 'No file selected.' };
    }

    const allowedExtensions = ['doc', 'docx', 'pdf', 'txt', 'rtf'];
    const fileName = file.name || '';
    const ext = fileName.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(ext)) {
        return { valid: false, error: 'Invalid file type. Allowed: doc, docx, pdf, txt, rtf.' };
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSizeBytes) {
        return { valid: false, error: 'File size exceeds the 5MB limit.' };
    }

    return { valid: true };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateLanguageInput,
        validateResumeFile
    };
}