const express = require('express');
const router = express.Router();
const { Leave, LeaveBalance } = require('../models/Leave');
const { protect } = require('../middleware/auth');
const { isHR, isSelfOrHR } = require('../middleware/rbac');
const checkDataAccess = require('../middleware/checkDataAccess');

// @route   GET /api/leaves
// @desc    Get all leave applications
// @access  Private/HR
router.get('/', protect, isHR, async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};
        if (status) query.status = status;

        const leaves = await Leave.find(query)
            .populate('employeeId', 'firstName lastName employeeId department')
            .populate('reviewedBy', 'email')
            .sort({ appliedDate: -1 });

        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/leaves/employee/:employeeId
// @desc    Get employee's leave applications
// @access  Private (Own data or HR)
router.get('/employee/:employeeId', protect, checkDataAccess, isSelfOrHR, async (req, res) => {
    try {
        const leaves = await Leave.find({ employeeId: req.params.employeeId })
            .populate('reviewedBy', 'email')
            .sort({ appliedDate: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/leaves/balance/:employeeId
// @desc    Get employee's leave balance
// @access  Private (Own data or HR)
router.get('/balance/:employeeId', protect, checkDataAccess, isSelfOrHR, async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        let balance = await LeaveBalance.findOne({
            employeeId: req.params.employeeId,
            year: currentYear
        });

        // Create balance if not exists
        if (!balance) {
            balance = await LeaveBalance.create({
                employeeId: req.params.employeeId,
                year: currentYear
            });
        }

        res.json(balance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/leaves
// @desc    Apply for leave
// @access  Private
router.post('/', protect, checkDataAccess, async (req, res) => {
    try {
        const leave = await Leave.create(req.body);
        res.status(201).json(leave);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/leaves/:id/review
// @desc    Approve/Reject leave
// @access  Private/HR
router.put('/:id/review', protect, isHR, async (req, res) => {
    try {
        const { status, reviewComments } = req.body;

        const leave = await Leave.findById(req.params.id);
        if (!leave) {
            return res.status(404).json({ message: 'Leave application not found' });
        }

        leave.status = status;
        leave.reviewComments = reviewComments;
        leave.reviewedBy = req.user._id;
        leave.reviewedDate = new Date();
        await leave.save();

        // Update leave balance if approved
        if (status === 'Approved') {
            const balance = await LeaveBalance.findOne({
                employeeId: leave.employeeId,
                year: new Date().getFullYear()
            });

            if (balance) {
                const leaveTypeMap = {
                    'Casual Leave': 'casualLeave',
                    'Sick Leave': 'sickLeave',
                    'Earned Leave': 'earnedLeave'
                };

                const balanceField = leaveTypeMap[leave.leaveType];
                if (balanceField && balance[balanceField]) {
                    balance[balanceField].used += leave.numberOfDays;
                    balance[balanceField].balance -= leave.numberOfDays;
                    await balance.save();
                }
            }
        }

        res.json(leave);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/leaves/:id
// @desc    Update own leave application (employees - only pending)
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({ message: 'Leave application not found' });
        }

        // Check if user is HR or the owner of the leave
        const isOwner = req.user.employeeId && leave.employeeId.toString() === req.user.employeeId.toString();
        const isHRUser = req.user.role === 'HR';

        if (!isOwner && !isHRUser) {
            return res.status(403).json({ message: 'You can only update your own leave applications' });
        }

        // Employees can only update pending leaves
        if (!isHRUser && leave.status !== 'Pending') {
            return res.status(400).json({
                message: 'You can only update pending leave applications. This leave is already ' + leave.status
            });
        }

        // Update the leave
        const updatedLeave = await Leave.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('employeeId', 'firstName lastName employeeId department')
            .populate('reviewedBy', 'email');

        res.json(updatedLeave);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/leaves/:id
// @desc    Delete leave application (employees can delete own pending leaves, HR can delete any)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({ message: 'Leave application not found' });
        }

        // Check if user is HR or the owner of the leave
        const isOwner = req.user.employeeId && leave.employeeId.toString() === req.user.employeeId.toString();
        const isHRUser = req.user.role === 'HR';

        if (!isOwner && !isHRUser) {
            return res.status(403).json({ message: 'You can only delete your own leave applications' });
        }

        // Employees can only delete pending leaves
        if (!isHRUser && leave.status !== 'Pending') {
            return res.status(400).json({
                message: 'You can only delete pending leave applications. This leave is already ' + leave.status
            });
        }

        await Leave.findByIdAndDelete(req.params.id);
        res.json({ message: 'Leave application deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
