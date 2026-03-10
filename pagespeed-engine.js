const axios = require('axios');

async function runPageSpeedInsights(url, apiKey = null) {
    console.log(`Running PageSpeed Insights for: ${url}`);
    
    // We'll use the mobile strategy for our primary metrics.
    let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile`;
    if (apiKey) {
        apiUrl += `&key=${apiKey}`;
    }

    try {
        const response = await axios.get(apiUrl);
        const data = response.data;
        const lighthouseResult = data.lighthouseResult;
        const audits = lighthouseResult.audits;

        return {
            performanceScore: lighthouseResult.categories.performance.score * 100,
            lcp: audits['largest-contentful-paint'].numericValue,
            fcp: audits['first-contentful-paint'].numericValue,
            speedIndex: audits['speed-index'].numericValue,
            tbt: audits['total-blocking-time'].numericValue,
            cls: audits['cumulative-layout-shift'].numericValue,
            tti: audits['interactive'].numericValue,
            coreWebVitals: {
                lcpPass: audits['largest-contentful-paint'].numericValue < 2500,
                clsPass: audits['cumulative-layout-shift'].numericValue < 0.1,
                tbtPass: audits['total-blocking-time'].numericValue < 200,
            }
        };
    } catch (error) {
        console.error(`PageSpeed Insights failed for ${url}:`, error.response ? error.response.data : error.message);
        return null;
    }
}

module.exports = { runPageSpeedInsights };
