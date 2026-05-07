const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    offerId: {
        type: String,
        unique: true
    },
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
    designation: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    offeredSalary: {
        type: Number,
        required: true
    },
    joiningDate: Date,
    offerLetterPath: String,
    status: {
        type: String,
        enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Negotiating'],
        default: 'Draft'
    },
    sentDate: Date,
    acceptedDate: Date,
    rejectedDate: Date,
    notes: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Auto-generate offer ID
offerSchema.pre('save', async function (next) {
    if (!this.offerId) {
        const count = await mongoose.model('Offer').countDocuments();
        this.offerId = `OFF${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Offer', offerSchema);
