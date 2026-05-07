/**
 * Email Provider Configuration
 * Auto-detects IMAP/SMTP settings based on email domain
 */

const emailProviders = {
    // Gmail
    'gmail.com': {
        name: 'Gmail',
        smtp: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false
        },
        imap: {
            host: 'imap.gmail.com',
            port: 993
        },
        requiresAppPassword: true,
        setupGuide: 'Use App Password from Google Account settings'
    },

    // Outlook/Hotmail
    'outlook.com': {
        name: 'Outlook',
        smtp: {
            host: 'smtp-mail.outlook.com',
            port: 587,
            secure: false
        },
        imap: {
            host: 'outlook.office365.com',
            port: 993
        }
    },
    'hotmail.com': {
        name: 'Hotmail',
        smtp: {
            host: 'smtp-mail.outlook.com',
            port: 587,
            secure: false
        },
        imap: {
            host: 'outlook.office365.com',
            port: 993
        }
    },

    // Yahoo
    'yahoo.com': {
        name: 'Yahoo',
        smtp: {
            host: 'smtp.mail.yahoo.com',
            port: 587,
            secure: false
        },
        imap: {
            host: 'imap.mail.yahoo.com',
            port: 993
        },
        requiresAppPassword: true,
        setupGuide: 'Generate App Password from Yahoo Account Security settings'
    },

    // Hostinger
    'by8labs.com': {
        name: 'Hostinger',
        smtp: {
            host: 'smtp.hostinger.com',
            port: 465,
            secure: true
        },
        imap: {
            host: 'imap.hostinger.com',
            port: 993
        }
    },

    // Generic Hostinger domains
    'hostinger.com': {
        name: 'Hostinger',
        smtp: {
            host: 'smtp.hostinger.com',
            port: 465,
            secure: true
        },
        imap: {
            host: 'imap.hostinger.com',
            port: 993
        }
    },

    // Zoho Mail
    'zoho.com': {
        name: 'Zoho',
        smtp: {
            host: 'smtp.zoho.com',
            port: 587,
            secure: false
        },
        imap: {
            host: 'imap.zoho.com',
            port: 993
        }
    }
};

/**
 * Get email provider configuration from email address
 * @param {string} email - User's email address
 * @returns {object|null} Provider configuration or null if not found
 */
const getProviderConfig = (email) => {
    if (!email || !email.includes('@')) {
        return null;
    }

    const domain = email.split('@')[1].toLowerCase();
    return emailProviders[domain] || null;
};

/**
 * Auto-configure email settings for a user
 * @param {string} email - User's email address
 * @param {string} password - User's email password (will be encrypted before storage)
 * @returns {object} Email configuration object ready for User.emailConfig
 */
const autoConfigureEmail = (email, password = null) => {
    const providerConfig = getProviderConfig(email);

    if (!providerConfig) {
        // Return generic configuration that works for most providers
        return {
            provider: 'Custom',
            email: email,
            password: password, // Will be encrypted by caller
            smtpHost: null,
            smtpPort: null,
            imapHost: null,
            imapPort: null,
            isConfigured: false, // Not configured until user provides password
            requiresSetup: true
        };
    }

    return {
        provider: providerConfig.name,
        email: email,
        password: password, // Will be encrypted by caller
        smtpHost: providerConfig.smtp.host,
        smtpPort: providerConfig.smtp.port,
        imapHost: providerConfig.imap.host,
        imapPort: providerConfig.imap.port,
        isConfigured: password ? true : false, // Only configured if password provided
        requiresAppPassword: providerConfig.requiresAppPassword || false,
        setupGuide: providerConfig.setupGuide || null
    };
};

/**
 * Check if email domain has known provider settings
 * @param {string} email - User's email address
 * @returns {boolean}
 */
const hasKnownProvider = (email) => {
    return getProviderConfig(email) !== null;
};

module.exports = {
    emailProviders,
    getProviderConfig,
    autoConfigureEmail,
    hasKnownProvider
};
