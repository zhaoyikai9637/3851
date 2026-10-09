/**
 * Create Job Page Script
 */

async function handleCreateJob() {
    const formData = {
        title: document.getElementById('jobTitle') ? document.getElementById('jobTitle').value : '',
        department: document.getElementById('department') ? document.getElementById('department').value : '',
        location: document.getElementById('location') ? document.getElementById('location').value : '',
        type: document.getElementById('employmentType') ? document.getElementById('employmentType').value : '',
        salaryRange: document.getElementById('salaryRange') ? document.getElementById('salaryRange').value : '',
        closingDate: document.getElementById('closingDate') ? document.getElementById('closingDate').value : '',
        description: document.getElementById('jobDescription') ? document.getElementById('jobDescription').value : '',
        requirements: document.getElementById('requirements') ? document.getElementById('requirements').value : ''
    };

    if (!formData.title || !formData.department) {
        alert('Please fill in required fields (Job Title & Department).');
        return;
    }

    try {
        if (typeof apiUtils !== 'undefined') {
            await apiUtils.post('/jobs', formData);
        }
        alert('Job published successfully!');
        window.location.href = '../job-management/job-management.html';
    } catch (error) {
        alert('Failed to publish job: ' + error.message);
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const publishBtn = document.getElementById('publishBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        if (publishBtn) publishBtn.addEventListener('click', handleCreateJob);
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                window.location.href = '../job-management/job-management.html';
            });
        }
    });
}