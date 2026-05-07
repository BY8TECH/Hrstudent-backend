const mongoose = require('mongoose');

// Comment sub-schema
const commentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Reaction sub-schema
const reactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['like', 'love', 'celebrate', 'support'],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Main Feedback schema
const feedbackSchema = new mongoose.Schema({
    // Basic Information
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },

    // Media Attachments
    images: [{
        type: String  // URLs to uploaded images
    }],
    videos: [{
        type: String  // URLs to uploaded videos
    }],

    // Categorization
    category: {
        type: String,
        enum: ['General', 'HR Policy', 'Work Environment', 'Salary', 'Benefits', 'Culture', 'Other'],
        default: 'General'
    },
    tags: [{
        type: String
    }],

    // Social Engagement Features
    reactions: [reactionSchema],
    comments: [commentSchema],

    // Engagement Metrics
    viewCount: {
        type: Number,
        default: 0
    },

    // Status Management (HR)
    status: {
        type: String,
        enum: ['Open', 'Under Review', 'Resolved', 'Closed'],
        default: 'Open'
    },

    // Official HR Response
    officialResponse: {
        text: String,
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        respondedAt: Date
    }
}, {
    timestamps: true
});

// Indexes for better query performance
feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ category: 1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ submittedBy: 1 });

// Virtual for reaction counts
feedbackSchema.virtual('reactionCounts').get(function () {
    const counts = {
        like: 0,
        love: 0,
        celebrate: 0,
        support: 0
    };

    this.reactions.forEach(reaction => {
        counts[reaction.type]++;
    });

    return counts;
});

// Virtual for total engagement
feedbackSchema.virtual('engagementScore').get(function () {
    return this.reactions.length + this.comments.length + (this.viewCount / 10);
});

// Ensure virtuals are included in JSON
feedbackSchema.set('toJSON', { virtuals: true });
feedbackSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
