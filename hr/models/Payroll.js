const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true
    },
    monthlySalary: {
        type: Number,
        required: true,
        min: 0
    },
    incentives: {
        type: Number,
        default: 0
    },
    advance: {
        type: Number,
        default: 0
    },
    advanceDeduction: {
        type: Number,
        default: 0
    },
    // Attendance-based fields
    totalWorkingDays: {
        type: Number,
        default: 0
    },
    absentDays: {
        type: Number,
        default: 0
    },
    actualWorkingDays: {
        type: Number,
        default: 0
    },
    // LOP calculation fields
    perDaySalary: {
        type: Number,
        default: 0
    },
    lopAmount: {
        type: Number,
        default: 0
    },
    actualSalary: {
        type: Number,
        default: 0
    },
    // Time-based deductions
    lateArrivalMinutes: {
        type: Number,
        default: 0
    },
    earlyLeavingMinutes: {
        type: Number,
        default: 0
    },
    timeDeductions: {
        type: Number,
        default: 0
    },
    // Salary Component Breakdown
    basicSalary: {
        type: Number,
        default: 0
    },
    hra: {
        type: Number,
        default: 0
    },
    telephoneAllowance: {
        type: Number,
        default: 2000
    },
    conveyanceAllowance: {
        type: Number,
        default: 1600
    },
    medicalAllowance: {
        type: Number,
        default: 1250
    },
    specialAllowance: {
        type: Number,
        default: 0
    },
    otherAllowances: {
        type: Number,
        default: 0
    },
    grossSalary: {
        type: Number,
        default: 0
    },
    // Tax Deductions
    providentFund: {
        type: Number,
        default: 0
    },
    esi: {
        type: Number,
        default: 0
    },
    professionalTax: {
        type: Number,
        default: 0
    },
    incomeTax: {
        type: Number,
        default: 0
    },
    totalTax: {
        type: Number,
        default: 0
    },
    // Other deductions
    otherDeductions: {
        type: Number,
        default: 0
    },
    totalDeductions: {
        type: Number,
        default: 0
    },
    // Final salary
    netPayableSalary: {
        type: Number,
        default: 0
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Processed', 'Paid'],
        default: 'Pending'
    },
    paymentDate: {
        type: Date
    },
    remarks: {
        type: String
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Create compound index for employee, month, and year
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

// Calculate totals before saving
payrollSchema.pre('save', function (next) {
    // 1. Calculate Salary Component Breakdown
    if (!this.basicSalary && !this.hra && !this.specialAllowance) {
        this.basicSalary = Math.round(this.monthlySalary * 0.50);  // 50% Basic
        this.hra = Math.round(this.basicSalary * 0.40);         // 40% of Basic
        if (this.telephoneAllowance === undefined || this.telephoneAllowance === null) this.telephoneAllowance = 2000;
        if (this.conveyanceAllowance === undefined || this.conveyanceAllowance === null) this.conveyanceAllowance = 1600;
        if (this.medicalAllowance === undefined || this.medicalAllowance === null) this.medicalAllowance = 1250;

        // Special allowance makes up the rest of the monthly salary
        const fixedComponents = this.basicSalary + this.hra + this.telephoneAllowance + this.conveyanceAllowance + this.medicalAllowance;
        this.specialAllowance = Math.round(Math.max(0, this.monthlySalary - fixedComponents));
    }

    this.grossSalary = this.monthlySalary;

    // 2. Calculate attendance-based fields
    this.actualWorkingDays = this.totalWorkingDays - this.absentDays;

    // 3. Calculate per day salary
    if (this.totalWorkingDays > 0) {
        this.perDaySalary = this.monthlySalary / this.totalWorkingDays;
    }

    // 4. Calculate LOP amount
    this.lopAmount = Math.round(this.absentDays * this.perDaySalary);

    // 5. Calculate actual salary (after LOP)
    this.actualSalary = this.monthlySalary - this.lopAmount;

    // 6. Calculate Tax Deductions

    // Provident Fund (PF)
    if (this.providentFund === undefined || this.providentFund === null) {
        this.providentFund = 1800;
    }

    // ESI
    if (this.esi === undefined || this.esi === null) {
        this.esi = this.monthlySalary < 21000 ? Math.round(this.monthlySalary * 0.0075) : 0;
    }

    // Professional Tax
    if (this.professionalTax === undefined || this.professionalTax === null) {
        this.professionalTax = 200;
    }

    // Income Tax (TDS) - Based on annual salary slabs
    // Only calculate automatically if not explicitly provided during creation
    if ((this.incomeTax === undefined || this.incomeTax === null) && (this.isNew || this.isModified('monthlySalary'))) {
        const annualSalary = this.monthlySalary * 12;
        let monthlyTDS = 0;

        if (annualSalary > 1000000) {
            // Above 10 lakh: 30%
            const taxableAmount = annualSalary - 250000; // After basic exemption
            monthlyTDS = Math.round((taxableAmount * 0.30) / 12);
        } else if (annualSalary > 500000) {
            // 5-10 lakh: 20%
            const taxableAmount = annualSalary - 250000;
            monthlyTDS = Math.round((taxableAmount * 0.20) / 12);
        } else if (annualSalary > 250000) {
            // 2.5-5 lakh: 5%
            const taxableAmount = annualSalary - 250000;
            monthlyTDS = Math.round((taxableAmount * 0.05) / 12);
        }

        this.incomeTax = monthlyTDS;
    }

    // Total Tax
    this.totalTax = this.providentFund + this.esi + this.professionalTax + this.incomeTax;

    // 7. Calculate total deductions (includes LOP, tax, and other deductions)
    this.totalDeductions = this.lopAmount + this.totalTax + this.advanceDeduction + this.timeDeductions + this.otherDeductions;

    // 8. Calculate net payable salary
    this.netPayableSalary = this.monthlySalary + this.incentives - this.totalDeductions;

    next();
});

module.exports = mongoose.model('Payroll', payrollSchema);
