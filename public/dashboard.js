document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
    try {
        const response = await fetch('./audit-data.json');
        
        if (!response.ok) {
            throw new Error('Audit data not found. Run npm run audit first.');
        }

        const data = await response.json();
        window.dashboardData = data; // Store globally for PDF generator
        
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('dashboardContent').classList.remove('hidden');
        
        const dateObj = new Date(data.timestamp);
        document.getElementById('dateStamp').textContent = `Generated on ${dateObj.toLocaleString()}`;

        populateMetrics(data);
        renderLeaderboard(data.ranking);
        renderCharts(data.pages);
        renderInsights(data.pages);
        setupWaterfall(data.pages);
        
        // NEW FEATURES
        setupPageDetails(data.pages);
        if (data.competitors) setupCompetitors(data);
        if (data.trends) setupTrends(data.trends);
        generateAISummary(data);
        setupNavigation();
        setupPdfDownload();

    } catch (error) {
        document.getElementById('loadingState').innerHTML = `
            <div style="color: var(--danger); text-align: center;">
                <h3>Error Loading Dashboard</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('#sidebarNav a');
    const sections = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active from all links
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Hide all sections
            sections.forEach(sec => sec.classList.add('hidden'));

            // Show target section
            const targetId = link.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            
            // D3 Waterfall fix: Re-render when the container is actually visible
            if (targetId === 'view-waterfall' && window.dashboardData) {
                const selector = document.getElementById('waterfallPageSelector');
                if (selector && selector.value !== '') {
                    const pageIndex = selector.value;
                    if (window.dashboardData.pages[pageIndex]) {
                        renderWaterfall(window.dashboardData.pages[pageIndex].waterfallData, 'waterfallContainer');
                    }
                }
            }
        });
    });
}

function populateMetrics(data) {
    const pages = data.pages;
    const avgScore = Math.round(pages.reduce((acc, p) => acc + (p.psiData?.performanceScore || 0), 0) / pages.length);
    const avgLcp = (pages.reduce((acc, p) => acc + (p.psiData?.lcp || 0), 0) / pages.length / 1000).toFixed(2);
    const avgSi = (pages.reduce((acc, p) => acc + (p.psiData?.speedIndex || 0), 0) / pages.length / 1000).toFixed(2);
    const avgTbt = Math.round(pages.reduce((acc, p) => acc + (p.psiData?.tbt || 0), 0) / pages.length);
    const avgJs = Math.round(pages.reduce((acc, p) => acc + (p.lighthouseData?.jsBundle?.totalJsWeight || 0), 0) / pages.length / 1024);

    document.getElementById('avgScore').textContent = avgScore;
    document.getElementById('avgScore').className = `value ${getScoreClass(avgScore)}`;
    
    const setMetric = (id, val, cls) => { const e = document.getElementById(id); if(e) { e.textContent = val; e.className = 'value ' + cls; } };

    setMetric('avgLcp', `${avgLcp}s`, avgLcp <= 2.5 ? 'score-green' : avgLcp <= 4.0 ? 'score-orange' : 'score-red');
    setMetric('avgSpeedIndex', `${avgSi}s`, avgSi <= 3.4 ? 'score-green' : avgSi <= 5.8 ? 'score-orange' : 'score-red');
    setMetric('avgTbt', `${avgTbt}ms`, avgTbt <= 200 ? 'score-green' : avgTbt <= 600 ? 'score-orange' : 'score-red');
    
    const jsElem = document.getElementById('avgJs');
    if (jsElem) jsElem.textContent = `${avgJs} KB`;
    
    document.getElementById('pagesCount').textContent = pages.length;

    if (data.ranking && data.ranking.length > 0) {
        document.getElementById('fastestPage').textContent = cleanUrl(data.ranking[0].url);
        document.getElementById('slowestPage').textContent = cleanUrl(data.ranking[data.ranking.length - 1].url);
    }
}

function renderLeaderboard(ranking) {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';

    ranking.forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="rank">#${r.rank}</span>
            <span class="url" title="${r.url}">${cleanUrl(r.url)}</span>
            <span class="score ${getScoreClass(r.score)}">${Math.round(r.score)}</span>
        `;
        list.appendChild(li);
    });
}

// ============== NEW FEATURE: PAGE DRILLDOWN ==============

function setupPageDetails(pages) {
    const selector = document.getElementById('detailPageSelector');
    selector.innerHTML = '';
    
    pages.forEach((p, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = cleanUrl(p.url);
        selector.appendChild(opt);
    });

    selector.addEventListener('change', (e) => {
        renderPageDetails(pages[e.target.value]);
    });

    if (pages.length > 0) {
        renderPageDetails(pages[0]);
    }
}

function renderPageDetails(page) {
    const container = document.getElementById('pageDetailContainer');
    const psi = page.psiData || {};
    const bundle = page.lighthouseData?.jsBundle || {};
    
    container.innerHTML = `
        <div class="detail-card ${psi.coreWebVitals?.lcpPass ? 'pass' : 'fail'}">
            <h4>LCP (Core Web Vital)</h4>
            <div class="val">${(psi.lcp / 1000).toFixed(2)}s</div>
        </div>
        <div class="detail-card ${psi.coreWebVitals?.clsPass ? 'pass' : 'fail'}">
            <h4>CLS (Core Web Vital)</h4>
            <div class="val">${(psi.cls).toFixed(3)}</div>
        </div>
        <div class="detail-card ${psi.coreWebVitals?.tbtPass ? 'pass' : 'fail'}">
            <h4>TBT (Core Web Vital)</h4>
            <div class="val">${(psi.tbt).toFixed(0)}ms</div>
        </div>
        <div class="detail-card">
            <h4>Performance Score</h4>
            <div class="val ${getScoreClass(psi.performanceScore)}">${Math.round(psi.performanceScore)}/100</div>
        </div>
        <div class="detail-card">
            <h4>First Contentful Paint</h4>
            <div class="val">${(psi.fcp / 1000).toFixed(2)}s</div>
        </div>
        <div class="detail-card">
            <h4>Time to Interactive</h4>
            <div class="val">${(psi.tti / 1000).toFixed(2)}s</div>
        </div>
        <div class="detail-card">
            <h4>Speed Index</h4>
            <div class="val">${(psi.speedIndex / 1000).toFixed(2)}s</div>
        </div>
        <div class="detail-card ${bundle.unusedJsWeight > 100 * 1024 ? 'fail' : 'pass'}">
            <h4>Unused JS Payload</h4>
            <div class="val">${(bundle.unusedJsWeight / 1024).toFixed(0)} KB</div>
        </div>
        <div class="detail-card">
            <h4>Third-Party JS</h4>
            <div class="val">${(bundle.thirdPartyJsWeight / 1024).toFixed(0)} KB</div>
        </div>
        <div class="detail-card ${bundle.longTasks > 3 ? 'fail' : 'pass'}">
            <h4>Long Tasks (Main Thread)</h4>
            <div class="val">${bundle.longTasks}</div>
        </div>
    `;

    // Render Page-Specific AI Diagnostics
    const aiBox = document.getElementById('pageSpecificAi');
    const aiContainer = document.getElementById('pageSpecificAiContainer');
    
    if (page.recommendations && page.recommendations.length > 0) {
        aiBox.classList.remove('hidden');
        aiContainer.innerHTML = '';
        page.recommendations.forEach(rec => {
            const div = document.createElement('div');
            div.className = 'ai-item';
            
            let title = 'Action Required';
            let iconHtml = `<div class="ai-icon default-icon">🔍</div>`;
            if (rec.includes('JavaScript')) {
                title = 'Script Bottleneck';
                iconHtml = `<div class="ai-icon js-icon">⚡</div>`;
            } else if (rec.includes('Image') || rec.includes('WebP')) {
                title = 'Media Bottleneck';
                iconHtml = `<div class="ai-icon media-icon">🖼️</div>`;
            }
            
            div.innerHTML = `
                ${iconHtml}
                <div class="ai-content">
                    <h4>${title}</h4>
                    <p>${rec}</p>
                </div>
            `;
            aiContainer.appendChild(div);
        });
    } else {
        aiBox.classList.add('hidden');
    }
}

// ============== NEW FEATURE: AI REPORT SUMMARY ==============

function generateAISummary(data) {
    const container = document.getElementById('aiExecutiveSummary');
    const avgScore = Math.round(data.pages.reduce((acc, p) => acc + (p.psiData?.performanceScore || 0), 0) / data.pages.length);
    const avgLcp = (data.pages.reduce((acc, p) => acc + (p.psiData?.lcp || 0), 0) / data.pages.length / 1000).toFixed(2);
    
    let summary = `Our Business Intelligence Engine has automatically verified <strong>${data.pages.length}</strong> pages across your domain structure. `;
    
    if (avgScore >= 90) {
        summary += `Overall technical performance is <strong>Excellent</strong> with an average score of ${avgScore}/100. `;
    } else if (avgScore >= 50) {
        summary += `Overall technical performance is <strong>Moderate</strong> with an average score of ${avgScore}/100. There are significant engineering opportunities to improve Largest Contentful Paint (LCP) and reduce JavaScript execution time. `;
    } else {
        summary += `Overall technical performance is <strong>Critical</strong> with an average score of ${avgScore}/100. Immediate development action is required to resolve rendering bottlenecks affecting user experience and SEO indexability. `;
    }

    if (data.competitors && data.competitors.length > 0) {
        // Find best competitor LCP
        let bestCompLcp = 999;
        let bestCompName = 'None';
        data.competitors.forEach(c => {
            const lcpSec = (c.lcp / 1000);
            if (lcpSec > 0 && lcpSec < bestCompLcp) {
                bestCompLcp = lcpSec;
                bestCompName = cleanUrl(c.url);
            }
        });

        if (bestCompLcp < 999) {
            summary += `<br><br><strong>Competitive Intelligence:</strong> Your average LCP load time is <strong>${avgLcp}s</strong>. The fastest direct competitor in the US Market currently is <strong>${bestCompName}</strong> with an LCP of <strong>${bestCompLcp.toFixed(2)}s</strong>. `;
            if (avgLcp > bestCompLcp) {
                summary += `You are currently loading <strong>${(avgLcp - bestCompLcp).toFixed(2)}s slower</strong> than the market leader, representing a high risk of cart abandonment relative to industry standards.`;
            } else {
                summary += `You are currently outperforming the market leader by <strong>${(bestCompLcp - avgLcp).toFixed(2)}s</strong>, providing a measurable competitive advantage in user retention.`;
            }
        }
    }
    
    container.innerHTML = summary;
}

// ============== NEW FEATURE: PDF EXPORT ==============

function setupPdfDownload() {
    const btn = document.getElementById('downloadPdfBtn');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
        const pageIndex = document.getElementById('detailPageSelector').value;
        const page = window.dashboardData.pages[pageIndex];
        const container = document.getElementById('view-drilldown');
        
        // Temporarily style container for PDF
        const originalBg = container.style.background;
        container.style.background = '#0b0f19'; // Force dark bg so text is visible
        container.style.padding = '20px';
        
        const opt = {
            margin:       0.5,
            filename:     `PIE-Report-${cleanUrl(page.url).replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0b0f19' },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(container).save().then(() => {
            container.style.background = originalBg;
            container.style.padding = '';
        });
    });
}

// ============== NEW FEATURE: COMPETITOR BENCHMARKING ==============

function setupCompetitors(data) {
    const targetAvgLcp = (data.pages.reduce((acc, p) => acc + (p.psiData?.lcp || 0), 0) / data.pages.length / 1000).toFixed(2);
    const targetAvgScore = Math.round(data.pages.reduce((acc, p) => acc + (p.psiData?.performanceScore || 0), 0) / data.pages.length);
    
    const competitors = data.competitors.map(c => ({
        url: cleanUrl(c.url),
        lcp: (c.lcp / 1000).toFixed(2),
        score: Math.round(c.score)
    }));

    // Add our site as "You"
    competitors.push({
        url: 'BlackVoyage (You)',
        lcp: targetAvgLcp,
        score: targetAvgScore,
        isYou: true
    });

    // Sort by LCP ascending (faster is better)
    competitors.sort((a, b) => a.lcp - b.lcp);

    const list = document.getElementById('competitorList');
    list.innerHTML = '';
    
    competitors.forEach((c, index) => {
        const li = document.createElement('li');
        if (c.isYou) li.style.background = 'rgba(59, 130, 246, 0.1)';
        li.innerHTML = `
            <span class="rank">#${index+1}</span>
            <span class="url" style="${c.isYou ? 'color: var(--accent-color); font-weight: 700;' : ''}">${c.url}</span>
            <span class="score ${getScoreClass(c.score)}">${c.score}/100</span>
        `;
        list.appendChild(li);
    });

    const labels = competitors.map(c => c.url);
    const lcps = competitors.map(c => c.lcp);
    const colors = competitors.map(c => c.isYou ? 'rgba(59, 130, 246, 0.9)' : 'rgba(156, 163, 175, 0.5)');

    createBarChart('competitorChart', labels, lcps, 'LCP (s)', colors, true);
}

// ============== NEW FEATURE: GOOGLE TRENDS ==============

function setupTrends(trendsData) {
    if (!trendsData || !trendsData.default || !trendsData.default.timelineData) return;
    
    const timeline = trendsData.default.timelineData;
    const labels = timeline.map(t => t.formattedTime);
    const datasets = [];

    // Assuming we passed multiple keywords like ['luggage', 'travel bags']
    // googleTrends returns values as an array corresponding to the keywords
    if (timeline.length > 0 && timeline[0].value.length > 0) {
        const keywords = ['luggage', 'travel bags', 'carry on suitcase'];
        const colors = ['rgba(59, 130, 246, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(16, 185, 129, 0.8)'];
        
        for (let i = 0; i < timeline[0].value.length; i++) {
            datasets.push({
                label: keywords[i] || `Keyword ${i+1}`,
                data: timeline.map(t => t.value[i]),
                borderColor: colors[i % colors.length],
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0
            });
        }
    }

    const ctx = document.getElementById('trendsChart');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e5e7eb', font: { family: 'Outfit' } } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    max: 100,
                    ticks: { color: '#9ca3af', font: { family: 'Inter' } }, 
                    grid: { color: 'rgba(255, 255, 255, 0.05)' } 
                },
                x: { 
                    ticks: { color: '#9ca3af', font: { family: 'Inter' }, maxRotation: 45, minRotation: 45 }, 
                    grid: { display: false } 
                }
            }
        }
    });
}

// ============== CHARTS & INSIGHTS (Existing Logic) ==============

function renderCharts(pages) {
    const labels = pages.map(p => cleanUrl(p.url));
    
    // Performance Score Chart
    const scores = pages.map(p => p.psiData?.performanceScore || 0);
    createBarChart('scoreChart', labels, scores, 'Performance Score', getScoreColors(scores), false);

    // FCP Chart (ms -> seconds)
    const fcp = pages.map(p => ((p.psiData?.fcp || 0) / 1000).toFixed(1));
    createBarChart('fcpChart', labels, fcp, 'FCP (s)', Array(labels.length).fill('rgba(0, 210, 255, 0.8)'), true);

    // LCP Chart (ms -> seconds)
    const lcps = pages.map(p => ((p.psiData?.lcp || 0) / 1000).toFixed(1));
    createBarChart('lcpChart', labels, lcps, 'LCP (s)', Array(labels.length).fill('rgba(88, 166, 255, 0.8)'), true);

    // TTI Chart (ms -> seconds)
    const tti = pages.map(p => ((p.psiData?.tti || 0) / 1000).toFixed(1));
    createBarChart('ttiChart', labels, tti, 'TTI (s)', Array(labels.length).fill('rgba(255, 126, 103, 0.8)'), true);

    // Speed Index Chart (ms -> seconds)
    const si = pages.map(p => ((p.psiData?.speedIndex || 0) / 1000).toFixed(1));
    createBarChart('speedIndexChart', labels, si, 'Speed Index (s)', Array(labels.length).fill('rgba(188, 140, 255, 0.8)'), true);

    // JS Bundle Chart (Total vs Unused vs Third Party)
    const bundledData = {
        labels: labels,
        datasets: [
            {
                label: 'Total JS (KB)',
                data: pages.map(p => Math.round((p.lighthouseData?.jsBundle?.totalJsWeight || 0) / 1024)),
                backgroundColor: 'rgba(59, 130, 246, 0.6)'
            },
            {
                label: 'Unused JS (KB)',
                data: pages.map(p => Math.round((p.lighthouseData?.jsBundle?.unusedJsWeight || 0) / 1024)),
                backgroundColor: 'rgba(239, 68, 68, 0.8)'
            },
            {
                label: 'Third-Party JS (KB)',
                data: pages.map(p => Math.round((p.lighthouseData?.jsBundle?.thirdPartyJsWeight || 0) / 1024)),
                backgroundColor: 'rgba(245, 158, 11, 0.8)'
            }
        ]
    };

    new Chart(document.getElementById('bundleChart'), {
        type: 'bar',
        data: bundledData,
        options: {
            plugins: {
                legend: { labels: { color: '#e5e7eb', font: { family: 'Outfit' } } }
            },
            scales: {
                x: { stacked: true, ticks: { color: '#9ca3af', font: { family: 'Inter' } } },
                y: { stacked: false, ticks: { color: '#9ca3af', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function renderInsights(pages) {
    const allRecs = new Set();
    pages.forEach(p => {
        if (p.recommendations) {
            p.recommendations.forEach(r => allRecs.add(r));
        }
    });

    const aiContainer = document.getElementById('aiRecommendations');
    aiContainer.innerHTML = '';

    allRecs.forEach(rec => {
        const div = document.createElement('div');
        div.className = 'ai-item';
        
        let title = 'Performance Insight';
        let iconHtml = `<div class="ai-icon default-icon">🔍</div>`;
        
        if (rec.includes('JavaScript')) {
            title = 'Script Optimization';
            iconHtml = `<div class="ai-icon js-icon">⚡</div>`;
        } else if (rec.includes('Image') || rec.includes('WebP')) {
            title = 'Media Optimization';
            iconHtml = `<div class="ai-icon media-icon">🖼️</div>`;
        } else if (rec.includes('Render') || rec.includes('Paint')) {
            title = 'Critical Path';
            iconHtml = `<div class="ai-icon render-icon">⏱️</div>`;
        }
        
        div.innerHTML = `
            ${iconHtml}
            <div class="ai-content">
                <h4>${title}</h4>
                <p>${rec}</p>
            </div>
        `;
        aiContainer.appendChild(div);
    });

    const assetsList = document.getElementById('assetInsightsList');
    assetsList.innerHTML = '';
    
    const totalJs = pages.reduce((acc, p) => acc + (p.lighthouseData?.jsBundle?.totalJsWeight || 0), 0);
    const avgLongTasks = Math.round(pages.reduce((acc, p) => acc + (p.lighthouseData?.jsBundle?.longTasks || 0), 0) / pages.length);
    
    const rows = [
        { label: 'Total Aggregated JS Load', value: `${(totalJs / 1024 / 1024).toFixed(2)} MB` },
        { label: 'Avg Main Thread Long Tasks', value: avgLongTasks },
        { label: 'Unoptimized LCP Images', value: pages.filter(p => p.lighthouseData?.images?.unoptimizedLCP).length }
    ];

    rows.forEach(r => {
        const div = document.createElement('div');
        div.className = 'insights-row';
        div.innerHTML = `<span class="insights-row-label">${r.label}</span><span class="insights-row-value">${r.value}</span>`;
        assetsList.appendChild(div);
    });
}

function setupWaterfall(pages) {
    const selector = document.getElementById('waterfallPageSelector');
    
    pages.forEach((p, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = cleanUrl(p.url);
        selector.appendChild(opt);
    });

    selector.addEventListener('change', (e) => {
        const pageIndex = e.target.value;
        const data = pages[pageIndex].waterfallData;
        renderWaterfall(data, 'waterfallContainer');
    });

    if (pages.length > 0) {
        renderWaterfall(pages[0].waterfallData, 'waterfallContainer');
    }
}

// ============== HELPERS ==============

function cleanUrl(url) {
    try {
        const u = new URL(url);
        let path = u.pathname;
        if (path === '/' || path === '') return u.hostname;
        const parts = path.split('/').filter(Boolean);
        if (parts.length > 2) return '.../' + parts.slice(-2).join('/');
        return path;
    } catch {
        return url;
    }
}

function getScoreClass(score) {
    if (score >= 90) return 'score-green';
    if (score >= 50) return 'score-orange';
    return 'score-red';
}

function getScoreColors(scores) {
    return scores.map(s => {
        if (s >= 90) return 'rgba(16, 185, 129, 0.8)';
        if (s >= 50) return 'rgba(245, 158, 11, 0.8)';
        if (s > 0) return 'rgba(239, 68, 68, 0.8)';
        return 'rgba(55, 65, 81, 0.5)';
    });
}

function createBarChart(id, labels, data, labelText, colors, isSeconds) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: labelText,
                data: data,
                backgroundColor: colors,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 4
            }]
        },
        options: {
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y + (isSeconds ? 's' : '');
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true, 
                    ticks: { 
                        color: '#9ca3af', 
                        font: { family: 'Inter' },
                        callback: function(value) {
                            return value + (isSeconds ? 's' : '');
                        }
                    }, 
                    grid: { color: 'rgba(255, 255, 255, 0.05)' } 
                },
                x: { 
                    ticks: { color: '#9ca3af', font: { family: 'Inter' }, maxRotation: 45, minRotation: 45 }, 
                    grid: { display: false } 
                }
            }
        }
    });
}
