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
        const waterfallData = simulateWaterfall(url);
        
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
