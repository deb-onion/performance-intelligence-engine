// A mock engine to simulate WebPageTest API responses, as no API key is provided but we need waterfall visualization data
function simulateWaterfall(url) {
    console.log(`Simulating WebPageTest Waterfall for: ${url}`);
    
    // Simulate some standard assets for a Shopify/eCommerce site
    const resources = [
        { url: url, type: 'Document', duration: 120, start: 0, dns: 20, connect: 30, ttfb: 60, download: 10, renderBlocking: true },
        { url: 'https://cdn.shopify.com/s/files/theme.css', type: 'Stylesheet', duration: 80, start: 150, dns: 10, connect: 20, ttfb: 30, download: 20, renderBlocking: true },
        { url: 'https://cdn.shopify.com/s/files/vendor.js', type: 'Script', duration: 300, start: 160, dns: 10, connect: 20, ttfb: 100, download: 170, renderBlocking: false },
        { url: 'https://blackvoyage.com/hero-image.jpg', type: 'Image', duration: 400, start: 200, dns: 15, connect: 25, ttfb: 150, download: 210, renderBlocking: false },
        { url: 'https://connect.facebook.net/en_US/fbevents.js', type: 'Script', duration: 150, start: 300, dns: 30, connect: 40, ttfb: 50, download: 30, renderBlocking: false },
        { url: 'https://www.google-analytics.com/analytics.js', type: 'Script', duration: 120, start: 310, dns: 25, connect: 35, ttfb: 40, download: 20, renderBlocking: false },
        { url: 'https://widget.intercom.io/widget/123', type: 'Script', duration: 250, start: 500, dns: 40, connect: 50, ttfb: 60, download: 100, renderBlocking: false },
    ];

    return resources;
}

module.exports = { simulateWaterfall };
