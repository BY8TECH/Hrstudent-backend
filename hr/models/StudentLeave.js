const mongoose = require('mongoose');

const studentLeaveSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    leaveType: {
        type: String,
        enum: ['Sick Leave', 'Personal Leave', 'Family Emergency', 'Other'],
        required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // HR user who applied
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    notes: { type: String },
}, { timestamps: true });

// Auto-calculate total days
studentLeaveSchema.pre('save', function (next) {
    if (this.startDate && this.endDate) {
        const diff = Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24)) + 1;
        this.totalDays = diff;
    }
    next();
});

module.exports = mongoose.model('StudentLeave', studentLeaveSchema);
