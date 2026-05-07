const mongoose = require('mongoose');

const accessRequestSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requestType: {
        type: String,
        default: 'Data Access',
        enum: ['Data Access']
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    requestMessage: {
        type: String,
        default: 'Requesting access to view my attendance and submit leave requests'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedDate: {
        type: Date
    },
    rejectionReason: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('AccessRequest', accessRequestSchema);
