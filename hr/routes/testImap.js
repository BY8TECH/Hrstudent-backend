const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const imaps = require('imap-simple');

// Test IMAP connection
router.get('/test-imap', protect, async (req, res) => {
    const steps = [];

    try {
        // Step 1: Check environment variables
        steps.push({
            step: 1,
            name: 'Check Environment Variables',
            status: 'checking',
            details: {
                IMAP_HOST: process.env.IMAP_HOST,
                IMAP_PORT: process.env.IMAP_PORT,
                IMAP_USER: process.env.IMAP_USER,
                IMAP_PASSWORD: process.env.IMAP_PASSWORD ? '***SET***' : 'NOT SET'
            }
        });

        if (!process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
            steps[0].status = 'failed';
            steps[0].error = 'Missing IMAP credentials in environment variables';
            return res.status(400).json({ steps, message: 'Configuration incomplete' });
        }
        steps[0].status = 'success';

        // Step 2: Create IMAP config
        const imapConfig = {
            imap: {
                user: process.env.IMAP_USER,
                password: process.env.IMAP_PASSWORD,
                host: process.env.IMAP_HOST || 'imap.hostinger.com',
                port: parseInt(process.env.IMAP_PORT) || 993,
                tls: true,
                authTimeout: 10000,
                connTimeout: 10000
            }
        };

        steps.push({
            step: 2,
            name: 'IMAP Configuration',
            status: 'success',
            details: {
                host: imapConfig.imap.host,
                port: imapConfig.imap.port,
                user: imapConfig.imap.user,
                tls: imapConfig.imap.tls
            }
        });

        // Step 3: Attempt connection
        steps.push({
            step: 3,
            name: 'IMAP Connection',
            status: 'attempting',
            details: `Connecting to ${imapConfig.imap.host}:${imapConfig.imap.port}...`
        });

        console.log('[Test IMAP] Attempting connection...');
        const connection = await imaps.connect(imapConfig);

        steps[2].status = 'success';
        steps[2].details = 'Successfully connected to IMAP server';

        // Step 4: Open inbox
        steps.push({
            step: 4,
            name: 'Open INBOX',
            status: 'attempting',
            details: 'Opening INBOX mailbox...'
        });

        const box = await connection.openBox('INBOX');
        steps[3].status = 'success';
        steps[3].details = {
            totalMessages: box.messages.total,
            newMessages: box.messages.new,
            unseenMessages: box.messages.unseen
        };

        // Step 5: Close connection
        connection.end();
        steps.push({
            step: 5,
            name: 'Close Connection',
            status: 'success',
            details: 'Connection closed successfully'
        });

        res.json({
            success: true,
            message: 'All tests passed! Your IMAP connection is working.',
            steps
        });

    } catch (error) {
        console.error('[Test IMAP] Error:', error);

        // Update the last step with error
        if (steps.length > 0) {
            steps[steps.length - 1].status = 'failed';
            steps[steps.length - 1].error = error.message;
        }

        res.status(500).json({
            success: false,
            message: 'IMAP connection test failed',
            error: error.message,
            errorType: error.code || error.name,
            steps,
            troubleshooting: [
                'Verify your email credentials are correct',
                'Check if IMAP is enabled for your Hostinger email account',
                'Ensure your firewall/antivirus is not blocking port 993',
                'Try accessing webmail to confirm the account is active',
                'Check if your IP is blocked by the email provider'
            ]
        });
    }
});

module.exports = router;
