const express = require('express');
const router = express.Router();
const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const { protect } = require('../middleware/auth');
const { isHR, isSelfOrHR } = require('../middleware/rbac');

// @route   GET /api/payroll
// @desc    Get all payroll records
// @access  Private/HR
router.get('/', protect, isHR, async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = {};

        if (month) query.month = parseInt(month);
        if (year) query.year = parseInt(year);

        const payroll = await Payroll.find(query)
            .populate('employeeId', 'firstName lastName employeeId department')
            .sort({ year: -1, month: -1 });

        res.json(payroll);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// @route   GET /api/payroll/employee/:employeeId
// @desc    Get employee's payroll records
// @access  Private (Own data or HR)
router.get('/employee/:employeeId', protect, isSelfOrHR, async (req, res) => {
    try {
        const payroll = await Payroll.find({ employeeId: req.params.employeeId })
            .populate('employeeId', 'employeeId firstName lastName designation department')
            .sort({ year: -1, month: -1 });
        res.json(payroll);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/payroll/my-payroll
// @desc    Get logged-in employee's payroll by matching email
// @access  Private (Employee/HR)
router.get('/my-payroll', protect, async (req, res) => {
    try {
        const Employee = require('../models/Employee');

        // Find employee record by matching email
        const employee = await Employee.findOne({ email: req.user.email });

        if (!employee) {
            return res.status(404).json({
                message: 'No employee record found with your email. Please contact HR.'
            });
        }

        // Get payroll records for this employee
        const payroll = await Payroll.find({ employeeId: employee._id })
            .populate('employeeId', 'employeeId firstName lastName designation department')
            .sort({ year: -1, month: -1 });

        res.json(payroll);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// @route   POST /api/payroll
// @desc    Create payroll record with automatic LOP calculation
// @access  Private/HR
router.post('/', protect, isHR, async (req, res) => {
    try {
        req.body.generatedBy = req.user._id;

        // Fetch attendance data for the month
        const { employeeId, month, year, monthlySalary } = req.body;

        if (!monthlySalary) {
            return res.status(400).json({ message: 'Monthly salary is required' });
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const attendanceRecords = await Attendance.find({
            employeeId,
            date: { $gte: startDate, $lte: endDate }
        });

        // Calculate working days and absent days
        const totalDays = endDate.getDate();
        const absentDays = attendanceRecords.filter(a => a.status === 'Absent').length;

        req.body.totalWorkingDays = totalDays;
        req.body.absentDays = absentDays;

        // The pre-save middleware will calculate:
        // - actualWorkingDays
        // - perDaySalary
        // - lopAmount
        // - actualSalary
        // - netPayableSalary

        const payroll = await Payroll.create(req.body);
        const populatedPayroll = await Payroll.findById(payroll._id)
            .populate('employeeId', 'employeeId firstName lastName designation joiningDate bankDetails');

        res.status(201).json(populatedPayroll);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Payroll already exists for this month' });
        }
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/payroll/:id
// @desc    Update payroll record
// @access  Private/HR
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        const payroll = await Payroll.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!payroll) {
            return res.status(404).json({ message: 'Payroll record not found' });
        }

        res.json(payroll);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/payroll/:id
// @desc    Delete payroll record
// @access  Private/HR
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const payroll = await Payroll.findByIdAndDelete(req.params.id);

        if (!payroll) {
            return res.status(404).json({ message: 'Payroll record not found' });
        }

        res.json({ message: 'Payroll record deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// ULTRA SIMPLE TEST - Just check if employee can reach endpoint
router.get('/slip/test-auth', protect, async (req, res) => {
    return res.json({
        message: 'SUCCESS! You reached the endpoint!',
        user: {
            email: req.user.email,
            role: req.user.role,
            id: req.user._id
        }
    });
});

// TEST ENDPOINT - Check what happens for employees
router.get('/slip/:id/test', protect, async (req, res) => {
    try {
        const payroll = await Payroll.findById(req.params.id)
            .populate('employeeId', 'employeeId firstName lastName designation joiningDate bankDetails email');

        return res.json({
            success: true,
            user: {
                email: req.user.email,
                role: req.user.role,
                id: req.user._id
            },
            payroll: payroll ? {
                id: payroll._id,
                month: payroll.month,
                year: payroll.year,
                employeeId: payroll.employeeId?._id,
                employeeEmail: payroll.employeeId?.email,
                employeeName: `${payroll.employeeId?.firstName} ${payroll.employeeId?.lastName}`
            } : null
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// @route   GET /api/payroll/slip/:id/pdf
// @desc    Download salary slip as PDF
// @access  Private (Own slip or HR)
router.get('/slip/:id/pdf', protect, async (req, res) => {
    let step = 'initialization';

    try {
        step = 'fetching payroll';
        const payroll = await Payroll.findById(req.params.id)
            .populate('employeeId', 'employeeId firstName lastName designation joiningDate bankDetails email');

        if (!payroll) {
            return res.status(404).json({
                message: 'Payroll record not found',
                step: 'payroll_fetch',
                payrollId: req.params.id
            });
        }

        step = 'checking authorization';
        const isHRUser = req.user.role === 'HR';
        let isOwnPayroll = false;

        if (!isHRUser && payroll.employeeId && payroll.employeeId.email) {
            isOwnPayroll = payroll.employeeId.email.toLowerCase() === req.user.email.toLowerCase();
        }

        // Check authorization
        if (!isHRUser && !isOwnPayroll) {
            return res.status(403).json({
                message: 'Access denied. You can only view your own salary slips.',
                debug: {
                    step: 'authorization',
                    userEmail: req.user.email,
                    payrollEmployeeEmail: payroll.employeeId?.email
                }
            });
        }

        step = 'generating PDF';
        const { generateSalarySlipPDF } = require('../utils/pdfGenerator');

        // Parse withTax query param (default to true)
        const withTax = req.query.withTax !== 'false';

        const pdfDoc = generateSalarySlipPDF(payroll, withTax);

        step = 'preparing filename';
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const filename = `Salary_Slip_${payroll.employeeId.employeeId}_${monthNames[payroll.month - 1]}_${payroll.year}.pdf`;

        step = 'setting headers';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        step = 'streaming PDF';
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (error) {
        console.error('❌ PDF Error at step:', step);
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);

        // Return detailed error as JSON
        if (!res.headersSent) {
            return res.status(500).json({
                message: `PDF Error - Step: ${step} | ${error.message}`,
                debug: {
                    step,
                    error: error.message,
                    user: {
                        email: req.user?.email,
                        role: req.user?.role
                    },
                    payrollId: req.params.id
                }
            });
        } else {
            res.end();
        }
    }
});

module.exports = router;
