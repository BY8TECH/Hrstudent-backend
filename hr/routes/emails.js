const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendBulkEmail, getTestAccountInfo, sendEmail } = require('../utils/emailService');
const { decrypt } = require('../utils/encryption');

// Apply authentication to all routes
router.use(protect);

// Helper: Get user email config
const getUserConfig = async (req) => {
    const userId = req.user._id;
    const headerPassword = req.headers['x-hostinger-password'];

    const user = await User.findById(userId).select('+emailConfig.password');
    
    // If no config at all, return null (fallback to env)
    if (!user.emailConfig || !user.emailConfig.isConfigured) {
        // Still check if we have a header password for 'manual' use with default host/port
        if (headerPassword) {
            return {
                email: user.email,
                password: headerPassword,
                smtpHost: 'smtp.hostinger.com',
                smtpPort: 465,
                imapHost: 'imap.hostinger.com',
                imapPort: 993
            };
        }
        return null; 
    }

    const config = user.emailConfig;
    // Use header password if provided (for session-based), otherwise use decrypted DB password
    const passwordToUse = headerPassword || decrypt(config.password);

    return {
        email: config.email,
        password: passwordToUse,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        imapHost: config.imapHost,
        imapPort: config.imapPort
    };
};

// Get all users for recipient selection
router.get('/recipients/list', async (req, res) => {
    try {
        let query = {
            _id: { $ne: req.user._id }, // Exclude current user
            isActive: true
        };

        // If employee, only show HR users
        if (req.user.role === 'Employee') {
            query.role = 'HR';
        }

        const users = await User.find(query, 'username email role')
            .sort({ username: 1 });

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Send email
router.post('/', async (req, res) => {
    try {
        const { recipients, cc, bcc, subject, body, sentToAll } = req.body;

        // Validation
        if (!subject || !body) {
            return res.status(400).json({ message: 'Subject and body are required' });
        }

        let recipientIds = recipients || [];

        // Handle manual email entries (convert email strings to user IDs)
        if (recipientIds.length > 0 && typeof recipientIds[0] === 'string' && recipientIds[0].includes('@')) {
            const emailAddresses = recipientIds;
            const users = await User.find({ email: { $in: emailAddresses }, isActive: true }, '_id email role');

            if (users.length === 0) {
                return res.status(404).json({ message: 'No users found with provided email addresses' });
            }

            recipientIds = users.map(u => u._id);

            // For employees, validate these are HR users
            if (req.user.role === 'Employee') {
                const nonHRUsers = users.filter(u => u.role !== 'HR');
                if (nonHRUsers.length > 0) {
                    return res.status(403).json({
                        message: 'Employees can only send emails to HR users'
                    });
                }
            }
        }

        // Employee restriction for ID-based recipients
        if (req.user.role === 'Employee' && !sentToAll) {
            // Validate all recipients are HR (only if not already validated above)
            if (recipients && recipients.length > 0 && !(typeof recipients[0] === 'string' && recipients[0].includes('@'))) {
                const recipientUsers = await User.find({ _id: { $in: recipientIds } });
                const nonHRRecipients = recipientUsers.filter(u => u.role !== 'HR');

                if (nonHRRecipients.length > 0) {
                    return res.status(403).json({
                        message: 'Employees can only send emails to HR users'
                    });
                }
            }
        }

        // If sending to all employees (HR only)
        if (sentToAll) {
            if (req.user.role !== 'HR') {
                return res.status(403).json({ message: 'Only HR can send emails to all employees' });
            }

            const allUsers = await User.find(
                {
                    _id: { $ne: req.user._id },
                    isActive: true
                },
                '_id'
            );
            recipientIds = allUsers.map(user => user._id);
        }

        // Ensure at least one recipient
        if (!recipientIds || recipientIds.length === 0) {
            return res.status(400).json({ message: 'At least one recipient is required' });
        }

        const email = new Email({
            sender: req.user._id,
            recipients: recipientIds,
            cc: cc || [],
            bcc: bcc || [],
            subject,
            body,
            sentToAll: sentToAll || false
        });

        await email.save();

        // Send actual SMTP emails to all recipients
        try {
            const recipientUsers = await User.find({ _id: { $in: recipientIds } }, 'email username');
            const userConfig = await getUserConfig(req);

            const emailResults = await sendBulkEmail(
                recipientUsers,
                subject,
                body,
                userConfig // Pass config
            );

            console.log('📧 Email sending results:', emailResults);

            // Get test account info if available
            const testInfo = getTestAccountInfo();

            res.status(201).json({
                message: 'Email sent successfully',
                email,
                emailResults,
                testAccountInfo: testInfo
            });
        } catch (emailError) {
            console.error('❌ Error sending SMTP emails:', emailError);
            // Email saved to database but SMTP failed
            res.status(201).json({
                message: 'Email saved but SMTP delivery failed',
                email,
                error: emailError.message
            });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get inbox (received emails)
router.get('/inbox', async (req, res) => {
    try {
        const emails = await Email.find({
            $or: [
                { recipients: req.user._id },
                { cc: req.user._id },
                { bcc: req.user._id }
            ],
            deletedBy: { $ne: req.user._id }
        })
            .populate('sender', 'username email')
            .populate('recipients', 'username email')
            .sort({ createdAt: -1 });

        // Calculate unread count
        const unreadCount = emails.filter(email =>
            !email.readBy.some(read => read.userId.toString() === req.user._id.toString())
        ).length;

        res.json({
            emails,
            unreadCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get sent emails
router.get('/sent', async (req, res) => {
    try {
        const emails = await Email.find({
            sender: req.user._id,
            deletedBy: { $ne: req.user._id }
        })
            .populate('recipients', 'username email')
            .populate('cc', 'username email')
            .sort({ createdAt: -1 });

        res.json(emails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single email
router.get('/:id', async (req, res) => {
    try {
        const email = await Email.findById(req.params.id)
            .populate('sender', 'username email')
            .populate('recipients', 'username email')
            .populate('cc', 'username email');

        if (!email) {
            return res.status(404).json({ message: 'Email not found' });
        }

        // Check if user has access to this email
        const hasAccess =
            email.sender._id.toString() === req.user._id.toString() ||
            email.recipients.some(r => r._id.toString() === req.user._id.toString()) ||
            email.cc.some(c => c._id.toString() === req.user._id.toString()) ||
            email.bcc.some(b => b.toString() === req.user._id.toString());

        if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(email);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mark email as read
router.put('/:id/read', async (req, res) => {
    try {
        const email = await Email.findById(req.params.id);

        if (!email) {
            return res.status(404).json({ message: 'Email not found' });
        }

        // Check if user is a recipient
        const isRecipient =
            email.recipients.some(r => r.toString() === req.user._id.toString()) ||
            email.cc.some(c => c.toString() === req.user._id.toString()) ||
            email.bcc.some(b => b.toString() === req.user._id.toString());

        if (!isRecipient) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Check if already marked as read
        const alreadyRead = email.readBy.some(
            read => read.userId.toString() === req.user._id.toString()
        );

        if (!alreadyRead) {
            email.readBy.push({
                userId: req.user._id,
                readAt: new Date()
            });
            await email.save();
        }

        res.json({ message: 'Email marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Soft delete email
router.delete('/:id', async (req, res) => {
    try {
        const email = await Email.findById(req.params.id);

        if (!email) {
            return res.status(404).json({ message: 'Email not found' });
        }

        // Add user to deletedBy array
        if (!email.deletedBy.includes(req.user._id)) {
            email.deletedBy.push(req.user._id);
            await email.save();
        }

        res.json({ message: 'Email deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// EXTENSION: Hostinger IMAP Routes
const { getInboxEmails, getEmailContent } = require('../utils/imapService');

// Get external inbox (Hostinger)
router.get('/external/inbox', async (req, res) => {
    try {
        console.log('[External Inbox] Fetching external inbox...');
        const userConfig = await getUserConfig(req);

        // If no user config, only allow HR to use environment variables fallback
        let configToUse = userConfig;
        let configSource = 'user settings';

        if (!userConfig) {
            if (req.user.role !== 'HR') {
                return res.status(400).json({
                    message: 'Email not configured. Please configure your individual email settings to view your messages.',
                    hint: 'Click the Settings button to configure your account'
                });
            }

            console.log('[External Inbox] No user email config found, using environment variables');
            configSource = 'environment variables';
            configToUse = {
                email: process.env.IMAP_USER,
                password: process.env.IMAP_PASSWORD,
                imapHost: process.env.IMAP_HOST,
                imapPort: process.env.IMAP_PORT
            };

            // Verify .env has the required values
            if (!configToUse.email || !configToUse.password) {
                return res.status(400).json({
                    message: 'System email not configured. Please contact administrator.',
                });
            }
        }

        console.log(`[External Inbox] Using config from ${configSource}: ${configToUse.email}@${configToUse.imapHost}:${configToUse.imapPort}`);

        // Only search for user's email if we are using the fallback (shared) config
        // If it's a private user config, show ALL emails in that inbox
        const searchEmail = userConfig ? null : req.user.email.toLowerCase();

        // Limit to 20 emails for performance
        const emails = await getInboxEmails(configToUse, 20, searchEmail);

        console.log(`[External Inbox] Fetched ${emails.length} emails for user ${req.user.email}`);
        
        res.json(emails);
    } catch (error) {
        console.error('[External Inbox] Error:', error.message);
        res.status(500).json({
            message: error.message || 'Failed to fetch external emails',
            hint: 'Check your email configuration, credentials, and internet connection'
        });
    }
});

// Get external email content
router.get('/external/message/:uid', async (req, res) => {
    try {
        const uid = req.params.uid;
        const userConfig = await getUserConfig(req);

        if (!userConfig) {
            return res.status(400).json({
                message: 'Email not configured.'
            });
        }

        const email = await getEmailContent(userConfig, uid);

        if (!email) {
            return res.status(404).json({ message: 'Email not found' });
        }

        res.json(email);
    } catch (error) {
        console.error('Error fetching external email content:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
