const mongoose = require('mongoose');

const exitSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    resignationType: {
        type: String,
        enum: ['Voluntary', 'Termination', 'Retirement', 'End of Contract'],
        required: true
    },
    resignationDate: {
        type: Date,
        required: true
    },
    lastWorkingDate: {
        type: Date,
        required: true
    },
    noticePeriod: {
        type: Number, // in days
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    detailedReason: {
        type: String
    },
    exitInterview: {
        scheduled: { type: Boolean, default: false },
        date: Date,
        conductedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        feedback: String,
        willingnessToRehire: {
            type: String,
            enum: ['Yes', 'No', 'Maybe']
        }
    },
    clearance: {
        it: { cleared: { type: Boolean, default: false }, clearedBy: String, clearedDate: Date },
        finance: { cleared: { type: Boolean, default: false }, clearedBy: String, clearedDate: Date },
        hr: { cleared: { type: Boolean, default: false }, clearedBy: String, clearedDate: Date },
        admin: { cleared: { type: Boolean, default: false }, clearedBy: String, clearedDate: Date }
    },
    finalSettlement: {
        amount: Number,
        details: String,
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        processedDate: Date,
        paymentStatus: {
            type: String,
            enum: ['Pending', 'Processed', 'Paid'],
            default: 'Pending'
        }
    },
    experienceLetter: {
        generated: { type: Boolean, default: false },
        generatedDate: Date,
        filePath: String
    },
    relievingLetter: {
        generated: { type: Boolean, default: false },
        generatedDate: Date,
        filePath: String
    },
    status: {
        type: String,
        enum: ['Initiated', 'In Process', 'Completed'],
        default: 'Initiated'
    },
    remarks: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Exit', exitSchema);
