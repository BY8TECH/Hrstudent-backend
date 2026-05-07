const express = require('express');
const router = express.Router();
const Offer = require('../models/Offer');
const Candidate = require('../models/Candidate');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// @route   GET /api/recruitment/offers
// @desc    Get all offers
// @access  Private/HR
router.get('/', protect, isHR, async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};

        if (status) query.status = status;

        const offers = await Offer.find(query)
            .populate('candidateId', 'candidateId firstName lastName email phone')
            .populate('jobId', 'jobId title department')
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });

        res.json(offers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/recruitment/offers/:id
// @desc    Get single offer
// @access  Private/HR
router.get('/:id', protect, isHR, async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id)
            .populate('candidateId', 'candidateId firstName lastName email phone expectedSalary')
            .populate('jobId', 'jobId title department location')
            .populate('createdBy', 'username email');

        if (!offer) {
            return res.status(404).json({ message: 'Offer not found' });
        }

        res.json(offer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/recruitment/offers
// @desc    Create offer
// @access  Private/HR
router.post('/', protect, isHR, async (req, res) => {
    try {
        const offerData = {
            ...req.body,
            createdBy: req.user._id
        };

        const offer = await Offer.create(offerData);

        // Update candidate status
        await Candidate.findByIdAndUpdate(
            offer.candidateId,
            { status: 'Offered' }
        );

        const populatedOffer = await Offer.findById(offer._id)
            .populate('candidateId', 'candidateId firstName lastName email')
            .populate('jobId', 'jobId title');

        res.status(201).json(populatedOffer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/offers/:id
// @desc    Update offer
// @access  Private/HR
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        const offer = await Offer.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )
            .populate('candidateId', 'candidateId firstName lastName')
            .populate('jobId', 'jobId title');

        if (!offer) {
            return res.status(404).json({ message: 'Offer not found' });
        }

        res.json(offer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/offers/:id/send
// @desc    Send offer letter
// @access  Private/HR
router.put('/:id/send', protect, isHR, async (req, res) => {
    try {
        const offer = await Offer.findByIdAndUpdate(
            req.params.id,
            {
                status: 'Sent',
                sentDate: new Date()
            },
            { new: true }
        ).populate('candidateId jobId');

        if (!offer) {
            return res.status(404).json({ message: 'Offer not found' });
        }

        res.json(offer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/offers/:id/accept
// @desc    Accept offer
// @access  Private/HR
router.put('/:id/accept', protect, isHR, async (req, res) => {
    try {
        const offer = await Offer.findByIdAndUpdate(
            req.params.id,
            {
                status: 'Accepted',
                acceptedDate: new Date()
            },
            { new: true }
        ).populate('candidateId jobId');

        if (!offer) {
            return res.status(404).json({ message: 'Offer not found' });
        }

        // Update candidate status to Hired
        await Candidate.findByIdAndUpdate(
            offer.candidateId,
            { status: 'Hired' }
        );

        res.json(offer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/offers/:id/reject
// @desc    Reject offer
// @access  Private/HR
router.put('/:id/reject', protect, isHR, async (req, res) => {
    try {
        const offer = await Offer.findByIdAndUpdate(
            req.params.id,
            {
                status: 'Rejected',
                rejectedDate: new Date()
            },
            { new: true }
        ).populate('candidateId jobId');

        if (!offer) {
            return res.status(404).json({ message: 'Offer not found' });
        }

        // Update candidate status back to Evaluation
        await Candidate.findByIdAndUpdate(
            offer.candidateId,
            { status: 'Evaluation' }
        );

        res.json(offer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
