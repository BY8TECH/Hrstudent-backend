const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    cc: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    bcc: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    subject: {
        type: String,
        required: true,
        trim: true
    },
    body: {
        type: String,
        required: true
    },
    readBy: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    deletedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    sentToAll: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for faster queries
emailSchema.index({ sender: 1, createdAt: -1 });
emailSchema.index({ recipients: 1, createdAt: -1 });

module.exports = mongoose.model('Email', emailSchema);
