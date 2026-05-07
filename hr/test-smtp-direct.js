const nodemailer = require('nodemailer');

const config = {
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
        user: 'hr@bylabs.com',
        pass: 'By8lab@hr'
    }
};

async function testSMTP() {
    try {
        console.log('Testing SMTP Connection...');
        const transporter = nodemailer.createTransport(config);
        await transporter.verify();
        console.log('SMTP Connection Successful! Credentials are correct.');
    } catch (error) {
        console.error('SMTP Connection Failed:', error);
    }
}

testSMTP();
