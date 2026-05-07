const mongoose = require('mongoose');

const studentAssignmentSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentCourse' },
    subject: { type: String, trim: true },
    description: { type: String },
    dueDate: { type: Date, required: true },
    maxMarks: { type: Number, default: 100 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    attachmentUrl: { type: String },
    submittedStudents: [
        {
            student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
            submittedAt: { type: Date },
            status: { type: String, enum: ['Submitted', 'Late', 'Not Submitted'], default: 'Not Submitted' },
            marksObtained: { type: Number },
            notes: { type: String },
        },
    ],
}, { timestamps: true });

module.exports = mongoose.model('StudentAssignment', studentAssignmentSchema);
