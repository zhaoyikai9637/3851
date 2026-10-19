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
