const otpEmailTemplate = (username, otp) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }
                .content {
                    background: #f9f9f9;
                    padding: 30px;
                    border-radius: 0 0 5px 5px;
                }
                .otp-box {
                    background: white;
                    padding: 20px;
                    margin: 20px 0;
                    text-align: center;
                    border-radius: 5px;
                    border: 2px dashed #1976d2;
                }
                .otp-code {
                    font-size: 32px;
                    font-weight: bold;
                    letter-spacing: 8px;
                    color: #1976d2;
                    margin: 10px 0;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Email Verification</h1>
                </div>
                <div class="content">
                    <h2>Hi ${username},</h2>
                    <p>Thank you for registering with BY8labs!</p>
                    <p>To complete your registration, please verify your email address using the code below:</p>
                    
                    <div class="otp-box">
                        <p style="margin: 0; font-size: 14px; color: #666;">Your Verification Code</p>
                        <div class="otp-code">${otp}</div>
                        <p style="margin: 0; font-size: 12px; color: #999;">This code will expire in 10 minutes</p>
                    </div>
                    
                    <p><strong>Important:</strong> If you didn't create an account with us, please ignore this email.</p>
                    
                    <div class="footer">
                        <p>This is an automated email. Please do not reply to this message.</p>
                        <p>&copy; ${new Date().getFullYear()} BY8labs. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};

const accessApprovedTemplate = (username) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); color: white; padding: 30px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                .success-icon { font-size: 48px; margin: 20px 0; }
                .button { display: inline-block; padding: 12px 30px; background: #4caf50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✓ Access Approved!</h1>
                </div>
                <div class="content">
                    <h2>Hi ${username},</h2>
                    <p>Great news! Your access request has been approved by HR.</p>
                    <p>You now have full access to BY8labs, including:</p>
                    <ul>
                        <li>Attendance Management</li>
                        <li>Leave Requests</li>
                        <li>Payroll Information</li>
                        <li>Internal Email Communication</li>
                        <li>And more...</li>
                    </ul>
                    <p>You can now log in and access all features.</p>
                    <p>Welcome to the team!</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

const accessRequestNotificationTemplate = (employeeName, employeeEmail, requestMessage) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 30px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                .details { background: white; padding: 15px; border-left: 4px solid #ff9800; margin: 20px 0; }
                .button { display: inline-block; padding: 12px 30px; background: #ff9800; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New Access Request</h1>
                </div>
                <div class="content">
                    <h2>Hello HR Team,</h2>
                    <p>A new employee has requested access to the HR System.</p>
                    
                    <div class="details">
                        <p><strong>Employee:</strong> ${employeeName}</p>
                        <p><strong>Email:</strong> ${employeeEmail}</p>
                        <p><strong>Message:</strong> ${requestMessage}</p>
                    </div>

                    <p>Please log in to the HR Portal to review and approve/reject this request.</p>
                    
                    <p>Thank you.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

const accessRejectedTemplate = (username, reason) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 30px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Access Request Update</h1>
                </div>
                <div class="content">
                    <h2>Hi ${username},</h2>
                    <p>Your request for access to BY8labs has been reviewed.</p>
                    <p><strong>Status: Rejected</strong></p>
                    <p><strong>Reason:</strong> ${reason}</p>
                    <p>If you believe this is a mistake, please contact the HR department directly.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

const newUserRegistrationAdminTemplate = (employeeName, employeeEmail) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); color: white; padding: 30px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                .details { background: white; padding: 15px; border-left: 4px solid #1976d2; margin: 20px 0; }
                .button { display: inline-block; padding: 12px 30px; background: #1976d2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New User Registration</h1>
                </div>
                <div class="content">
                    <h2>Hello HR Team,</h2>
                    <p>A new employee has registered and verified their email. Their account is now pending your approval.</p>
                    
                    <div class="details">
                        <p><strong>Employee:</strong> ${employeeName}</p>
                        <p><strong>Email:</strong> ${employeeEmail}</p>
                        <p><strong>Status:</strong> Pending Approval</p>
                    </div>

                    <p>Please log in to the HR Portal to review and approve/reject this registration.</p>
                    
                    <p>Thank you.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

const userAccountStatusTemplate = (username, status, reason = '') => {
    const isApproved = status === 'Approved';
    const bgColor = isApproved ? '#4caf50' : '#f44336';
    const title = isApproved ? 'Account Approved!' : 'Account Registration Update';
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, ${bgColor} 0%, ${bgColor}cc 100%); color: white; padding: 30px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                .button { display: inline-block; padding: 12px 30px; background: ${bgColor}; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${title}</h1>
                </div>
                <div class="content">
                    <h2>Hi ${username},</h2>
                    <p>Your account registration on BY8labs has been ${status.toLowerCase()}.</p>
                    
                    ${isApproved ? 
                        `<p>You can now log in to your account and access all features of the HR Portal.</p>
                         <p>Welcome to the team!</p>` :
                        `<p>Unfortunately, your account registration was not approved.</p>
                         <p><strong>Reason:</strong> ${reason || 'No reason provided'}</p>
                         <p>If you have any questions, please contact the HR department.</p>`
                    }
                </div>
            </div>
        </body>
        </html>
    `;
};

module.exports = {
    otpEmailTemplate,
    accessApprovedTemplate,
    accessRequestNotificationTemplate,
    accessRejectedTemplate,
    newUserRegistrationAdminTemplate,
    userAccountStatusTemplate
};
