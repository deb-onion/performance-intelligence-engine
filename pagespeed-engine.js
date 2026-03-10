// The Performance Intelligence Engine now runs Lighthouse locally via headless 
// Chrome rather than calling the Google API. This means zero API keys are required
// to get PageSpeed equivalents!

async function runPageSpeedInsights(url, lighthouseData) {
    console.log(`Extracting Core Web Vitals for: ${url}`);
    
    // We already ran lighthouse locally, so we just extract the PSI equivalent scores
    if (!lighthouseData || !lighthouseData.audits || !lighthouseData.categories) {
        return null;
    }

    const audits = lighthouseData.audits;
    const categories = lighthouseData.categories;

    return {
        performanceScore: (categories.performance?.score || 0) * 100,
        lcp: audits['largest-contentful-paint']?.numericValue || 0,
        fcp: audits['first-contentful-paint']?.numericValue || 0,
        speedIndex: audits['speed-index']?.numericValue || 0,
        tbt: audits['total-blocking-time']?.numericValue || 0,
        cls: audits['cumulative-layout-shift']?.numericValue || 0,
        tti: audits['interactive']?.numericValue || 0,
        coreWebVitals: {
            lcpPass: (audits['largest-contentful-paint']?.numericValue || 9999) < 2500,
            clsPass: (audits['cumulative-layout-shift']?.numericValue || 99) < 0.1,
            tbtPass: (audits['total-blocking-time']?.numericValue || 9999) < 200,
        }
    };
}

module.exports = { runPageSpeedInsights };
