const express = require('express');
const router = express.Router();
const Interview = require('../models/Interview');
const Candidate = require('../models/Candidate');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// @route   GET /api/recruitment/interviews/public-feed
// @desc    Get public interview feed (visible to all employees)
// @access  Private (All authenticated users)
router.get('/public-feed', protect, async (req, res) => {
    try {
        const interviews = await Interview.find({
            isPublic: true,
            status: { $in: ['Scheduled', 'Rescheduled'] }
        })
            .populate('candidateId', 'firstName lastName')
            .populate('jobId', 'title department')
            .populate('assignedInterviewer', 'username email')
            .select('candidateId jobId scheduledDate scheduledTime mode assignedInterviewer round')
            .sort({ scheduledDate: 1 });

        // Format for public view - limited info
        const publicFeed = interviews.map(interview => ({
            _id: interview._id,
            candidateName: `${interview.candidateId?.firstName} ${interview.candidateId?.lastName}` || 'N/A',
            jobTitle: interview.jobId?.title || 'N/A',
            interviewDate: interview.scheduledDate,
            interviewTime: interview.scheduledTime,
            mode: interview.mode,
            round: interview.round,
            assignedTo: interview.assignedInterviewer?.username || 'Not assigned',
            isAssignedToMe: interview.assignedInterviewer?._id.toString() === req.user._id.toString()
        }));

        res.json(publicFeed);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/recruitment/interviews/my-interviews
// @desc    Get interviews assigned to me
// @access  Private (Employee/HR)
router.get('/my-interviews', protect, async (req, res) => {
    try {
        const interviews = await Interview.find({
            assignedInterviewer: req.user._id
        })
            .populate('candidateId')
            .populate('jobId', 'title department location')
            .populate('interviewers', 'username email')
            .sort({ scheduledDate: 1 });

        res.json(interviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/recruitment/interviews/:id/candidate
// @desc    Get candidate profile for interview (HR or assigned interviewer only)
// @access  Private
router.get('/:id/candidate', protect, async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id)
            .populate('assignedInterviewer');

        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        // Check access: Only HR or assigned interviewer
        const isAssigned = interview.assignedInterviewer?._id.toString() === req.user._id.toString();
        if (req.user.role !== 'HR' && !isAssigned) {
            return res.status(403).json({
                message: 'Access denied. Only HR or assigned interviewer can view candidate profile.'
            });
        }

        // Get full candidate profile
        const candidate = await Candidate.findById(interview.candidateId)
            .populate('jobId');

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        // Track who viewed the profile
        if (!interview.viewedBy.includes(req.user._id)) {
            interview.viewedBy.push(req.user._id);
            await interview.save();
        }

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/recruitment/interviews
// @desc    Get all interviews (HR only)
// @access  Private/HR
router.get('/', protect, isHR, async (req, res) => {
    try {
        const { candidateId, status } = req.query;
        let query = {};

        if (candidateId) query.candidateId = candidateId;
        if (status) query.status = status;

        const interviews = await Interview.find(query)
            .populate('candidateId', 'candidateId firstName lastName email')
            .populate('jobId', 'jobId title')
            .populate('interviewers', 'username email')
            .populate('feedback.submittedBy', 'username')
            .sort({ scheduledDate: 1 });

        res.json(interviews);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/recruitment/interviews/:id
// @desc    Get single interview
// @access  Private/HR
router.get('/:id', protect, isHR, async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id)
            .populate('candidateId', 'candidateId firstName lastName email phone')
            .populate('jobId', 'jobId title department')
            .populate('interviewers', 'username email')
            .populate('assignedInterviewer', 'username email')
            .populate('feedback.submittedBy', 'username email');

        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        res.json(interview);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/recruitment/interviews
// @desc    Schedule interview with interviewer assignment
// @access  Private/HR
router.post('/', protect, isHR, async (req, res) => {
    try {
        const interviewData = {
            ...req.body,
            isPublic: true  // Always public by default
        };

        const interview = await Interview.create(interviewData);

        // Update candidate status
        await Candidate.findByIdAndUpdate(
            interview.candidateId,
            { status: 'Interview' }
        );

        const populatedInterview = await Interview.findById(interview._id)
            .populate('candidateId', 'candidateId firstName lastName email')
            .populate('jobId', 'jobId title')
            .populate('interviewers', 'username email')
            .populate('assignedInterviewer', 'username email');

        res.status(201).json(populatedInterview);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/interviews/:id
// @desc    Update/reschedule interview
// @access  Private/HR
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        const interview = await Interview.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )
            .populate('candidateId', 'candidateId firstName lastName')
            .populate('jobId', 'jobId title')
            .populate('interviewers', 'username')
            .populate('assignedInterviewer', 'username email');

        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        res.json(interview);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/interviews/:id/feedback
// @desc    Submit interview feedback (HR or assigned interviewer)
// @access  Private
router.put('/:id/feedback', protect, async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id);

        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        // Check access: HR or assigned interviewer
        const isAssigned = interview.assignedInterviewer?.toString() === req.user._id.toString();
        if (req.user.role !== 'HR' && !isAssigned) {
            return res.status(403).json({ message: 'Only assigned interviewer or HR can submit feedback' });
        }

        const feedbackData = {
            ...req.body,
            submittedBy: req.user._id,
            submittedDate: new Date()
        };

        interview.feedback = feedbackData;
        interview.status = 'Completed';
        await interview.save();

        // Update candidate status based on recommendation
        if (feedbackData.recommendation) {
            const newStatus = feedbackData.recommendation === 'Selected'
                ? 'Evaluation'
                : feedbackData.recommendation === 'Rejected'
                    ? 'Rejected'
                    : 'Interview';

            await Candidate.findByIdAndUpdate(
                interview.candidateId,
                { status: newStatus }
            );
        }

        const populatedInterview = await Interview.findById(interview._id)
            .populate('candidateId', 'candidateId firstName lastName')
            .populate('jobId', 'jobId title')
            .populate('feedback.submittedBy', 'username email');

        res.json(populatedInterview);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/recruitment/interviews/:id
// @desc    Cancel interview
// @access  Private/HR
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const interview = await Interview.findByIdAndUpdate(
            req.params.id,
            { status: 'Cancelled' },
            { new: true }
        );

        if (!interview) {
            return res.status(404).json({ message: 'Interview not found' });
        }

        res.json({ message: 'Interview cancelled successfully', interview });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
