const express = require('express');
const router = express.Router();
const JobPosting = require('../models/JobPosting');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// @route   GET /api/recruitment/jobs
// @desc    Get all job postings
// @access  Private/HR
router.get('/', protect, isHR, async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};

        if (status) query.status = status;

        const jobs = await JobPosting.find(query)
            .populate('postedBy', 'username email')
            .sort({ createdAt: -1 });

        res.json(jobs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/recruitment/jobs/:id
// @desc    Get single job posting
// @access  Private/HR
router.get('/:id', protect, isHR, async (req, res) => {
    try {
        const job = await JobPosting.findById(req.params.id)
            .populate('postedBy', 'username email');

        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        res.json(job);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/recruitment/jobs
// @desc    Create job posting
// @access  Private/HR
router.post('/', protect, isHR, async (req, res) => {
    try {
        const jobData = {
            ...req.body,
            postedBy: req.user._id
        };

        const job = await JobPosting.create(jobData);
        res.status(201).json(job);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/jobs/:id
// @desc    Update job posting
// @access  Private/HR
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        const job = await JobPosting.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        res.json(job);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/jobs/:id/publish
// @desc    Publish job posting
// @access  Private/HR
router.put('/:id/publish', protect, isHR, async (req, res) => {
    try {
        const job = await JobPosting.findByIdAndUpdate(
            req.params.id,
            { status: 'Published', postedDate: new Date() },
            { new: true }
        );

        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        res.json(job);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/recruitment/jobs/:id
// @desc    Close job posting
// @access  Private/HR
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const job = await JobPosting.findByIdAndUpdate(
            req.params.id,
            { status: 'Closed' },
            { new: true }
        );

        if (!job) {
            return res.status(404).json({ message: 'Job not found' });
        }

        res.json({ message: 'Job closed successfully', job });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
