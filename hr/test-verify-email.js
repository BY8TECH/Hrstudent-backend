require('dotenv').config();
const sendEmail = require('./utils/sendEmail');
const { otpEmailTemplate } = require('./utils/emailTemplates');

const testVerificationEmail = async () => {
    try {
        console.log('Sending test verification email...');

        const username = 'TestUser';
        const otp = '123456';

        await sendEmail({
            email: process.env.SMTP_USER || 'nithyabalu2209@gmail.com', // Send to self
            subject: 'Test Verification Email',
            html: otpEmailTemplate(username, otp)
        });

        console.log('✅ Test verification email sent successfully!');
    } catch (error) {
        console.error('❌ Failed to send verification email:', error);
    }
};

testVerificationEmail();
