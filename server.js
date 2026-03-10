const express = require('express');
const path = require('path');
const { runAudit } = require('./analysis-engine');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'data')));
app.use(express.json());

app.post('/api/audit', async (req, res) => {
    try {
        const { urls } = req.body;
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: 'Please provide an array of URLs.' });
        }
        
        console.log(`Starting audit for ${urls.length} URLs...`);
        const results = await runAudit(urls);
        
        // Save to data directory
        const dataPath = path.join(__dirname, 'data', 'audit-data.json');
        if (!fs.existsSync(path.join(__dirname, 'data'))) {
            fs.mkdirSync(path.join(__dirname, 'data'));
        }
        fs.writeFileSync(dataPath, JSON.stringify(results, null, 2));

        res.json({ message: 'Audit complete!', data: results });
    } catch (error) {
        console.error('Audit failed:', error);
        res.status(500).json({ error: 'Audit failed', details: error.message });
    }
});

app.get('/api/results', (req, res) => {
    const dataPath = path.join(__dirname, 'data', 'audit-data.json');
    if (fs.existsSync(dataPath)) {
        res.sendFile(dataPath);
    } else {
        res.status(404).json({ error: 'No audit data found. Please run an audit first.' });
    }
});

app.listen(PORT, () => {
    console.log(`Performance Intelligence Engine running on http://localhost:${PORT}`);
});
