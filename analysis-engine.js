const { runPageSpeedInsights } = require('./pagespeed-engine');
const { runLighthouse } = require('./lighthouse-engine');
const { simulateWaterfall } = require('./webpagetest-engine');
const { analyzePerformanceData } = require('./ai-diagnostics');

async function runAudit(urls) {
    const results = [];
    
    for (const url of urls) {
        console.log(`\n===========================================`);
        console.log(`Starting comprehensive audit for ${url}`);
        
        const lighthouseData = await runLighthouse(url);
        const psiData = await runPageSpeedInsights(url, lighthouseData);
        
        const rawRequests = lighthouseData?.networkRequests || [];
        const waterfallData = rawRequests.map(req => {
            return {
                url: req.url,
                type: req.resourceType || 'Other',
                // Use correct Lighthouse network timing properties (in ms)
                duration: Math.max(0, (req.networkEndTime - req.networkRequestTime) || Number(req.duration) || 0),
                start: req.networkRequestTime || Number(req.startTime) || 0,
                dns: 0, connect: 0, ttfb: 0, download: 0, renderBlocking: false
            };
        }).sort((a,b) => a.start - b.start);

        // Normalize start times so the first request begins at 0
        if (waterfallData.length > 0) {
            const minStart = waterfallData[0].start;
            waterfallData.forEach(req => {
                req.start = Math.max(0, req.start - minStart);
            });
        }
        
        const recommendations = analyzePerformanceData(psiData, lighthouseData);

        results.push({
            url,
            psiData,
            lighthouseData: {
                jsBundle: lighthouseData?.jsBundle,
                images: lighthouseData?.images
            },
            waterfallData,
            recommendations
        });
    }

    // Compute Performance Ranking
    console.log(`\nCalculating final rankings...`);
    results.sort((a, b) => {
        const scoreA = a.psiData?.performanceScore || 0;
        const scoreB = b.psiData?.performanceScore || 0;
        return scoreB - scoreA; // Descending, highest score first
    });

    const ranking = results.map((r, index) => ({
        rank: index + 1,
        url: r.url,
        score: r.psiData?.performanceScore || 0,
        lcp: r.psiData?.lcp || 0
    }));

    return {
        timestamp: new Date().toISOString(),
        ranking,
        pages: results
    };
}

module.exports = { runAudit };
