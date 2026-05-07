const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    reviewPeriod: {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true }
    },
    reviewType: {
        type: String,
        enum: ['Quarterly', 'Half-Yearly', 'Annual', 'Probation Review'],
        required: true
    },
    kpis: [{
        title: String,
        description: String,
        target: Number,
        achieved: Number,
        weightage: Number,
        score: Number
    }],
    ratings: {
        technical: { type: Number, min: 1, max: 5 },
        communication: { type: Number, min: 1, max: 5 },
        teamwork: { type: Number, min: 1, max: 5 },
        leadership: { type: Number, min: 1, max: 5 },
        punctuality: { type: Number, min: 1, max: 5 }
    },
    overallRating: {
        type: Number,
        min: 1,
        max: 5
    },
    strengths: {
        type: String
    },
    areasOfImprovement: {
        type: String
    },
    goals: [{
        title: String,
        description: String,
        targetDate: Date
    }],
    promotionEligible: {
        type: Boolean,
        default: false
    },
    bonusEligible: {
        type: Boolean,
        default: false
    },
    bonusPercentage: {
        type: Number,
        default: 0
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    comments: {
        type: String
    },
    employeeComments: {
        type: String
    },
    status: {
        type: String,
        enum: ['Draft', 'Submitted', 'Acknowledged'],
        default: 'Draft'
    }
}, {
    timestamps: true
});

// Calculate overall rating
performanceSchema.pre('save', function (next) {
    if (this.ratings) {
        const ratingValues = Object.values(this.ratings).filter(r => r);
        if (ratingValues.length > 0) {
            this.overallRating = Math.round(
                (ratingValues.reduce((sum, val) => sum + val, 0) / ratingValues.length) * 10
            ) / 10;
        }
    }
    next();
});

module.exports = mongoose.model('Performance', performanceSchema);
