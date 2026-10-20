function getRatingsData() {
    return Object.fromEntries(Array.from(document.querySelectorAll('.competency-row')).map(row => [row.dataset.category, Number(row.querySelector('input[type="number"]').value)]));
}
function getSelectedRecommendation() { return document.querySelector('input[name="recommendation"]:checked')?.value || null; }
function submitFeedback(data) {
    if (!data?.recommendation) return { success: false, error: 'Recommendation is required' };
    return { success: true, submittedAt: new Date().toISOString(), data };
}
function addAssessment(name, score = 3) {
    const section = document.getElementById('competencySection');
    if (Array.from(section.children).some(row => row.dataset.category.toLowerCase() === name.toLowerCase())) return false;
    const row = document.createElement('div'); row.className = 'competency-row'; row.dataset.category = name;
    const label = document.createElement('label'); label.textContent = name;
    const input = document.createElement('input'); input.id = `rating-${section.children.length}-${Date.now()}`; input.className = 'form-control rating-input'; input.type = 'number'; input.min = '0.5'; input.max = '5'; input.step = '0.5'; input.required = true; input.value = score; label.htmlFor = input.id;
    const scale = document.createElement('span'); scale.textContent = '/ 5'; scale.className = 'score-scale';
    const stars = document.createElement('div'); stars.className = 'star-rating'; stars.setAttribute('role', 'group'); stars.setAttribute('aria-label', `${name} rating`);
    const drawStars = () => stars.querySelectorAll('button').forEach((star, index) => {
        star.classList.toggle('filled', Number(input.value) >= index + 1);
        star.classList.toggle('half', Number(input.value) === index + 0.5);
        star.setAttribute('aria-pressed', String(Number(input.value) === index + 1));
    });
    for (let value = 1; value <= 5; value++) {
        const star = document.createElement('button'); star.type = 'button'; star.className = 'star-button'; star.textContent = '★';
        star.setAttribute('aria-label', `${name}: ${value} out of 5`);
        star.addEventListener('click', () => { input.value = value; drawStars(); }); stars.append(star);
    }
    input.addEventListener('input', drawStars); drawStars();
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-light-danger'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${name}`); remove.addEventListener('click', () => row.remove());
    row.append(label, stars, input, scale, remove); section.append(row); return true;
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('feedbackForm'); if (!form) return;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !/^[1-9]\d*$/.test(id)) { document.getElementById('candidateName').textContent = 'No interview selected'; ui.message('Select an interview from Interview Schedule.', true); return; }
    try {
        const { data } = await apiUtils.get(`/interviews/${id}`);
        for (const [element, field] of Object.entries({ candidateName: 'candidate', candidatePosition: 'position', candidateDate: 'date', candidateLocation: 'location', candidateInterviewer: 'interviewer' })) {
            document.getElementById(element).textContent = field === 'date' ? (data[field] || '').replace('T', ' ') : data[field] || '';
        }
        document.getElementById('comments').value = data.comments || '';
        const ratings = Object.keys(data.ratings).length ? data.ratings : { Experience: 3, 'Technical Skills': 3, Communication: 3, Teamwork: 3 };
        Object.entries(ratings).forEach(([name, score]) => addAssessment(name, score));
        document.querySelectorAll('input[name="recommendation"]').forEach(input => { input.checked = input.value === data.recommendation; });
        document.getElementById('feedbackFields').disabled = false;
    } catch (error) { document.getElementById('candidateName').textContent = 'Interview unavailable'; ui.message(error.message, true); return; }
    document.getElementById('addAssessmentBtn').addEventListener('click', () => {
        const input = document.getElementById('assessmentName'); const name = input.value.trim();
        if (!name || !addAssessment(name)) { ui.message('Enter a unique assessment name.', true); return; }
        input.value = ''; ui.message('Assessment added. Submit feedback to save it.');
    });
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (form.dataset.saving === 'true') return;
        const ratings = getRatingsData();
        if (!Object.keys(ratings).length) { ui.message('Add at least one assessment.', true); return; }
        form.dataset.saving = 'true'; ui.busy(form, true);
        try {
            await apiUtils.put(`/interviews/${id}/feedback`, { ratings, comments: document.getElementById('comments').value, recommendation: getSelectedRecommendation() });
            ui.go(ui.interviews);
        } catch (error) { ui.message(error.message, true); }
        finally { form.dataset.saving = 'false'; ui.busy(form, false); }
    });
});
if (typeof module !== 'undefined') module.exports = { getRatingsData, getSelectedRecommendation, submitFeedback, addAssessment };
