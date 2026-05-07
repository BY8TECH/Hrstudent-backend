const imaps = require('imap-simple');
const simpleParser = require('mailparser').simpleParser;

// Timeout wrapper for IMAP operations
const withTimeout = (promise, timeoutMs, operation) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

const getInboxEmails = async (userConfig, limit = 20, searchEmail = null) => {
    let connection = null;
    try {
        // Use user config if provided, otherwise fallback to env (legacy support)
        const imapConfig = {
            imap: {
                user: userConfig?.email || process.env.IMAP_USER,
                password: userConfig?.password || process.env.IMAP_PASSWORD,
                host: userConfig?.imapHost || process.env.IMAP_HOST || 'imap.hostinger.com',
                port: userConfig?.imapPort || process.env.IMAP_PORT || 993,
                tls: true,
                authTimeout: 15000,
                connTimeout: 15000
            }
        };

        console.log(`[IMAP] Connecting to ${imapConfig.imap.user}@${imapConfig.imap.host}:${imapConfig.imap.port}...`);

        // Add timeout for connection (20 seconds)
        connection = await withTimeout(
            imaps.connect(imapConfig),
            20000,
            'IMAP connection'
        );

        console.log('[IMAP] Connected successfully. Opening INBOX...');

        // Add timeout for opening mailbox (10 seconds)
        const boxInfo = await withTimeout(
            connection.openBox('INBOX'),
            10000,
            'INBOX open'
        );

        console.log('[IMAP] INBOX opened. Fetching emails...');

        // Determine search criteria
        let searchCriteria = ['ALL'];
        let useJsFiltering = false;

        if (searchEmail) {
            console.log(`[IMAP] Searching for: ${searchEmail}`);
            // Robust search criteria for most IMAP servers
            searchCriteria = [['OR', ['TO', searchEmail], ['OR', ['CC', searchEmail], ['BCC', searchEmail]]]];
            useJsFiltering = true; // Still filter in JS for safety/formatting
        } else {
            const totalMessages = boxInfo.messages.total;
            const fetchCount = 100; // Increase window to 100 for better recent coverage
            const startSeq = Math.max(1, totalMessages - (fetchCount - 1));
            const endSeq = totalMessages;
            searchCriteria = [`${startSeq}:${endSeq}`];
            console.log(`[IMAP] Fetching most recent ${fetchCount} messages (sequence ${startSeq}:${endSeq})...`);
        }

        const fetchOptions = {
            bodies: ['HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE)'], // Include CC and BCC in headers
            markSeen: false,
            struct: true
        };

        // Add timeout for search operation (30 seconds)
        let messages = await withTimeout(
            connection.search(searchCriteria, fetchOptions),
            30000,
            'Email search'
        );

        // Fallback: If searchEmail provided but 0 results found, try fetching last 100 and filtering in JS
        if (searchEmail && messages.length === 0) {
            console.log(`[IMAP] No results matching search. Falling back to fetching last 100 and filtering in JS...`);
            const totalMessages = boxInfo.messages.total;
            const startSeq = Math.max(1, totalMessages - 99);
            const endSeq = totalMessages;
            const fallbackCriteria = [`${startSeq}:${endSeq}`];
            
            messages = await withTimeout(
                connection.search(fallbackCriteria, fetchOptions),
                30000,
                'Email fallback fetch'
            );
            useJsFiltering = true;
        }

        console.log(`[IMAP] Found ${messages.length} potential messages. Processing...`);

        const lowerSearchEmail = searchEmail ? searchEmail.toLowerCase() : null;

        const parsedEmails = messages.map((message) => {
            const id = message.attributes.uid;
            const seen = message.attributes.flags.includes('\\Seen');

            // Parse header fields
            const headerPart = message.parts.find(part => part.which === 'HEADER.FIELDS (FROM TO CC BCC SUBJECT DATE)');
            const headers = headerPart ? headerPart.body : {};

            // Extract basic info from headers
            const subject = headers.subject ? headers.subject[0] : '(No Subject)';
            const from = headers.from ? headers.from[0] : 'Unknown';
            const to = headers.to ? headers.to[0] : 'Unknown';
            const cc = headers.cc ? headers.cc[0] : '';
            const bcc = headers.bcc ? headers.bcc[0] : '';
            const date = headers.date ? new Date(headers.date[0]) : message.attributes.date || new Date();

            return {
                id: id,
                subject: subject,
                from: from,
                to: to,
                cc: cc,
                bcc: bcc,
                date: date,
                preview: `${subject.substring(0, 50)}...`,
                seen: seen
            };
        });

        // Filter and Sort
        let finalEmails = parsedEmails;

        if (useJsFiltering && lowerSearchEmail) {
            finalEmails = parsedEmails.filter(email => {
                const searchIn = `${email.to} ${email.cc} ${email.bcc}`.toLowerCase();
                return searchIn.includes(lowerSearchEmail);
            });
            console.log(`[IMAP] JS filtering reduced ${parsedEmails.length} to ${finalEmails.length} messages for ${lowerSearchEmail}`);
        }

        // Always sort by date descending
        finalEmails.sort((a, b) => new Date(b.date) - new Date(a.date));

        const result = finalEmails.slice(0, limit);
        console.log(`[IMAP] Successfully returned ${result.length} emails. Closing connection...`);
        connection.end();
        return result;
    } catch (error) {
        console.error('[IMAP] Error:', error.message);
        console.error('[IMAP] Error details:', error);

        // Ensure connection is closed
        if (connection) {
            try {
                connection.end();
            } catch (closeError) {
                console.error('[IMAP] Error closing connection:', closeError);
            }
        }

        // Provide more helpful error messages
        if (error.message.includes('timed out')) {
            throw new Error(`IMAP operation timed out: ${error.message}. Check your internet connection and IMAP server status.`);
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            throw new Error('Cannot connect to IMAP server. Please check your host and port settings.');
        } else if (error.message.includes('Invalid credentials') || error.message.includes('AUTHENTICATIONFAILED')) {
            throw new Error('Invalid email credentials. Please check your email and password.');
        } else {
            throw error;
        }
    }
};

const getEmailContent = async (userConfig, uid) => {
    let connection = null;
    try {
        const imapConfig = {
            imap: {
                user: userConfig?.email || process.env.IMAP_USER,
                password: userConfig?.password || process.env.IMAP_PASSWORD,
                host: userConfig?.imapHost || process.env.IMAP_HOST || 'imap.hostinger.com',
                port: userConfig?.imapPort || process.env.IMAP_PORT || 993,
                tls: true,
                authTimeout: 15000,
                connTimeout: 15000
            }
        };

        console.log(`[IMAP] Fetching email UID ${uid}...`);

        connection = await withTimeout(
            imaps.connect(imapConfig),
            20000,
            'IMAP connection'
        );

        await withTimeout(
            connection.openBox('INBOX'),
            10000,
            'INBOX open'
        );

        const searchCriteria = [['UID', uid]];
        const fetchOptions = {
            bodies: [''],
            markSeen: true // Mark as read when opened
        };

        const messages = await withTimeout(
            connection.search(searchCriteria, fetchOptions),
            20000,
            'Email fetch'
        );

        if (!messages.length) {
            connection.end();
            return null;
        }

        const message = messages[0];
        const all = message.parts.find(part => part.which === '');
        const parsed = await simpleParser(all.body);

        console.log(`[IMAP] Email UID ${uid} fetched successfully.`);
        connection.end();

        return {
            id: uid,
            subject: parsed.subject,
            from: parsed.from.text,
            to: parsed.to.text,
            cc: parsed.cc ? parsed.cc.text : '',
            date: parsed.date,
            html: parsed.html || parsed.textAsHtml || parsed.text,
            text: parsed.text,
            attachments: parsed.attachments
        };
    } catch (error) {
        console.error('[IMAP] Error fetching email:', error.message);

        // Ensure connection is closed
        if (connection) {
            try {
                connection.end();
            } catch (closeError) {
                console.error('[IMAP] Error closing connection:', closeError);
            }
        }

        // Provide more helpful error messages
        if (error.message.includes('timed out')) {
            throw new Error(`IMAP operation timed out: ${error.message}`);
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            throw new Error('Cannot connect to IMAP server. Please check your settings.');
        } else if (error.message.includes('Invalid credentials') || error.message.includes('AUTHENTICATIONFAILED')) {
            throw new Error('Invalid email credentials.');
        } else {
            throw error;
        }
    }
};

module.exports = {
    getInboxEmails,
    getEmailContent
};
