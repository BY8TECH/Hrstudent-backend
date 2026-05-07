const express = require('express');
const router = express.Router();
const Performance = require('../models/Performance');
const Employee = require('../models/Employee');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// @route   GET /api/performance
// @desc    Get all performance reviews (HR) or own reviews (Employee)
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        let query = {};
        if (req.user.role !== 'HR' && req.user.role !== 'Manager') {
            // Employee: only their own reviews
            const employee = await Employee.findOne({ email: req.user.email });
            if (!employee) return res.json([]);
            query.employeeId = employee._id;
        }
        const reviews = await Performance.find(query)
            .populate('employeeId', 'firstName lastName employeeId department designation')
            .populate('reviewedBy', 'email')
            .sort({ createdAt: -1 });
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/performance/:id
// @desc    Get single review
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const review = await Performance.findById(req.params.id)
            .populate('employeeId', 'firstName lastName employeeId department designation email')
            .populate('reviewedBy', 'email');
        if (!review) return res.status(404).json({ message: 'Review not found' });
        res.json(review);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/performance
// @desc    Create a performance review
// @access  Private/HR or Manager
router.post('/', protect, async (req, res) => {
    try {
        const review = await Performance.create({
            ...req.body,
            reviewedBy: req.user._id || req.user.id
        });
        const populated = await review.populate('employeeId', 'firstName lastName employeeId department designation');
        res.status(201).json(populated);
    } catch (error) {
        console.error('Performance create error:', error.message);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/performance/:id
// @desc    Update a performance review
// @access  Private/HR or Manager
router.put('/:id', protect, async (req, res) => {
    try {
        const review = await Performance.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: false }
        ).populate('employeeId', 'firstName lastName employeeId department designation');
        if (!review) return res.status(404).json({ message: 'Review not found' });
        res.json(review);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/performance/:id/acknowledge
// @desc    Employee acknowledges their review
// @access  Private
router.put('/:id/acknowledge', protect, async (req, res) => {
    try {
        const review = await Performance.findByIdAndUpdate(
            req.params.id,
            { $set: { status: 'Acknowledged', employeeComments: req.body.employeeComments } },
            { new: true }
        ).populate('employeeId', 'firstName lastName employeeId department designation');
        if (!review) return res.status(404).json({ message: 'Review not found' });
        res.json(review);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/performance/:id
// @desc    Delete a review
// @access  Private/HR
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const review = await Performance.findByIdAndDelete(req.params.id);
        if (!review) return res.status(404).json({ message: 'Review not found' });
        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
