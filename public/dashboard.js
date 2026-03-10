document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
    try {
        // In local mode, we might just be serving the static JSON from the data directory
        const response = await fetch('/audit-data.json');
        
        if (!response.ok) {
            throw new Error('Audit data not found. Run npm run audit first.');
        }

        const data = await response.json();
        
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('dashboardContent').classList.remove('hidden');
        
        const dateObj = new Date(data.timestamp);
        document.getElementById('dateStamp').textContent = `Generated on ${dateObj.toLocaleString()}`;

        populateMetrics(data);
        renderLeaderboard(data.ranking);
        renderCharts(data.pages);
        renderInsights(data.pages);
        setupWaterfall(data.pages);

    } catch (error) {
        document.getElementById('loadingState').innerHTML = `
            <div style="color: var(--danger); text-align: center;">
                <h3>Error Loading Dashboard</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function populateMetrics(data) {
    const pages = data.pages;
    const avgScore = Math.round(pages.reduce((acc, p) => acc + (p.psiData?.performanceScore || 0), 0) / pages.length);
    
    document.getElementById('avgScore').textContent = avgScore;
    document.getElementById('avgScore').className = `value ${getScoreClass(avgScore)}`;
    
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

function renderCharts(pages) {
    const labels = pages.map(p => cleanUrl(p.url));
    
    // Performance Score Chart
    const scores = pages.map(p => p.psiData?.performanceScore || 0);
    createBarChart('scoreChart', labels, scores, 'Performance Score', getScoreColors(scores));

    // LCP Chart
    const lcps = pages.map(p => p.psiData?.lcp || 0);
    createBarChart('lcpChart', labels, lcps, 'LCP (ms)', Array(labels.length).fill('rgba(88, 166, 255, 0.8)'));

    // Speed Index Chart
    const si = pages.map(p => p.psiData?.speedIndex || 0);
    createBarChart('speedIndexChart', labels, si, 'Speed Index (ms)', Array(labels.length).fill('rgba(188, 140, 255, 0.8)'));

    // JS Bundle Chart (Total vs Unused vs Third Party)
    const bundledData = {
        labels: labels,
        datasets: [
            {
                label: 'Total JS (KB)',
                data: pages.map(p => Math.round((p.lighthouseData?.jsBundle?.totalJsWeight || 0) / 1024)),
                backgroundColor: 'rgba(88, 166, 255, 0.5)'
            },
            {
                label: 'Unused JS (KB)',
                data: pages.map(p => Math.round((p.lighthouseData?.jsBundle?.unusedJsWeight || 0) / 1024)),
                backgroundColor: 'rgba(248, 81, 73, 0.8)'
            },
            {
                label: 'Third-Party JS (KB)',
                data: pages.map(p => Math.round((p.lighthouseData?.jsBundle?.thirdPartyJsWeight || 0) / 1024)),
                backgroundColor: 'rgba(210, 153, 34, 0.8)'
            }
        ]
    };

    new Chart(document.getElementById('bundleChart'), {
        type: 'bar',
        data: bundledData,
        options: {
            plugins: {
                legend: { labels: { color: '#c9d1d9' } }
            },
            scales: {
                x: { stacked: true, ticks: { color: '#8b949e' } },
                y: { stacked: false, ticks: { color: '#8b949e' } } // Don't stack Y to see total overlap
            }
        }
    });
}

function renderInsights(pages) {
    // Collect all recommendations
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
        // Simple logic to iconify based on text
        const title = rec.includes('JavaScript') ? 'Script Optimization' : 
                      rec.includes('Image') ? 'Media Optimization' : 
                      rec.includes('Render') ? 'Critical Path' : 'Performance Insight';
        
        div.innerHTML = `
            <h4>${title}</h4>
            <p>${rec}</p>
        `;
        aiContainer.appendChild(div);
    });

    // Populate generic Asset Insights list
    const assetsList = document.getElementById('assetInsightsList');
    assetsList.innerHTML = '';
    
    // Total aggregate JS
    const totalJs = pages.reduce((acc, p) => acc + (p.lighthouseData?.jsBundle?.totalJsWeight || 0), 0);
    const avgLongTasks = Math.round(pages.reduce((acc, p) => acc + (p.lighthouseData?.jsBundle?.longTasks || 0), 0) / pages.length);
    
    const rows = [
        { label: 'Total Aggregated JS Load', value: `${Math.round(totalJs / 1024 / 1024)} MB` },
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

    // Initial render for first page
    if (pages.length > 0) {
        renderWaterfall(pages[0].waterfallData, 'waterfallContainer');
    }
}

// Helpers
function cleanUrl(url) {
    try {
        const u = new URL(url);
        let path = u.pathname;
        if (path === '/' || path === '') return u.hostname;
        // Keep last parts
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
        if (s >= 90) return 'rgba(46, 160, 67, 0.8)';
        if (s >= 50) return 'rgba(210, 153, 34, 0.8)';
        return 'rgba(248, 81, 73, 0.8)';
    });
}

function createBarChart(id, labels, data, labelText, colors) {
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
                borderColor: 'rgba(48, 54, 61, 0.5)'
            }]
        },
        options: {
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: '#8b949e' }, grid: { color: 'rgba(48, 54, 61, 0.3)' } },
                x: { ticks: { color: '#8b949e', maxRotation: 45, minRotation: 45 }, grid: { display: false } }
            }
        }
    });
}
