const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: [
            'Leave', 'Payroll', 'Attendance', 'Performance', 'Expense', 'Recruitment', 'Exit', 
            'General', 'Announcement', 'StudentRegistration', 'CertificateRequest', 'LeaveRequest',
            'SP_Registration', 'SP_CertificateRequest', 'SP_LeaveRequest', 
            'HR_Registration', 'HR_LeaveRequest', 'HR_Feedback', 'HR_AccessRequest', 'HR_Email',
            'Feedback', 'PendingUser', 'Email', 'AccessRequest'
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    actionUrl: {
        type: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
