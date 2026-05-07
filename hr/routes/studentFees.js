const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const StudentFee = require('../models/StudentFee');

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') return res.status(403).json({ message: 'Access denied. HR only.' });
    next();
};

// GET all fee records
router.get('/', protect, hrOnly, async (req, res) => {
    try {
        const { student, status, course, feeType } = req.query;
        const query = {};
        if (student) query.student = student;
        if (status) query.status = status;
        if (course) query.course = course;
        if (feeType) query.feeType = feeType;
        const fees = await StudentFee.find(query)
            .populate('student', 'name studentId')
            .populate('course', 'courseName courseCode')
            .sort({ createdAt: -1 });
        res.json(fees);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET pending fees summary
router.get('/pending/summary', protect, hrOnly, async (req, res) => {
    try {
        const pending = await StudentFee.find({ status: { $in: ['Pending', 'Overdue', 'Partial'] } })
            .populate('student', 'name studentId')
            .populate('course', 'courseName');
        const totalPending = pending.reduce((sum, f) => sum + (f.amount - f.paidAmount), 0);
        res.json({ records: pending, totalPending, count: pending.length });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET single fee record
router.get('/:id', protect, hrOnly, async (req, res) => {
    try {
        const fee = await StudentFee.findById(req.params.id)
            .populate('student', 'name studentId email phone')
            .populate('course', 'courseName courseCode');
        if (!fee) return res.status(404).json({ message: 'Fee record not found' });
        res.json(fee);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST create fee record
router.post('/', protect, hrOnly, async (req, res) => {
    try {
        const fee = new StudentFee(req.body);
        await fee.save();
        await fee.populate('student', 'name studentId');
        res.status(201).json(fee);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update fee record
router.put('/:id', protect, hrOnly, async (req, res) => {
    try {
        const fee = await StudentFee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
            .populate('student', 'name studentId')
            .populate('course', 'courseName');
        if (!fee) return res.status(404).json({ message: 'Fee record not found' });
        res.json(fee);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT record payment
router.put('/:id/pay', protect, hrOnly, async (req, res) => {
    try {
        const { paidAmount, paymentMode, notes } = req.body;
        const fee = await StudentFee.findById(req.params.id);
        if (!fee) return res.status(404).json({ message: 'Fee record not found' });

        fee.paidAmount = (fee.paidAmount || 0) + Number(paidAmount);
        fee.paidDate = new Date();
        fee.paymentMode = paymentMode || fee.paymentMode;
        if (notes) fee.notes = notes;

        if (fee.paidAmount >= fee.amount) {
            fee.status = 'Paid';
        } else if (fee.paidAmount > 0) {
            fee.status = 'Partial';
        }

        await fee.save();
        await fee.populate('student', 'name studentId');
        res.json(fee);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE fee record
router.delete('/:id', protect, hrOnly, async (req, res) => {
    try {
        await StudentFee.findByIdAndDelete(req.params.id);
        res.json({ message: 'Fee record deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
