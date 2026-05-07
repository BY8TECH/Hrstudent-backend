const mongoose = require('mongoose');

const studentCourseSchema = new mongoose.Schema({
    courseName: { type: String, required: true, trim: true },
    courseCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    subjects: [{ type: String, trim: true }],
    faculty: { type: String, trim: true },
    academicYear: { type: String, trim: true },
    duration: { type: String, trim: true }, // e.g., "2 Years", "6 Months"
    fees: { type: Number },
    description: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
}, { timestamps: true });

module.exports = mongoose.model('StudentCourse', studentCourseSchema);
