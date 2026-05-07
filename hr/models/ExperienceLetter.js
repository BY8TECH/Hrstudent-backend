const mongoose = require('mongoose');

const experienceLetterSchema = new mongoose.Schema({
    // Employee Details
    employeeName: { type: String, required: true },
    employeeId: { type: String },
    jobRole: { type: String, required: true },

    // Company Details
    companyName: { type: String, required: true },
    companyAddress: { type: String, required: true },
    companyPhone: { type: String },
    companyEmail: { type: String },
    companyWebsite: { type: String },
    hrManagerName: { type: String, required: true },
    companyLogo: { type: String },

    // Employment Details
    dateOfJoining: { type: Date, required: true },
    lastWorkingDate: { type: Date, required: true },
    totalExperience: { type: String, required: true }, // e.g. "2 years 3 months"

    // Work Details
    rolesResponsibilities: { type: String },
    department: { type: String },
    skillsTechnologies: { type: String },

    // Letter Content
    certificationText: { type: String },
    workPerformance: { type: String },
    conduct: { type: String },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('ExperienceLetter', experienceLetterSchema);
