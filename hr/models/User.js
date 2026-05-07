const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Please provide a username']
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 6,
        select: false
    },
    role: {
        type: String,
        enum: ['Employee', 'Manager', 'HR'],
        default: 'Employee'
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    approvalStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedDate: {
        type: Date
    },
    rejectionReason: {
        type: String
    },
    hasDataAccess: {
        type: Boolean,
        default: false,
        description: 'Whether employee can access their data (leaves, attendance, etc)'
    },
    emailOTP: {
        type: String,
        select: false  // Don't include in queries by default
    },
    emailOTPExpires: {
        type: Date
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailConfig: {
        provider: {
            type: String,
            enum: ['Hostinger', 'Gmail', 'Custom'],
            default: 'Hostinger'
        },
        email: { type: String },
        password: { type: String, select: false }, // Encrypted
        smtpHost: { type: String },
        smtpPort: { type: Number },
        imapHost: { type: String },
        imapPort: { type: Number },
        isConfigured: { type: Boolean, default: false }
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generate email OTP
userSchema.methods.generateEmailOTP = function () {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.emailOTP = otp;
    this.emailOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    return otp;
};

module.exports = mongoose.model('User', userSchema);
