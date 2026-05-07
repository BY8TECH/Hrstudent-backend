const mongoose = require('mongoose');

const studentAttendanceSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentCourse' },
    date: { type: Date, required: true },
    status: { type: String, enum: ['Present', 'Absent', 'Late', 'Leave', 'Holiday'], default: 'Absent' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    // OTP edit flow
    otp: { type: String },
    otpExpiry: { type: Date },
    pendingEdit: {
        status: { type: String },
        remarks: { type: String },
        courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentCourse' },
    },
}, { timestamps: true });

// Unique per student per date
studentAttendanceSchema.index({ student: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('StudentAttendance', studentAttendanceSchema);
