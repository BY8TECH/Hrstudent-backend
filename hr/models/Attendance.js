const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    checkIn: {
        type: Date
    },
    checkOut: {
        type: Date
    },
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Half Day', 'Work From Home', 'On Leave', 'Permission'],
        default: 'Absent'
    },
    workType: {
        type: String,
        enum: ['Office', 'Work From Home', 'Field Work'],
        default: 'Office'
    },
    isLate: {
        type: Boolean,
        default: false
    },
    isEarlyLeave: {
        type: Boolean,
        default: false
    },
    totalHours: {
        type: Number,
        default: 0
    },
    remarks: {
        type: String
    },
    permissionFrom: {
        type: String   // e.g. "09:00"
    },
    permissionTo: {
        type: String   // e.g. "11:00"
    },
    markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    editedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    editedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Create compound index for employee and date
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

// Calculate total hours when checkout is set
attendanceSchema.pre('save', function (next) {
    if (this.checkIn && this.checkOut) {
        const diffMs = this.checkOut - this.checkIn;
        this.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    }
    next();
});

module.exports = mongoose.model('Attendance', attendanceSchema);
