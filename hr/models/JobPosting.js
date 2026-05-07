const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema({
    jobId: {
        type: String,
        unique: true
    },
    title: {
        type: String,
        required: [true, 'Please provide job title']
    },
    department: {
        type: String,
        required: [true, 'Please provide department'],
        enum: ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 'Support', 'Management']
    },
    location: {
        type: String,
        default: 'Bangalore'
    },
    employmentType: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
        default: 'Full-time'
    },
    experience: {
        min: { type: Number, default: 0 },
        max: { type: Number, default: 10 }
    },
    qualifications: [String],
    skills: [String],
    responsibilities: String,
    salary: {
        min: Number,
        max: Number,
        currency: { type: String, default: 'INR' }
    },
    openings: {
        type: Number,
        default: 1
    },
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Closed', 'On-Hold'],
        default: 'Draft'
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postedDate: Date,
    closingDate: Date,
    description: String
}, {
    timestamps: true
});

// Auto-generate job ID
jobPostingSchema.pre('save', async function (next) {
    if (!this.jobId) {
        const count = await mongoose.model('JobPosting').countDocuments();
        this.jobId = `JOB${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('JobPosting', jobPostingSchema);
