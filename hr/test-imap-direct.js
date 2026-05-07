const imaps = require('imap-simple');

const config = {
    imap: {
        user: 'hr@bylabs.com',
        password: 'By8lab@hr',
        host: 'imap.hostinger.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
    }
};

async function testConnection() {
    try {
        console.log('Connecting to IMAP...');
        const connection = await imaps.connect(config);
        console.log('Connected!');
        await connection.openBox('INBOX');
        console.log('Opened INBOX');

        const searchCriteria = ['ALL'];
        const fetchOptions = {
            bodies: ['HEADER'],
            markSeen: false
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`Found ${messages.length} emails.`);

        connection.end();
        console.log('Connection closed.');
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

testConnection();
