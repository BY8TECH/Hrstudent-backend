const { sendEmail: serviceSendEmail } = require('./emailService');

const sendEmail = async (options) => {
    try {
        // Adapt the old options format to the new emailService format
        // Old: { email, subject, html }
        // New: { to, subject, html }

        return await serviceSendEmail({
            to: options.email,
            subject: options.subject,
            html: options.html,
            text: options.text
        });
    } catch (error) {
        console.error('Error in legacy sendEmail wrapper:', error);
        throw error;
    }
};

module.exports = sendEmail;
