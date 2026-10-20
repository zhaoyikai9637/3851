const express = require('express');
const cors = require('cors');
const path = require('path');

const jobRoutes = require('./routes/jobs');
const interviewRoutes = require('./routes/interviews');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/api', (req, res, next) => {
    require('./config/db').ready.then(() => next(), next);
});
app.get('/', (req, res) => res.redirect('/pages/job-management/job-management.html'));

// Statically host the frontend assets in the `client` folder.
app.use(express.static(path.join(__dirname, '../client'), {
    setHeaders(res, filePath) {
        if (/\.(html|js|css)$/.test(filePath)) res.setHeader('Cache-Control', 'no-store');
    }
}));

// Mount API routes
app.use('/api/jobs', jobRoutes);
app.use('/api/interviews', interviewRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found' }));
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.status === 400 ? 'Invalid JSON request' : 'Request failed' });
});

if (require.main === module) {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
