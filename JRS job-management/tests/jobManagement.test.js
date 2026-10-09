const { initialJobs, filterJobs, deleteJob } = require('../client/pages/job-management/jobmanagement');

describe('Job Management Module Tests', () => {
    test('Should filter jobs by search query, department, and status', () => {
        const result = filterJobs(initialJobs, 'Engineer', 'IT', 'Active');
        expect(result.length).toBe(1);
        expect(result[0].title).toBe('Software Engineer');
    });

    test('Should filter jobs by Unpublished status', () => {
        const result = filterJobs(initialJobs, '', '', 'Unpublished');
        expect(result.length).toBe(1);
        expect(result[0].title).toBe('HR Executive');
    });

    test('Should delete a job record by ID', () => {
        const remaining = deleteJob(initialJobs, 1);
        expect(remaining.length).toBe(2);
        expect(remaining.find(job => job.id === 1)).toBeUndefined();
    });
});