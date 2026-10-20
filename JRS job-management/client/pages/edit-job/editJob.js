function updateJobDetails(currentData, updatedFields) { return { ...currentData, ...updatedFields, lastUpdated: new Date().toISOString() }; }
function deleteJobRecord(jobId) { return { success: true, deletedId: jobId }; }
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('editJobForm'); if (!form) return;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !/^[1-9]\d*$/.test(id)) { ui.message('Select a job from Job Management before editing.', true); return; }
    let publicationStatus;
    try {
        const { data } = await apiUtils.get(`/jobs/${id}`);
        jobForm.fill(data); publicationStatus = data.publication_status;
        document.getElementById('statusBadge').textContent = data.status;
        document.getElementById('lastUpdated').textContent = data.last_updated || 'Not recorded';
        document.getElementById('jobFields').disabled = false;
    } catch (error) { ui.message(error.message, true); return; }
    form.addEventListener('submit', event => { event.preventDefault(); jobForm.save(form, publicationStatus, id); });
    document.getElementById('savePublishBtn').addEventListener('click', () => jobForm.save(form, 'Active', id));
    document.getElementById('deleteBtn').addEventListener('click', async () => {
        if (!confirm('Delete this job? This cannot be undone.')) return;
        ui.busy(form, true);
        try { await apiUtils.delete(`/jobs/${id}`); ui.go(ui.jobs); }
        catch (error) { ui.message(error.message, true); ui.busy(form, false); }
    });
});
if (typeof module !== 'undefined') module.exports = { updateJobDetails, deleteJobRecord };
