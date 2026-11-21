const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const apiRoutes = require('./routes/api');
const db = require('./database/db');

// Ensure batch inspection columns exist in database
db.query('SELECT batch_photo_url FROM sales LIMIT 1').catch(() => {
    db.query(`
        ALTER TABLE sales 
        ADD COLUMN batch_photo_url VARCHAR(500) NULL,
        ADD COLUMN batch_inspection_notes VARCHAR(255) NULL
    `).catch(() => {});
});

const app = express();
const PORT = process.env.PORT || 5000;

// Allow cross-origin requests
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Find frontend folder
let frontendPath = path.resolve(__dirname, '..', 'frontend');
if (!fs.existsSync(frontendPath)) {
    frontendPath = path.resolve(__dirname, '..', '..', 'frontend');
}

// Disable browser caching for instant UI updates during testing
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// Serve static frontend files (CSS, JS, images)
app.use(express.static(frontendPath));

// If someone types /api in browser address bar, redirect to main page
app.get('/api', (req, res) => {
    res.redirect('/');
});

// API routes
app.use('/api', apiRoutes);

// Main route: serve website directly on localhost:5000
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send('Batloung Farm Distribution System is running.');
    }
});

// Central error handler with simple messages
app.use((err, req, res, next) => {
    console.error('Server error:', err.message || err);
    res.status(500).json({
        success: false,
        message: err.message || 'An error occurred on the server.'
    });
});

app.listen(PORT, () => {
    console.log('===========================================================');
    console.log('Batloung Farm Distribution System');
    console.log(`Website address: http://localhost:${PORT}`);
    console.log(`Database connected: ${process.env.DB_NAME || 'batloung_farm_db'}`);
    console.log('===========================================================');
});
