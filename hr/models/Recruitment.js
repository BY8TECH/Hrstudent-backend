const mongoose = require('mongoose');

const recruitmentSchema = new mongoose.Schema({
    jobTitle: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    positions: {
        type: Number,
        required: true,
        min: 1
    },
    description: {
        type: String,
        required: true
    },
    requirements: [{
        type: String
    }],
    skills: [{
        type: String
    }],
    experience: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 10 }
    },
    salaryRange: {
        min: Number,
        max: Number
    },
    location: {
        type: String
    },
    employmentType: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
        default: 'Full-time'
    },
    status: {
        type: String,
        enum: ['Open', 'Closed', 'On Hold'],
        default: 'Open'
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    postedDate: {
        type: Date,
        default: Date.now
    },
    closingDate: {
        type: Date
    }
}, {
    timestamps: true
});

// Candidate schema
const candidateSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recruitment',
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    resume: {
        fileName: String,
        filePath: String
    },
    coverLetter: {
        type: String
    },
    experience: {
        type: Number
    },
    currentCompany: {
        type: String
    },
    currentSalary: {
        type: Number
    },
    expectedSalary: {
        type: Number
    },
    noticePeriod: {
        type: String
    },
    applicationStatus: {
        type: String,
        enum: ['Applied', 'Screening', 'Shortlisted', 'Interview Scheduled', 'Interview Complete', 'Selected', 'Rejected', 'Offer Extended', 'Joined'],
        default: 'Applied'
    },
    interviews: [{
        round: String,
        scheduledDate: Date,
        interviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        feedback: String,
        rating: { type: Number, min: 1, max: 5 },
        status: {
            type: String,
            enum: ['Scheduled', 'Completed', 'Cancelled']
        }
    }],
    notes: [{
        note: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    appliedDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const Recruitment = mongoose.model('Recruitment', recruitmentSchema);
const Candidate = mongoose.model('Candidate', candidateSchema);

module.exports = { Recruitment, Candidate };
