const nodemailer = require('nodemailer');

let transporter = null;
let testAccount = null;

// Initialize email transporter (Static/Legacy)
const initializeTransporter = async () => {
    if (transporter) return transporter;
    // Note: This logic remains for fallback/system emails
    // For user emails, we create a temporary transporter

    try {
        // Check if we have real SMTP credentials
        const hasRealCredentials =
            process.env.SMTP_USER &&
            process.env.SMTP_PASS &&
            process.env.SMTP_USER !== 'your-email@gmail.com' &&
            process.env.SMTP_PASS !== 'your-app-password';

        if (hasRealCredentials) {
            // Use real SMTP credentials
            console.log('📧 Using configured SMTP credentials');

            // Special handling for Hostinger (Port 465 requires secure: true)
            if (process.env.SMTP_PORT == 465) {
                transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
                    port: 465,
                    secure: true, // true for 465, false for other ports
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
            } else {
                transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    secure: false, // true for 465, false for other ports
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
            }
        } else {
            // Generate Ethereal test account for development
            console.log('📧 No SMTP credentials found. Creating Ethereal test account...');
            testAccount = await nodemailer.createTestAccount();

            console.log('✅ Ethereal Email Account Created:');
            console.log('   Email:', testAccount.user);
            console.log('   Password:', testAccount.pass);
            console.log('   Preview URL: https://ethereal.email');
            console.log('');

            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
        }

        // Verify connection
        await transporter.verify();
        console.log('✅ Email transporter ready');

        return transporter;
    } catch (error) {
        console.error('❌ Error initializing email transporter:', error.message);
        throw error;
    }
};

// Create dynamic transporter for user config
const createDynamicTransporter = async (config) => {
    const transportConfig = {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: {
            user: config.email,
            pass: config.password
        }
    };
    return nodemailer.createTransport(transportConfig);
};

// Send email function
const sendEmail = async (options, userConfig = null) => {
    try {
        let mailTransporter;
        let senderEmail;
        let senderName;

        if (userConfig) {
            mailTransporter = await createDynamicTransporter(userConfig);
            senderEmail = userConfig.email;
            senderName = 'BY8labs'; // Or user's name if passed
        } else {
            // Fallback to system transporter
            await initializeTransporter();
            mailTransporter = transporter;
            senderEmail = process.env.FROM_EMAIL || testAccount?.user || 'noreply@hrms.com';
            senderName = process.env.FROM_NAME || 'BY8labs';
        }

        const mailOptions = {
            from: `${senderName} <${senderEmail}>`,
            to: options.to,
            subject: options.subject,
            html: options.html || options.body,
            text: options.text
        };

        const info = await mailTransporter.sendMail(mailOptions);

        // If using Ethereal, log the preview URL
        if (testAccount) {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('📧 Email sent! Preview URL:', previewUrl);
            return { ...info, previewUrl };
        }

        console.log('📧 Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Error sending email:', error.message);
        throw error;
    }
};

// Send email to multiple recipients
const sendBulkEmail = async (recipients, subject, body, userConfig = null) => {
    const results = [];

    for (const recipient of recipients) {
        try {
            const result = await sendEmail({
                to: recipient.email,
                subject,
                html: body
            }, userConfig);
            results.push({
                email: recipient.email,
                success: true,
                messageId: result.messageId,
                previewUrl: result.previewUrl
            });
        } catch (error) {
            results.push({
                email: recipient.email,
                success: false,
                error: error.message
            });
        }
    }

    return results;
};

// Get test account info (for debugging)
const getTestAccountInfo = () => {
    if (testAccount) {
        return {
            user: testAccount.user,
            pass: testAccount.pass,
            web: 'https://ethereal.email',
            message: 'Login to Ethereal Email to view sent emails'
        };
    }
    return null;
};

module.exports = {
    sendEmail,
    sendBulkEmail,
    initializeTransporter,
    getTestAccountInfo
};
