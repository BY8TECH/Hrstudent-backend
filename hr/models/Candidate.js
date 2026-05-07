const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    candidateId: {
        type: String,
        unique: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobPosting',
        required: true
    },
    firstName: {
        type: String,
        required: [true, 'Please provide first name']
    },
    lastName: {
        type: String,
        required: [true, 'Please provide last name']
    },
    email: {
        type: String,
        required: [true, 'Please provide email'],
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Please provide phone number']
    },
    location: String,
    resume: {
        fileName: String,
        filePath: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedDate: {
            type: Date,
            default: Date.now
        }
    },
    coverLetter: String,
    experience: {
        type: Number,
        default: 0
    },
    currentCompany: String,
    currentSalary: Number,
    expectedSalary: Number,
    noticePeriod: String,
    skills: [String],
    source: {
        type: String,
        enum: ['Website', 'Job Portal', 'Referral', 'LinkedIn', 'Direct'],
        default: 'Direct'
    },
    referredBy: String,
    status: {
        type: String,
        enum: ['New', 'Screening', 'Interview', 'Evaluation', 'Offered', 'Rejected', 'Hired'],
        default: 'New'
    },
    appliedDate: {
        type: Date,
        default: Date.now
    },
    screening: {
        screenedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        shortlisted: Boolean,
        comments: String,
        date: Date
    }
}, {
    timestamps: true
});

// Auto-generate candidate ID
candidateSchema.pre('save', async function (next) {
    if (!this.candidateId) {
        const count = await mongoose.model('Candidate').countDocuments();
        this.candidateId = `CAN${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Candidate', candidateSchema);
