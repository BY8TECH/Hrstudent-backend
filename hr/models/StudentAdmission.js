const mongoose = require('mongoose');

const studentAdmissionSchema = new mongoose.Schema({
    admissionId: {
        type: String,
        unique: true,
    },
    // Applicant basic info
    applicantName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    address: { type: String },

    // Guardian / Parent info
    guardianName: { type: String, trim: true },
    guardianPhone: { type: String, trim: true },
    guardianRelation: { type: String, trim: true },

    // Academic info
    previousSchool: { type: String, trim: true },
    previousClass: { type: String, trim: true },
    previousPercentage: { type: Number, min: 0, max: 100 },

    // Applied course / class
    appliedCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentCourse' },
    appliedClass: { type: String, trim: true },

    // Admission process
    applicationDate: { type: Date, default: Date.now },
    interviewDate: { type: Date },
    interviewNotes: { type: String },

    // Status workflow: Pending → Under Review → Interview Scheduled → Approved / Rejected
    status: {
        type: String,
        enum: ['Pending', 'Under Review', 'Interview Scheduled', 'Approved', 'Rejected', 'Waitlisted'],
        default: 'Pending',
    },

    // If approved, link to actual student record
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },

    // Documents submitted by applicant
    documents: [
        {
            name: String,
            url: String,
            uploadedAt: { type: Date, default: Date.now },
        },
    ],

    // Remarks / notes by HR
    remarks: { type: String },

    // Fees (if any admission fee)
    admissionFee: { type: Number, default: 0 },
    feePaid: { type: Boolean, default: false },

    // HR who processed this
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

}, { timestamps: true });

// Auto-generate admissionId
studentAdmissionSchema.pre('save', async function (next) {
    if (!this.admissionId) {
        try {
            const count = await this.constructor.countDocuments();
            this.admissionId = `ADM${String(count + 1).padStart(5, '0')}`;
        } catch (err) {
            return next(err);
        }
    }
    next();
});

module.exports = mongoose.model('StudentAdmission', studentAdmissionSchema);
