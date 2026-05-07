const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');

// Apply authentication
router.use(protect);

// Get current configuration
router.get('/', async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        let config = {
            isConfigured: user.emailConfig?.isConfigured || false,
            provider: user.emailConfig?.provider || 'Custom',
            email: user.email,
            smtpHost: user.emailConfig?.smtpHost || null,
            smtpPort: user.emailConfig?.smtpPort || null,
            imapHost: user.emailConfig?.imapHost || null,
            imapPort: user.emailConfig?.imapPort || null,
            requiresAppPassword: user.emailConfig?.requiresAppPassword || false,
            setupGuide: user.emailConfig?.setupGuide || null
        };

        res.json(config);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Save configuration
router.put('/', async (req, res) => {
    try {
        const { provider, email, password, smtpHost, smtpPort, imapHost, imapPort } = req.body;

        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const encryptedPassword = encrypt(password);

        const user = await User.findById(req.user._id);

        user.emailConfig = {
            provider,
            email,
            password: encryptedPassword,
            smtpHost,
            smtpPort,
            imapHost,
            imapPort,
            isConfigured: true
        };

        await user.save();

        res.json({
            message: 'Email configuration saved successfully',
            autoConfigured: user.emailConfig.provider !== 'Custom'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Test connection
router.post('/test', async (req, res) => {
    try {
        const { email, password, smtpHost, smtpPort, imapHost, imapPort } = req.body;

        // Test SMTP
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort == 465, // SSL/TLS for 465
            auth: {
                user: email,
                pass: password
            }
        });

        await transporter.verify();

        // Test IMAP
        const imapConfig = {
            imap: {
                user: email,
                password: password,
                host: imapHost,
                port: imapPort,
                tls: true,
                authTimeout: 5000
            }
        };

        const connection = await imaps.connect(imapConfig);
        await connection.end();

        res.json({ message: 'Connection successful!' });
    } catch (error) {
        console.error('Test connection error:', error);
        res.status(400).json({
            message: 'Connection failed',
            error: error.message
        });
    }
});

module.exports = router;
