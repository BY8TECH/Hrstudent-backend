const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    type: {
        type: String,
        enum: ['National', 'Festival', 'Company', 'Optional'],
        default: 'Company'
    },
    description: {
        type: String
    },
    isOptional: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for faster queries by date
holidaySchema.index({ date: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);
