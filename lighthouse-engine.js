const chromeLauncher = require('chrome-launcher');

async function runLighthouse(url) {
    console.log(`Running Lighthouse locally for: ${url}`);
    let chrome;
    try {
        chrome = await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox'] });
        
        // Lighthouse 10+ is an ES Module. We must dynamically import it in CommonJS environments (like GitHub Actions Node 18).
        const { default: lighthouse } = await import('lighthouse');
        
        const options = {
            logLevel: 'info',
            output: 'json',
            onlyCategories: ['performance'],
            port: chrome.port
        };

        const runnerResult = await lighthouse(url, options);

        // `.lhr` is the Lighthouse Result as a JS object
        const lhr = runnerResult.lhr;
        const audits = lhr.audits;

        // Bundle & Image Analysis data
        let totalJsWeight = 0;
        let unusedJsWeight = 0;
        let thirdPartyJsWeight = 0;

        if (audits['network-requests'] && audits['network-requests'].details) {
            const requests = audits['network-requests'].details.items;
            requests.forEach(req => {
                if (req.resourceType === 'Script') {
                    totalJsWeight += req.transferSize;
                    if (!req.url.includes(new URL(url).hostname)) {
                        thirdPartyJsWeight += req.transferSize;
                    }
                }
            });
        }

        if (audits['unused-javascript'] && audits['unused-javascript'].details) {
            audits['unused-javascript'].details.items.forEach(item => {
                unusedJsWeight += item.wastedBytes;
            });
        }

        const largestImage = audits['largest-contentful-paint-element']?.details?.items?.[0]?.node?.snippet || "None";
        const longTasks = audits['long-tasks']?.details?.items?.length || 0;

        await chrome.kill();

        return {
            jsBundle: {
                totalJsWeight,
                unusedJsWeight,
                thirdPartyJsWeight,
                longTasks
            },
            images: {
                largestImageSnippet: largestImage,
                unoptimizedLCP: audits['modern-image-formats']?.score < 1,
            },
            audits: lhr.audits // raw audits for AI
        };
    } catch (error) {
        if (chrome) await chrome.kill();
        console.error(`Lighthouse failed for ${url}:`, error.message);
        return null;
    }
}

module.exports = { runLighthouse };
