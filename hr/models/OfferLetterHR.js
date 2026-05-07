const mongoose = require('mongoose');

const offerLetterHRSchema = new mongoose.Schema({
    // Candidate Details
    candidateName: { type: String, required: true },
    candidateAddress: { type: String },
    candidateEmail: { type: String },
    candidatePhone: { type: String },

    // Company Details
    companyName: { type: String, required: true },
    companyAddress: { type: String, required: true },
    companyPhone: { type: String },
    companyEmail: { type: String },
    companyWebsite: { type: String },
    hrName: { type: String, required: true },
    companyLogo: { type: String },

    // Job Details
    jobRole: { type: String, required: true },
    department: { type: String, required: true },
    workLocation: { type: String },
    employmentType: { type: String, enum: ['Full-Time', 'Part-Time', 'Contract', 'Internship', ''], default: 'Full-Time' },

    // Dates
    offerDate: { type: Date, required: true },
    joiningDate: { type: Date, required: true },
    probationPeriod: { type: String },

    // Salary Details
    salary: { type: String, required: true },
    ctcBreakdown: { type: String },
    paymentCycle: { type: String, default: 'Monthly' },

    // Terms & Conditions
    workingHours: { type: String },
    leavePolicy: { type: String },
    noticePeriod: { type: String },
    companyRules: { type: String },

    // Letter Content
    offerConfirmationText: { type: String },
    acceptanceInstruction: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('OfferLetterHR', offerLetterHRSchema);
