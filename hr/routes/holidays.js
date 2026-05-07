const express = require('express');
const router = express.Router();
const Holiday = require('../models/Holiday');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// @route   GET /api/holidays
// @desc    Get all holidays
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { year } = req.query;
        let query = {};

        if (year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);
            query.date = { $gte: startDate, $lte: endDate };
        }

        const holidays = await Holiday.find(query).sort({ date: 1 });
        res.json(holidays);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/holidays/:year/:month
// @desc    Get holidays for specific month
// @access  Private
router.get('/:year/:month', protect, async (req, res) => {
    try {
        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const holidays = await Holiday.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 });

        res.json(holidays);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/holidays
// @desc    Create holiday
// @access  Private/HR
router.post('/', protect, isHR, async (req, res) => {
    try {
        const holiday = await Holiday.create(req.body);
        res.status(201).json(holiday);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/holidays/:id
// @desc    Update holiday
// @access  Private/HR
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        const holiday = await Holiday.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!holiday) {
            return res.status(404).json({ message: 'Holiday not found' });
        }

        res.json(holiday);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/holidays/:id
// @desc    Delete holiday
// @access  Private/HR
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const holiday = await Holiday.findByIdAndDelete(req.params.id);

        if (!holiday) {
            return res.status(404).json({ message: 'Holiday not found' });
        }

        res.json({ message: 'Holiday deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
