// duplicate-detector.js - Core duplicate detection logic

class DuplicateDetector {
    constructor(options = {}) {
        this.fuzzyThreshold = options.fuzzyThreshold || 80;
        this.excludeTerms = options.excludeTerms || ['total'];
    }

    // Main analysis function
    analyzeFile(data, filename) {
        console.log(`Analyzing ${filename}...`);
        
        // Step 1: Identify columns
        const columns = this.identifyColumns(data);
        if (!columns.agent || !columns.customer) {
            throw new Error(`Could not identify required columns in ${filename}`);
        }

        // Step 2: Clean data (remove totals, forward fill)
        const cleanedData = this.cleanData(data, columns);

        // Step 3: Detect duplicates using all rules
        const duplicates = this.detectDuplicates(cleanedData, columns);

        // Step 4: Generate statistics
        const statistics = this.generateStatistics(cleanedData, duplicates);

        // Step 5: Create agent summary
        const agentSummary = this.createAgentSummary(cleanedData, duplicates, columns);

        return {
            filename,
            columns,
            cleanedData,
            duplicates,
            statistics,
            agentSummary
        };
    }

    // Identify column names
    identifyColumns(data) {
        if (data.length === 0) return {};

        const headers = Object.keys(data[0]);
        const columns = {};

        for (const header of headers) {
            const lower = header.toLowerCase();
            
            if ((lower.includes('user') && lower.includes('name')) || lower.includes('agent')) {
                columns.agent = header;
            }
            if (lower.includes('customer') && lower.includes('name')) {
                columns.customer = header;
            }
            if (lower.includes('phone')) {
                columns.phone = header;
            }
            if (lower.includes('email')) {
                columns.email = header;
            }
            if (lower.includes('day') || lower.includes('date')) {
                columns.date = header;
            }
        }

        return columns;
    }

    // Clean data
    cleanData(data, columns) {
        // Step 1: Remove rows with exclude terms
        let cleaned = data.filter(row => {
            const rowStr = JSON.stringify(row).toLowerCase();
            return !this.excludeTerms.some(term => rowStr.includes(term.toLowerCase()));
        });

        // Step 2: Forward fill agent and date
        let currentAgent = null;
        let currentDate = null;

        cleaned = cleaned.map((row, index) => {
            const newRow = { ...row, _rowIndex: index + 2 }; // Excel row (accounting for header)

            if (row[columns.agent]) {
                currentAgent = row[columns.agent];
            } else {
                newRow[columns.agent] = currentAgent;
            }

            if (row[columns.date]) {
                currentDate = row[columns.date];
            } else {
                newRow[columns.date] = currentDate;
            }

            return newRow;
        });

        return cleaned;
    }

    // Main duplicate detection
    detectDuplicates(data, columns) {
        const duplicates = [];
        const flaggedRows = new Set();

        // RULE 1: Both email and phone in same row
        const rule1 = this.detectBothContacts(data, columns);
        duplicates.push(...rule1.duplicates);
        rule1.rows.forEach(r => flaggedRows.add(r));

        // RULE 2 & 3: Same/similar customer names
        const rule2 = this.detectSimilarNames(data, columns);
        duplicates.push(...rule2.duplicates);
        rule2.rows.forEach(r => flaggedRows.add(r));

        // RULE 6: Orphan contacts
        const rule6 = this.detectOrphanContacts(data, columns);
        duplicates.push(...rule6.duplicates);
        rule6.rows.forEach(r => flaggedRows.add(r));

        return {
            entries: duplicates,
            flaggedRows: Array.from(flaggedRows)
        };
    }

    // RULE 1: Both email and phone filled
    detectBothContacts(data, columns) {
        const duplicates = [];
        const rows = [];

        data.forEach((row, index) => {
            const hasPhone = this.hasValue(row[columns.phone]);
            const hasEmail = this.hasValue(row[columns.email]);

            if (hasPhone && hasEmail) {
                duplicates.push({
                    agent: row[columns.agent],
                    customer: row[columns.customer] || '',
                    contactMethod: 'Email, Phone',
                    phone: row[columns.phone],
                    email: row[columns.email],
                    dateSent: row[columns.date],
                    timesContacted: 2,
                    detectionMethod: 'Both Email & Phone in same row',
                    excelRow: row._rowIndex
                });
                rows.push(index);
            }
        });

        return { duplicates, rows };
    }

    // RULE 2 & 3: Similar customer names
    detectSimilarNames(data, columns) {
        const duplicates = [];
        const rows = [];
        const checked = new Set();

        // Group by agent
        const agentGroups = {};
        data.forEach((row, index) => {
            const agent = row[columns.agent];
            if (!agentGroups[agent]) agentGroups[agent] = [];
            agentGroups[agent].push({ row, index });
        });

        // Check within each agent's customers
        for (const agent in agentGroups) {
            const customers = agentGroups[agent].filter(
                item => this.hasValue(item.row[columns.customer])
            );

            for (let i = 0; i < customers.length; i++) {
                for (let j = i + 1; j < customers.length; j++) {
                    const customer1 = this.cleanText(customers[i].row[columns.customer]);
                    const customer2 = this.cleanText(customers[j].row[columns.customer]);

                    const pairKey = `${customers[i].index}-${customers[j].index}`;
                    if (checked.has(pairKey)) continue;

                    const similarity = this.calculateSimilarity(customer1, customer2);

                    if (customer1 === customer2 || similarity >= this.fuzzyThreshold) {
                        const row1 = customers[i].row;
                        const row2 = customers[j].row;

                        const phones = [row1[columns.phone], row2[columns.phone]]
                            .filter(p => this.hasValue(p));
                        const emails = [row1[columns.email], row2[columns.email]]
                            .filter(e => this.hasValue(e));

                        const contactMethods = [];
                        if (emails.length > 0) contactMethods.push('Email');
                        if (phones.length > 0) contactMethods.push('Phone');

                        duplicates.push({
                            agent: row1[columns.agent],
                            customer: row1[columns.customer],
                            contactMethod: contactMethods.join(', ') || 'None',
                            phone: phones.join(' | '),
                            email: emails.join(' | '),
                            dateSent: row1[columns.date],
                            timesContacted: 2,
                            detectionMethod: customer1 === customer2 
                                ? 'Same customer name (exact match)'
                                : `Similar customer name (${similarity}% match)`,
                            excelRow: `${row1._rowIndex}, ${row2._rowIndex}`
                        });

                        rows.push(customers[i].index, customers[j].index);
                        checked.add(pairKey);
                    }
                }
            }
        }

        return { duplicates, rows };
    }

    // RULE 6: Orphan contacts
    detectOrphanContacts(data, columns) {
        const duplicates = [];
        const rows = [];
        const customerContacts = {};

        let currentCustomer = null;
        let currentAgent = null;

        data.forEach((row, index) => {
            const agent = row[columns.agent];
            const customer = this.hasValue(row[columns.customer]) ? row[columns.customer] : null;
            const hasPhone = this.hasValue(row[columns.phone]);
            const hasEmail = this.hasValue(row[columns.email]);

            if (customer) {
                // New customer found
                currentCustomer = customer;
                currentAgent = agent;

                const key = `${agent}::${customer}`;
                if (!customerContacts[key]) {
                    customerContacts[key] = {
                        agent,
                        customer,
                        phones: [],
                        emails: [],
                        rows: [],
                        indices: []
                    };
                }

                if (hasPhone) customerContacts[key].phones.push(row[columns.phone]);
                if (hasEmail) customerContacts[key].emails.push(row[columns.email]);
                customerContacts[key].rows.push(row._rowIndex);
                customerContacts[key].indices.push(index);

            } else if (!customer && currentCustomer && agent === currentAgent) {
                // Orphan row
                if (hasPhone || hasEmail) {
                    const key = `${currentAgent}::${currentCustomer}`;
                    
                    if (hasPhone) customerContacts[key].phones.push(row[columns.phone]);
                    if (hasEmail) customerContacts[key].emails.push(row[columns.email]);
                    customerContacts[key].rows.push(row._rowIndex);
                    customerContacts[key].indices.push(index);
                }
            }
        });

        // Find customers with multiple contacts
        for (const key in customerContacts) {
            const contact = customerContacts[key];
            
            if (contact.phones.length > 1 || contact.emails.length > 1) {
                const contactMethods = [];
                if (contact.emails.length > 0) contactMethods.push('Email');
                if (contact.phones.length > 0) contactMethods.push('Phone');

                duplicates.push({
                    agent: contact.agent,
                    customer: contact.customer,
                    contactMethod: contactMethods.join(', '),
                    phone: contact.phones.join(' | '),
                    email: contact.emails.join(' | '),
                    dateSent: data[contact.indices[0]][columns.date],
                    timesContacted: Math.max(contact.phones.length, contact.emails.length),
                    detectionMethod: 'Orphan contact pattern (customer with multiple contacts across rows)',
                    excelRow: contact.rows.join(', ')
                });

                rows.push(...contact.indices);
            }
        }

        return { duplicates, rows };
    }

    // Generate statistics
    generateStatistics(data, duplicates) {
        const totalRows = data.length;
        const duplicateRows = duplicates.flaggedRows.length;
        const uniqueCustomers = new Set(
            duplicates.entries
                .map(d => d.customer)
                .filter(c => c)
        ).size;

        return {
            totalRows,
            duplicateRows,
            duplicatePercent: totalRows > 0 ? (duplicateRows / totalRows * 100).toFixed(1) : 0,
            uniqueCustomers,
            totalDuplicateEntries: duplicates.entries.length
        };
    }

    // Create agent summary
    createAgentSummary(data, duplicates, columns) {
        const agentStats = {};

        // Count total reviews per agent
        data.forEach(row => {
            const agent = row[columns.agent];
            if (!this.hasValue(row[columns.customer])) return;

            if (!agentStats[agent]) {
                agentStats[agent] = {
                    agent,
                    totalReviews: 0,
                    duplicates: 0
                };
            }
            agentStats[agent].totalReviews++;
        });

        // Count duplicates per agent
        duplicates.entries.forEach(dup => {
            if (dup.customer && agentStats[dup.agent]) {
                agentStats[dup.agent].duplicates++;
            }
        });

        // Calculate rates
        const summary = Object.values(agentStats).map(stat => ({
            ...stat,
            duplicateRate: stat.totalReviews > 0 
                ? (stat.duplicates / stat.totalReviews * 100).toFixed(1)
                : 0
        }));

        return summary.sort((a, b) => b.totalReviews - a.totalReviews);
    }

    // Helper functions
    hasValue(val) {
        return val !== null && val !== undefined && val !== '';
    }

    cleanText(text) {
        if (!this.hasValue(text)) return '';
        return String(text).trim().toLowerCase();
    }

    calculateSimilarity(str1, str2) {
        // Levenshtein distance based similarity
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 100;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return ((longer.length - editDistance) / longer.length * 100);
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DuplicateDetector;
}
