function renderWaterfall(data, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear existing

    if (!data || data.length === 0) {
        container.innerHTML = '<p>No waterfall data available for this page.</p>';
        return;
    }

    const margin = { top: 30, right: 30, bottom: 30, left: 150 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = (data.length * 40) + margin.top + margin.bottom;

    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Find max time for X axis
    const maxTime = d3.max(data, d => d.start + d.duration);

    const x = d3.scaleLinear()
        .domain([0, maxTime])
        .range([0, width]);

    // Add X axis
    svg.append("g")
        .attr("transform", `translate(0, -10)`)
        .call(d3.axisTop(x).ticks(10).tickFormat(d => d + 'ms'))
        .attr("color", "#8b949e");

    const y = d3.scaleBand()
        .domain(data.map((d, i) => i))
        .range([0, data.length * 40])
        .padding(0.2);

    // Grid lines
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0, ${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x)
            .ticks(10)
            .tickSize(-(height - margin.top - margin.bottom))
            .tickFormat("")
        )
        .attr("color", "#30363d")
        .style("stroke-dasharray", ("3,3"))
        .style("opacity", 0.5);

    // Y Axis labels (URLs)
    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(i => {
            const url = new URL(data[i].url);
            let name = url.pathname.split('/').pop() || url.hostname;
            if (name.length > 20) name = name.substring(0, 17) + '...';
            return name;
        }))
        .attr("color", "#c9d1d9")
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em");

    // Bars
    data.forEach((item, i) => {
        const group = svg.append("g").attr("transform", `translate(0, ${y(i)})`);

        // Sanitize missing data to prevent silent SVG NaN coordinate failures
        const safeStart = Number(item.start) || 0;
        const safeDuration = Number(item.duration) || 10;
        const safeDns = Number(item.dns) || 0;
        const safeConnect = Number(item.connect) || 0;
        const safeTtfb = Number(item.ttfb) || 0;
        const safeDownload = Number(item.download) || 0;

        // Helper to draw segment
        const drawSeg = (startVal, durationVal, color) => {
            if (durationVal > 0) {
                group.append("rect")
                    .attr("x", Math.max(0, x(startVal)))
                    .attr("y", 0)
                    .attr("width", Math.max(1, x(durationVal))) // Minimum 1px width
                    .attr("height", y.bandwidth())
                    .attr("fill", color)
                    .attr("rx", 2);
            }
        };

        // Render waterfall phases
        let currentOffset = safeStart;
        
        // Render blocking indicator border
        if (item.renderBlocking) {
             group.append("rect")
                .attr("x", Math.max(0, x(safeStart) - 2))
                .attr("y", -2)
                .attr("width", Math.max(1, x(safeDuration) + 4))
                .attr("height", y.bandwidth() + 4)
                .attr("fill", "none")
                .attr("stroke", "#f85149")
                .attr("stroke-width", 2)
                .attr("rx", 3);
        }

        if (safeDns === 0 && safeConnect === 0 && safeTtfb === 0 && safeDownload === 0 && safeDuration > 0) {
            // Fallback for flat duration data (from Lighthouse)
            drawSeg(currentOffset, safeDuration, '#58a6ff');
        } else {
            // Detailed WebPageTest timings
            drawSeg(currentOffset, safeDns, '#2ea043'); currentOffset += safeDns;
            drawSeg(currentOffset, safeConnect, '#d29922'); currentOffset += safeConnect;
            drawSeg(currentOffset, safeTtfb, '#bf4b8a'); currentOffset += safeTtfb;
            drawSeg(currentOffset, safeDownload, '#58a6ff');
        }

        // Tooltip text
        const totalText = `${safeDuration.toFixed(1)}ms`;
        group.append("text")
            .attr("x", x(safeStart + safeDuration) + 5)
            .attr("y", y.bandwidth() / 2 + 4)
            .text(totalText)
            .attr("fill", "#8b949e")
            .attr("font-size", "10px")
            .attr("font-family", "Inter");
    });
}
