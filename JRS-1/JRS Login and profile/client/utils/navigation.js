document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('applicantNavigation');
    const open = document.getElementById('openNavigation');
    const close = document.getElementById('closeNavigation');
    const backdrop = document.getElementById('navigationBackdrop');
    if (!sidebar || !open || !close || !backdrop) return;
    function setOpen(value) {
        sidebar.classList.toggle('open', value);
        open.setAttribute('aria-expanded', String(value));
        backdrop.hidden = !value;
    }
    open.addEventListener('click', () => setOpen(true));
    close.addEventListener('click', () => { setOpen(false); open.focus(); });
    backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setOpen(false); });
    sidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
});

// Keep legacy standalone pages available only when the integrated portal is disabled.
document.addEventListener('DOMContentLoaded', async function routeIntegratedNavigation() {
    if (!window.JRS) return;
    try {
        const features = await JRS.request('/integration-config');
        if (!features.experimentalApplicantPortal) return;
        const targets = {
            '/pages/jobs/jobs.html': '/applicant/jobs',
            '/pages/resume/resume.html': '/applicant/resume',
            '/pages/application-status/application-status.html': '/applicant/status'
        };
        document.querySelectorAll('.sidebar-nav a[href]').forEach(link => {
            const target = targets[new URL(link.href, window.location.href).pathname];
            if (target) link.href = target;
        });
    } catch { /* Standalone mode has no integration-config endpoint. */ }
});
