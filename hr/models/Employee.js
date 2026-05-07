const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    // Personal Information
    prefix: {
        type: String,
        enum: ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', '']
    },
    firstName: {
        type: String,
        required: [true, 'Please provide first name']
    },
    middleName: {
        type: String
    },
    lastName: {
        type: String,
        required: [true, 'Please provide last name']
    },
    dateOfBirth: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other']
    },
    bloodGroup: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'NA', '']
    },
    nationality: {
        type: String,
        default: 'Indian'
    },

    // Contact Information
    email: {
        type: String,
        required: [true, 'Please provide email'],
        unique: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: [true, 'Please provide phone number']
    },
    isdCode: {
        type: String,
        default: '91'
    },
    address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String
    },

    // Employment Details
    employeeId: {
        type: String,
        required: [true, 'Please provide employee ID'],
        unique: true
    },
    joiningDate: {
        type: Date,
        required: [true, 'Please provide joining date']
    },
    employmentType: {
        type: String,
        enum: ['Permanent', 'Contract', 'Intern', 'Temporary', ''],
        default: 'Permanent'
    },
    // Employee Category Classification
    employeeCategory: {
        type: String,
        enum: ['Full-Time', 'Part-Time', 'Internship', ''],
        default: 'Full-Time'
    },
    // Part-Time specific
    weeklyHours: {
        type: Number,
        min: 1,
        max: 40
    },
    // Internship specific
    internshipEndDate: {
        type: Date
    },
    stipend: {
        type: Number,
        min: 0
    },
    employmentStatus: {
        type: String,
        enum: ['Active', 'Probation', 'Confirmed', 'Resigned', 'Terminated', ''],
        default: 'Probation'
    },
    dateOfConfirmation: {
        type: Date
    },
    probationEndDate: {
        type: Date
    },
    dateOfLeaving: {
        type: Date
    },
    dateOfResignation: {
        type: Date
    },
    dateOfSettlement: {
        type: Date
    },

    // Company & Department
    company: {
        type: String,
        default: 'By8labs AI Pvt. Ltd.'
    },
    businessUnit: {
        type: String
    },
    department: {
        type: String,
        required: [true, 'Please provide department'],
        enum: ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 'Support', 'Management', 'Artificial Intelligence', '']
    },
    subDepartment: {
        type: String
    },
    designation: {
        type: String,
        required: [true, 'Please provide designation']
    },

    // Location
    region: {
        type: String
    },
    branch: {
        type: String
    },
    subBranch: {
        type: String
    },

    // Reporting Structure
    reportingManager: {
        type: String
    },
    functionalManager: {
        type: String
    },

    // Additional Fields
    skillType: {
        type: String,
        enum: ['Skilled', 'Semi-Skilled', 'Unskilled', '']
    },
    biometricId: {
        type: String
    },
    employeeOtherStatusId: {
        type: String
    },
    otherStatusDate: {
        type: Date
    },
    otherStatusRemarks: {
        type: String
    },

    // Documents
    documents: [{
        name: String,
        type: {
            type: String,
            enum: ['ID Proof', 'Offer Letter', 'Resume', 'Educational Certificate', 'Experience Letter', 'Other']
        },
        filePath: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Emergency Contact
    emergencyContact: {
        name: String,
        relationship: String,
        phone: String
    },

    // Bank Details (Expanded)
    bankDetails: {
        accountHolderName: String,
        bankName: String,
        accountNumber: String,
        ifscCode: String,
        branch: String,
        accountType: {
            type: String,
            enum: ['Savings', 'Current', '']
        },
        panNumber: String,
        upiId: String
    },

    // Statutory Details
    pfAccountNumber: {
        type: String
    },
    uanNumber: {
        type: String
    },
    esiNumber: {
        type: String
    },


    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Employee', employeeSchema);
