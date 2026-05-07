const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobPosting',
        required: true
    },
    round: {
        type: String,
        enum: ['HR', 'Technical', 'Managerial', 'Final'],
        required: true
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    scheduledTime: String,
    duration: {
        type: Number,
        default: 60 // minutes
    },
    mode: {
        type: String,
        enum: ['In-person', 'Video Call', 'Phone'],
        default: 'Video Call'
    },
    meetingLink: String,
    interviewers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    assignedInterviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    viewedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    status: {
        type: String,
        enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'],
        default: 'Scheduled'
    },
    feedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        technicalSkills: {
            type: Number,
            min: 1,
            max: 5
        },
        communication: {
            type: Number,
            min: 1,
            max: 5
        },
        cultureFit: {
            type: Number,
            min: 1,
            max: 5
        },
        comments: String,
        recommendation: {
            type: String,
            enum: ['Selected', 'Rejected', 'Hold']
        },
        submittedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        submittedDate: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Interview', interviewSchema);
