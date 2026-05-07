const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    studentId: {
        type: String,
        unique: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    address: { type: String },
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentCourse' },
    enrollmentDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    profilePhoto: { type: String },
    documents: [
        {
            name: String,
            url: String,
            uploadedAt: { type: Date, default: Date.now },
        },
    ],
    notes: { type: String },
}, { timestamps: true });

// Auto-generate studentId
studentSchema.pre('save', async function (next) {
    if (!this.studentId) {
        try {
            const count = await this.constructor.countDocuments();
            this.studentId = `STU${String(count + 1).padStart(4, '0')}`;
        } catch (err) {
            return next(err);
        }
    }
    next();
});

module.exports = mongoose.model('Student', studentSchema);
