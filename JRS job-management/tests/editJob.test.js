const { updateJobDetails, deleteJobRecord } = require('../client/pages/edit-job/editjob');

describe('Edit Job Tests', () => {
    test('Should update job attributes accurately', () => {
        const original = { id: 1, title: 'Old Title', department: 'IT' };
        const updated = updateJobDetails(original, { title: 'New Title' });
        expect(updated.title).toBe('New Title');
        expect(updated.department).toBe('IT');
        expect(updated).toHaveProperty('lastUpdated');
    });

    test('Should return deletion status on delete', () => {
        const res = deleteJobRecord(1);
        expect(res.success).toBe(true);
        expect(res.deletedId).toBe(1);
    });
});