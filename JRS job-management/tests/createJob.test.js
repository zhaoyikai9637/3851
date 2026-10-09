const { validateJobForm, submitJobForm } = require('../client/pages/create-job/createjob');

describe('Create Job Form Validation Tests', () => {
    test('Should fail validation if job title is empty', () => {
        const invalidData = { title: '', department: 'IT' };
        expect(validateJobForm(invalidData)).toBe(false);
    });

    test('Should pass submit if required fields are provided', () => {
        const validData = { title: 'Backend Developer', department: 'IT' };
        const response = submitJobForm(validData);
        expect(response.success).toBe(true);
    });
});