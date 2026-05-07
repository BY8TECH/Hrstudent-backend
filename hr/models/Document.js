const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    documentType: {
        type: String,
        enum: ['Resume', 'Certificate', 'ID Proof', 'Offer Letter', 'Experience Letter', 'Other'],
        required: true,
        default: 'Other'
    },
    title: {
        type: String,
        required: [true, 'Document title is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    fileName: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number  // bytes
    },
    mimeType: {
        type: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Document', documentSchema);
