const express = require('express');
const cors = require('cors');
const path = require('path');

const jobRoutes = require('./routes/jobs');
const interviewRoutes = require('./routes/interviews');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Statically host the frontend assets in the `client` folder.
app.use(express.static(path.join(__dirname, '../client')));

// Mount API routes
app.use('/api/jobs', jobRoutes);
app.use('/api/interviews', interviewRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});