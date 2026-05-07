const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    expenseType: {
        type: String,
        enum: ['Travel', 'Food', 'Accommodation', 'Transportation', 'Communication', 'Supplies', 'Other'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    date: {
        type: Date,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    purpose: {
        type: String
    },
    receipts: [{
        fileName: String,
        filePath: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Paid'],
        default: 'Pending'
    },
    submittedDate: {
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
    paymentDate: {
        type: Date
    },
    paymentMode: {
        type: String,
        enum: ['Bank Transfer', 'Cheque', 'Cash']
    },
    paymentReference: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Expense', expenseSchema);
