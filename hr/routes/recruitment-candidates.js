const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Candidate = require('../models/Candidate');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// Configure multer for resume upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/resumes');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'resume-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// @route   GET /api/recruitment/candidates
// @desc    Get all candidates
// @access  Private/HR
router.get('/', protect, isHR, async (req, res) => {
    try {
        const { jobId, status } = req.query;
        let query = {};

        if (jobId) query.jobId = jobId;
        if (status) query.status = status;

        const candidates = await Candidate.find(query)
            .populate('jobId', 'jobId title department')
            .populate('screening.screenedBy', 'username')
            .sort({ createdAt: -1 });

        res.json(candidates);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/recruitment/candidates/:id
// @desc    Get single candidate
// @access  Private/HR
router.get('/:id', protect, isHR, async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id)
            .populate('jobId', 'jobId title department')
            .populate('screening.screenedBy', 'username email');

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/recruitment/candidates
// @desc    Add candidate
// @access  Private/HR
router.post('/', protect, isHR, async (req, res) => {
    try {
        const candidate = await Candidate.create(req.body);
        res.status(201).json(candidate);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/candidates/:id
// @desc    Update candidate
// @access  Private/HR
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/recruitment/candidates/:id/resume
// @desc    Upload candidate resume
// @access  Private/HR
router.post('/:id/resume', protect, isHR, upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            {
                resume: {
                    fileName: req.file.originalname,
                    filePath: req.file.path,
                    uploadedBy: req.user._id,
                    uploadedDate: new Date()
                }
            },
            { new: true }
        );

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        res.json({ message: 'Resume uploaded successfully', candidate });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/recruitment/candidates/:id/resume
// @desc    Download candidate resume
// @access  Private/HR or Assigned Interviewer
router.get('/:id/resume', protect, async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id);

        if (!candidate || !candidate.resume || !candidate.resume.filePath) {
            return res.status(404).json({ message: 'Resume not found' });
        }

        // Check access: HR or assigned interviewer
        const Interview = require('../models/Interview');
        const isAssignedInterviewer = await Interview.findOne({
            candidateId: req.params.id,
            assignedInterviewer: req.user._id
        });

        if (req.user.role !== 'HR' && !isAssignedInterviewer) {
            return res.status(403).json({ message: 'Access denied. Only HR or assigned interviewer can download resume.' });
        }

        res.download(candidate.resume.filePath, candidate.resume.fileName);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/candidates/:id/screen
// @desc    Screen/shortlist candidate
// @access  Private/HR
router.put('/:id/screen', protect, isHR, async (req, res) => {
    try {
        const { shortlisted, comments } = req.body;

        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            {
                'screening.screenedBy': req.user._id,
                'screening.shortlisted': shortlisted,
                'screening.comments': comments,
                'screening.date': new Date(),
                status: shortlisted ? 'Interview' : 'Rejected'
            },
            { new: true }
        ).populate('jobId', 'jobId title');

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/recruitment/candidates/:id/status
// @desc    Update candidate status
// @access  Private/HR
router.put('/:id/status', protect, isHR, async (req, res) => {
    try {
        const { status } = req.body;

        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('jobId', 'jobId title');

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/recruitment/candidates/:id
// @desc    Delete candidate
// @access  Private/HR
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const candidate = await Candidate.findByIdAndDelete(req.params.id);

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        res.json({ message: 'Candidate deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

