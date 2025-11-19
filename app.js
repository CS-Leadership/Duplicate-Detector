// app.js - Main application logic

let uploadedFiles = [];
let analysisResults = [];
let charts = {};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    loadSettings();
    loadPastAnalyses();
});

function initializeApp() {
    // File upload handling
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Fuzzy threshold slider
    document.getElementById('fuzzyThreshold').addEventListener('input', (e) => {
        document.getElementById('fuzzyValue').textContent = e.target.value;
    });

    // Analyze button
    document.getElementById('analyzeBtn').addEventListener('click', analyzeFiles);

    // Download buttons
    document.getElementById('downloadExcel').addEventListener('click', downloadExcel);
    document.getElementById('downloadPDF').addEventListener('click', downloadPDF);
    document.getElementById('downloadAllFiles').addEventListener('click', downloadAllFiles);

    // Remember settings
    document.getElementById('rememberSettings').addEventListener('change', (e) => {
        if (e.target.checked) {
            saveSettings();
        } else {
            localStorage.removeItem('detectorSettings');
        }
    });
}

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
            uploadedFiles.push(file);
        } else {
            alert(`Skipping ${file.name} - only Excel and CSV files are supported`);
        }
    });

    updateFileList();
    document.getElementById('analyzeBtn').disabled = uploadedFiles.length === 0;
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    
    if (uploadedFiles.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    fileList.innerHTML = uploadedFiles.map((file, index) => `
        <div class="file-item">
            <div class="file-info">
                <span class="file-icon">📄</span>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <button class="file-remove" onclick="removeFile(${index})">Remove</button>
        </div>
    `).join('');
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    updateFileList();
    document.getElementById('analyzeBtn').disabled = uploadedFiles.length === 0;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function analyzeFiles() {
    document.getElementById('progressSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';
    
    const fuzzyThreshold = parseInt(document.getElementById('fuzzyThreshold').value);
    const excludeText = document.getElementById('excludeText').value;
    const excludeTerms = excludeText.split(',').map(t => t.trim()).filter(t => t);

    const detector = new DuplicateDetector({
        fuzzyThreshold,
        excludeTerms
    });

    analysisResults = [];
    
    for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        updateProgress((i / uploadedFiles.length) * 100, `Processing ${file.name}...`);
        
        try {
            const data = await readFile(file);
            const result = detector.analyzeFile(data, file.name);
            analysisResults.push(result);
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            alert(`Error processing ${file.name}: ${error.message}`);
        }
    }

    updateProgress(100, 'Analysis complete!');
    
    setTimeout(() => {
        displayResults();
        saveAnalysis();
    }, 500);
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

function updateProgress(percent, text) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = text;
}

function displayResults() {
    document.getElementById('progressSection').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';

    // Aggregate statistics
    const totalStats = analysisResults.reduce((acc, result) => {
        acc.totalRows += result.statistics.totalRows;
        acc.duplicateRows += result.statistics.duplicateRows;
        acc.uniqueCustomers += result.statistics.uniqueCustomers;
        return acc;
    }, { totalRows: 0, duplicateRows: 0, uniqueCustomers: 0 });

    const duplicatePercent = totalStats.totalRows > 0 
        ? (totalStats.duplicateRows / totalStats.totalRows * 100).toFixed(1)
        : 0;

    // Update summary cards
    document.getElementById('statTotalReviews').textContent = totalStats.totalRows.toLocaleString();
    document.getElementById('statDuplicates').textContent = totalStats.duplicateRows.toLocaleString();
    document.getElementById('statDuplicatePercent').textContent = duplicatePercent + '%';
    document.getElementById('statCustomers').textContent = totalStats.uniqueCustomers.toLocaleString();
    document.getElementById('statFiles').textContent = analysisResults.length;

    // Display charts
    displayCharts();

    // Display top agents
    displayTopAgents();
}

function displayCharts() {
    // Trend chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (charts.trend) charts.trend.destroy();
    
    const trendData = analysisResults.map(result => ({
        label: result.filename.replace(/\.xlsx|\.csv|\.xls/g, ''),
        value: parseFloat(result.statistics.duplicatePercent)
    }));

    charts.trend = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: trendData.map(d => d.label),
            datasets: [{
                label: 'Duplicate Rate %',
                data: trendData.map(d => d.value),
                borderColor: '#4472C4',
                backgroundColor: 'rgba(68, 114, 196, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Duplicate Rate %'
                    }
                }
            }
        }
    });

    // Detection method chart
    const methodCtx = document.getElementById('methodChart').getContext('2d');
    
    if (charts.method) charts.method.destroy();

    // Aggregate detection methods
    const methodCounts = {};
    analysisResults.forEach(result => {
        result.duplicates.entries.forEach(dup => {
            const method = dup.detectionMethod.split('(')[0].trim();
            methodCounts[method] = (methodCounts[method] || 0) + 1;
        });
    });

    charts.method = new Chart(methodCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(methodCounts),
            datasets: [{
                data: Object.values(methodCounts),
                backgroundColor: [
                    '#4472C4',
                    '#FFC000',
                    '#70AD47',
                    '#C00000',
                    '#7030A0'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function displayTopAgents() {
    // Aggregate all agent data
    const agentMap = {};
    
    analysisResults.forEach(result => {
        result.agentSummary.forEach(agent => {
            if (!agentMap[agent.agent]) {
                agentMap[agent.agent] = {
                    agent: agent.agent,
                    totalReviews: 0,
                    duplicates: 0
                };
            }
            agentMap[agent.agent].totalReviews += agent.totalReviews;
            agentMap[agent.agent].duplicates += agent.duplicates;
        });
    });

    // Calculate rates and sort
    const agents = Object.values(agentMap)
        .filter(a => a.duplicates > 0)
        .map(a => ({
            ...a,
            rate: (a.duplicates / a.totalReviews * 100).toFixed(1)
        }))
        .sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate))
        .slice(0, 10);

    const html = agents.length > 0 ? agents.map((agent, index) => `
        <div class="agent-item">
            <div class="agent-info">
                <div class="agent-rank">${index + 1}</div>
                <div class="agent-name">${agent.agent}</div>
            </div>
            <div class="agent-stats">
                <div class="agent-rate">${agent.rate}%</div>
                <div class="agent-count">${agent.duplicates}/${agent.totalReviews} reviews</div>
            </div>
        </div>
    `).join('') : '<p style="text-align: center; color: #666;">No duplicates found! 🎉</p>';

    document.getElementById('topAgents').innerHTML = html;
}

function downloadExcel() {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [[
        'Filename',
        'Total Reviews',
        'Duplicate Records',
        'Duplicate %',
        'Unique Customers'
    ]];

    analysisResults.forEach(result => {
        summaryData.push([
            result.filename,
            result.statistics.totalRows,
            result.statistics.duplicateRows,
            result.statistics.duplicatePercent + '%',
            result.statistics.uniqueCustomers
        ]);
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Add each file's duplicates
    analysisResults.forEach((result, index) => {
        const dupData = [['Agent', 'Customer', 'Contact Method', 'Phone', 'Email', 'Date', 'Times Contacted', 'Detection Method', 'Excel Row']];
        
        result.duplicates.entries.forEach(dup => {
            dupData.push([
                dup.agent,
                dup.customer,
                dup.contactMethod,
                dup.phone,
                dup.email,
                dup.dateSent,
                dup.timesContacted,
                dup.detectionMethod,
                dup.excelRow
            ]);
        });

        const dupSheet = XLSX.utils.aoa_to_sheet(dupData);
        const sheetName = `Duplicates_${index + 1}`.substring(0, 31);
        XLSX.utils.book_append_sheet(wb, dupSheet, sheetName);
    });

    // Download
    XLSX.writeFile(wb, `Duplicate_Analysis_${getTimestamp()}.xlsx`);
}

function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.text('Duplicate Analysis Report', 20, y);
    y += 15;

    // Summary
    doc.setFontSize(12);
    const totalStats = analysisResults.reduce((acc, result) => {
        acc.totalRows += result.statistics.totalRows;
        acc.duplicateRows += result.statistics.duplicateRows;
        acc.uniqueCustomers += result.statistics.uniqueCustomers;
        return acc;
    }, { totalRows: 0, duplicateRows: 0, uniqueCustomers: 0 });

    const duplicatePercent = totalStats.totalRows > 0 
        ? (totalStats.duplicateRows / totalStats.totalRows * 100).toFixed(1)
        : 0;

    doc.text(`Total Reviews: ${totalStats.totalRows}`, 20, y);
    y += 8;
    doc.text(`Duplicate Records: ${totalStats.duplicateRows} (${duplicatePercent}%)`, 20, y);
    y += 8;
    doc.text(`Unique Customers Affected: ${totalStats.uniqueCustomers}`, 20, y);
    y += 8;
    doc.text(`Files Analyzed: ${analysisResults.length}`, 20, y);
    y += 15;

    // File breakdown
    doc.setFontSize(14);
    doc.text('File Breakdown:', 20, y);
    y += 10;

    doc.setFontSize(10);
    analysisResults.forEach(result => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        doc.text(`${result.filename}:`, 25, y);
        y += 6;
        doc.text(`  - Reviews: ${result.statistics.totalRows}`, 30, y);
        y += 6;
        doc.text(`  - Duplicates: ${result.statistics.duplicateRows} (${result.statistics.duplicatePercent}%)`, 30, y);
        y += 10;
    });

    doc.save(`Duplicate_Report_${getTimestamp()}.pdf`);
}

async function downloadAllFiles() {
    const zip = new JSZip();

    // Add Excel file
    const wb = XLSX.utils.book_new();
    // ... (same as downloadExcel logic)
    
    analysisResults.forEach((result, index) => {
        // Add individual analysis files to zip
        const wb = XLSX.utils.book_new();
        
        // Duplicates sheet
        const dupData = [['Agent', 'Customer', 'Contact Method', 'Phone', 'Email', 'Date', 'Times Contacted', 'Detection Method', 'Excel Row']];
        result.duplicates.entries.forEach(dup => {
            dupData.push([
                dup.agent, dup.customer, dup.contactMethod, dup.phone, dup.email,
                dup.dateSent, dup.timesContacted, dup.detectionMethod, dup.excelRow
            ]);
        });
        const dupSheet = XLSX.utils.aoa_to_sheet(dupData);
        XLSX.utils.book_append_sheet(wb, dupSheet, 'Flagged Duplicates');

        // Agent summary sheet
        const agentData = [['Agent', 'Total Reviews', '# of Duplicates', 'Duplicate Rate %']];
        result.agentSummary.forEach(agent => {
            agentData.push([
                agent.agent,
                agent.totalReviews,
                agent.duplicates || '',
                agent.duplicateRate || ''
            ]);
        });
        const agentSheet = XLSX.utils.aoa_to_sheet(agentData);
        XLSX.utils.book_append_sheet(wb, agentSheet, 'Agent Summary');

        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        zip.file(`${result.filename}_analysis.xlsx`, wbout);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `All_Analyses_${getTimestamp()}.zip`);
}

function saveAnalysis() {
    const analysis = {
        timestamp: new Date().toISOString(),
        files: analysisResults.map(r => r.filename),
        statistics: analysisResults.reduce((acc, result) => {
            acc.totalRows += result.statistics.totalRows;
            acc.duplicateRows += result.statistics.duplicateRows;
            acc.uniqueCustomers += result.statistics.uniqueCustomers;
            return acc;
        }, { totalRows: 0, duplicateRows: 0, uniqueCustomers: 0 }),
        results: analysisResults
    };

    const pastAnalyses = JSON.parse(localStorage.getItem('pastAnalyses') || '[]');
    pastAnalyses.unshift(analysis);
    
    // Keep only last 10 analyses
    localStorage.setItem('pastAnalyses', JSON.stringify(pastAnalyses.slice(0, 10)));
    
    loadPastAnalyses();
}

function loadPastAnalyses() {
    const pastAnalyses = JSON.parse(localStorage.getItem('pastAnalyses') || '[]');
    const container = document.getElementById('pastAnalyses');

    if (pastAnalyses.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No past analyses yet</p>';
        return;
    }

    container.innerHTML = pastAnalyses.map((analysis, index) => {
        const date = new Date(analysis.timestamp).toLocaleString();
        const dupPercent = analysis.statistics.totalRows > 0 
            ? (analysis.statistics.duplicateRows / analysis.statistics.totalRows * 100).toFixed(1)
            : 0;

        return `
            <div class="past-analysis-item">
                <div class="past-analysis-info">
                    <div class="past-analysis-date">${date}</div>
                    <div class="past-analysis-summary">
                        ${analysis.files.length} files | 
                        ${analysis.statistics.totalRows} reviews | 
                        ${analysis.statistics.duplicateRows} duplicates (${dupPercent}%)
                    </div>
                </div>
                <div class="past-analysis-actions">
                    <button class="btn" onclick="loadAnalysis(${index})">Load</button>
                    <button class="btn btn-secondary" onclick="deleteAnalysis(${index})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function loadAnalysis(index) {
    const pastAnalyses = JSON.parse(localStorage.getItem('pastAnalyses') || '[]');
    const analysis = pastAnalyses[index];
    
    analysisResults = analysis.results;
    displayResults();
    
    window.scrollTo({ top: document.getElementById('resultsSection').offsetTop, behavior: 'smooth' });
}

function deleteAnalysis(index) {
    if (confirm('Are you sure you want to delete this analysis?')) {
        const pastAnalyses = JSON.parse(localStorage.getItem('pastAnalyses') || '[]');
        pastAnalyses.splice(index, 1);
        localStorage.setItem('pastAnalyses', JSON.stringify(pastAnalyses));
        loadPastAnalyses();
    }
}

function saveSettings() {
    const settings = {
        fuzzyThreshold: document.getElementById('fuzzyThreshold').value,
        excludeText: document.getElementById('excludeText').value
    };
    localStorage.setItem('detectorSettings', JSON.stringify(settings));
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('detectorSettings') || '{}');
    
    if (settings.fuzzyThreshold) {
        document.getElementById('fuzzyThreshold').value = settings.fuzzyThreshold;
        document.getElementById('fuzzyValue').textContent = settings.fuzzyThreshold;
    }
    
    if (settings.excludeText) {
        document.getElementById('excludeText').value = settings.excludeText;
    }
}

function getTimestamp() {
    return new Date().toISOString().split('T')[0].replace(/-/g, '_');
}
