/**
 * Interview Feedback Page Script
 */

function initStarRating() {
    const rows = document.querySelectorAll('.competency-row');
    rows.forEach(row => {
        const stars = row.querySelectorAll('.star');
        const scoreDisplay = row.querySelector('.score-display');

        stars.forEach(star => {
            star.addEventListener('click', () => {
                const selectedValue = parseInt(star.getAttribute('data-value'));
                
                stars.forEach((s, index) => {
                    if (index < selectedValue) {
                        s.classList.add('filled');
                    } else {
                        s.classList.remove('filled');
                    }
                });

                if (scoreDisplay) {
                    scoreDisplay.textContent = `${selectedValue}.0 / 5.0`;
                }
            });
        });
    });
}

function getRatingsData() {
    const ratings = {};
    const rows = document.querySelectorAll('.competency-row');
    
    rows.forEach(row => {
        const category = row.getAttribute('data-category');
        const filledStars = row.querySelectorAll('.star.filled').length;
        if (category) {
            ratings[category] = filledStars;
        }
    });

    return ratings;
}

function getSelectedRecommendation() {
    const selected = document.querySelector('input[name="recommendation"]:checked');
    return selected ? selected.value : null;
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initStarRating();

        const submitBtn = document.getElementById('submitFeedbackBtn');
        const cancelBtn = document.getElementById('cancelBtn');

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                window.location.href = '../interview-schedule/interview-schedule.html';
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const comments = document.getElementById('comments') ? document.getElementById('comments').value : '';
                const recommendation = getSelectedRecommendation();

                if (!recommendation) {
                    alert('Please select an overall recommendation.');
                    return;
                }

                alert('Feedback submitted successfully!');
                window.location.href = '../interview-schedule/interview-schedule.html';
            });
        }
    });
}