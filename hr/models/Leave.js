const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    subject: {
        type: String,
        required: [true, 'Please provide leave subject']
    },
    leaveType: {
        type: String,
        enum: ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave'],
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    numberOfDays: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending'
    },
    appliedDate: {
        type: Date,
        default: Date.now
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedDate: {
        type: Date
    },
    reviewComments: {
        type: String
    },
    attachments: [{
        fileName: String,
        filePath: String,
        uploadedAt: Date
    }]
}, {
    timestamps: true
});

// Leave balance tracking schema
const leaveBalanceSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        unique: true
    },
    year: {
        type: Number,
        required: true
    },
    casualLeave: {
        total: { type: Number, default: 12 },
        used: { type: Number, default: 0 },
        balance: { type: Number, default: 12 }
    },
    sickLeave: {
        total: { type: Number, default: 12 },
        used: { type: Number, default: 0 },
        balance: { type: Number, default: 12 }
    },
    earnedLeave: {
        total: { type: Number, default: 15 },
        used: { type: Number, default: 0 },
        balance: { type: Number, default: 15 }
    }
}, {
    timestamps: true
});

const Leave = mongoose.model('Leave', leaveSchema);
const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);

module.exports = { Leave, LeaveBalance };
