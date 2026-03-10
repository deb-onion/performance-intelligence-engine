const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { runAudit } = require('./analysis-engine');
const express = require('express');
const googleTrends = require('google-trends-api');

const TARGET_URLS = [
    'https://blackvoyage.com/products/airtrunk-120l-vortex-vacuum-seal-carry-on-suitcase',
    'https://blackvoyage.com/products/aero-vacuum-compression-backpack',
    'https://blackvoyage.com/products/vortex-carry-on',
    'https://blackvoyage.com/products/zephyr',
    'https://blackvoyage.com/products/aircabin-select',
    'https://blackvoyage.com/collections/best-sellers',
    'https://blackvoyage.com',
    'https://blackvoyage.com/collections/all'
];

const COMPETITOR_URLS = [
    'https://mybackvac.com/',
    'https://airback.store/',
    'https://www.nomatic.com/'
];

async function generatePDFReport(port) {
    console.log('\n===========================================');
    console.log('Generating Professional PDF Audit Report...');
    
    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir);
    }

    const puppeteerOptions = { 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    const browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();

    // Give the frontend time to render D3/Chart.js animations
    await page.goto(`http://localhost:${port}/dashboard.html`, { waitUntil: 'networkidle0' });
    
    // Additional wait to be safe for any JS render delays
    await new Promise(resolve => setTimeout(resolve, 3000));

    const pdfPath = path.join(reportsDir, 'performance-audit.pdf');
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await browser.close();
    console.log(`\nPDF Report generated successfully at: ${pdfPath}`);
}

async function runCLI() {
    console.log('--- PERFORMANCE INTELLIGENCE ENGINE ---');
    console.log(`Starting scheduled audit for ${TARGET_URLS.length} URL(s)...`);

    // 1. Run the data collection for target URLs
    console.log(`\n--- Auditing Primary Targets ---`);
    const results = await runAudit(TARGET_URLS);

    // 2. Run the data collection for Competitors
    console.log(`\n--- Auditing Top Competitors ---`);
    const competitorResults = await runAudit(COMPETITOR_URLS);

    // 3. Fetch US Google Trends Data for Market Intelligence
    console.log(`\n--- Fetching US Market Intelligence (Google Trends) ---`);
    let trendsData = null;
    try {
        const trendsRaw = await googleTrends.interestOverTime({
            keyword: ['luggage', 'travel bags', 'carry on suitcase'], 
            geo: 'US',
            startTime: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)) // Last 30 days
        });
        trendsData = JSON.parse(trendsRaw);
        console.log('Trends data fetched successfully.');
    } catch (e) {
        console.error("Failed to fetch Google Trends data:", e.message);
    }

    // Wrap everything into the final data payload
    const finalData = {
        timestamp: new Date().toISOString(),
        ranking: results.ranking,
        pages: results.pages,
        competitors: competitorResults.pages.map(p => ({
            url: p.url,
            score: p.psiData?.performanceScore || 0,
            lcp: p.psiData?.lcp || 0,
            tti: p.psiData?.tti || 0,
            jsWeight: p.lighthouseData?.jsBundle?.totalJsWeight || 0
        })),
        trends: trendsData
    };

    const dataDir = path.join(__dirname, 'public');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(path.join(dataDir, 'audit-data.json'), JSON.stringify(finalData, null, 2));
    
    // Sync to root data dir for API/local debugging
    const rootDataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir);
    fs.writeFileSync(path.join(rootDataDir, 'audit-data.json'), JSON.stringify(finalData, null, 2));

    console.log('Audit data saved to disk.');

    // 3. Briefly spin up a local server to render dashboard to PDF
    const app = express();
    app.use(express.static(path.join(__dirname, 'public')));
    
    const serverOpts = app.listen(0, async () => {
        const port = serverOpts.address().port;
        await generatePDFReport(port);
        serverOpts.close();
        console.log('\nAudit pipeline completed successfully.');
        process.exit(0);
    });
}

runCLI();
