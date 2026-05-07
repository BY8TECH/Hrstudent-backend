const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const StudentLeave = require('../models/StudentLeave');

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') return res.status(403).json({ message: 'Access denied. HR only.' });
    next();
};

// GET all leave records
router.get('/', protect, hrOnly, async (req, res) => {
    try {
        const { student, status, leaveType, startDate, endDate } = req.query;
        const query = {};
        if (student) query.student = student;
        if (status) query.status = status;
        if (leaveType) query.leaveType = leaveType;
        if (startDate && endDate) {
            query.startDate = { $gte: new Date(startDate) };
            query.endDate = { $lte: new Date(endDate) };
        }
        const leaves = await StudentLeave.find(query)
            .populate('student', 'name studentId')
            .populate('appliedBy', 'name')
            .sort({ createdAt: -1 });
        res.json(leaves);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST create leave record
router.post('/', protect, hrOnly, async (req, res) => {
    try {
        const leave = new StudentLeave({ ...req.body, appliedBy: req.user._id });
        await leave.save();
        await leave.populate('student', 'name studentId');
        res.status(201).json(leave);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update leave record
router.put('/:id', protect, hrOnly, async (req, res) => {
    try {
        const leave = await StudentLeave.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
            .populate('student', 'name studentId');
        if (!leave) return res.status(404).json({ message: 'Leave record not found' });
        res.json(leave);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update leave status (approve/reject)
router.put('/:id/status', protect, hrOnly, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const leave = await StudentLeave.findByIdAndUpdate(
            req.params.id,
            { status, notes, reviewedBy: req.user._id, reviewedAt: new Date() },
            { new: true }
        ).populate('student', 'name studentId');
        if (!leave) return res.status(404).json({ message: 'Leave record not found' });
        res.json(leave);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE leave record
router.delete('/:id', protect, hrOnly, async (req, res) => {
    try {
        await StudentLeave.findByIdAndDelete(req.params.id);
        res.json({ message: 'Leave record deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
