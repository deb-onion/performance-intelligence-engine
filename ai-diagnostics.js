function analyzePerformanceData(psiData, lighthouseData) {
    console.log('Running AI Diagnostics...');
    const recommendations = [];
    
    // 1. Oversized Hero Images
    if (lighthouseData && lighthouseData.images) {
        if (lighthouseData.images.unoptimizedLCP) {
            recommendations.push("Convert your Largest Contentful Paint image to WebP or AVIF format to reduce LCP latency.");
        }
    }

    // 2. Heavy JavaScript Bundles
    if (lighthouseData && lighthouseData.jsBundle) {
        const { totalJsWeight, unusedJsWeight, longTasks } = lighthouseData.jsBundle;
        const totalJsKb = totalJsWeight / 1024;
        
        if (totalJsKb > 500) {
            recommendations.push(`Reduce your JavaScript payload. You are currently shipping ${Math.round(totalJsKb)}KB of JS. Provide compressed, modern bundles.`);
        }
        if (unusedJsWeight > 100 * 1024) {
            recommendations.push(`Remove unused JavaScript. You have ${Math.round(unusedJsWeight / 1024)}KB of unused code dragging down performance.`);
        }
        if (longTasks > 5) {
            recommendations.push(`Your main thread is frequently blocked by ${longTasks} long tasks. Defer non-critical scripts.`);
        }
    }

    // 3. Shopify App Detection & Third-Party Overload
    if (lighthouseData && lighthouseData.jsBundle) {
        const { thirdPartyJsWeight } = lighthouseData.jsBundle;
        if (thirdPartyJsWeight > 300 * 1024) {
             recommendations.push("Third-party scripts (like Shopify Apps, analytics, chat widgets) are heavily impacting load times. Audit your active Shopify apps and remove unnecessary widgets.");
        }
    }

    // 4. Render Blocking CSS
    if (psiData && psiData.fcp > 2000) {
        recommendations.push("First Contentful Paint is slow. Eliminate render-blocking resources, especially CSS loaded in the <head>.");
    }

    // Default Fallback
    if (recommendations.length === 0) {
        recommendations.push("Your site is performing optimally. Continue monitoring Core Web Vitals to maintain speed.");
    }

    return recommendations;
}

module.exports = { analyzePerformanceData };
