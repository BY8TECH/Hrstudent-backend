const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Feedback = require('../models/Feedback');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// Create upload directories if they don't exist
const createUploadDirs = () => {
    const dirs = [
        'uploads/feedback/images',
        'uploads/feedback/videos'
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

createUploadDirs();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = file.mimetype.startsWith('image/')
            ? 'uploads/feedback/images'
            : 'uploads/feedback/videos';
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
    const allowedVideoTypes = /mp4|mov|avi|webm|mkv/;
    const extname = path.extname(file.originalname).toLowerCase();
    const mimetype = file.mimetype;

    const isImage = allowedImageTypes.test(extname) && mimetype.startsWith('image/');
    const isVideo = allowedVideoTypes.test(extname) && mimetype.startsWith('video/');

    if (isImage || isVideo) {
        cb(null, true);
    } else {
        cb(new Error('Only image and video files are allowed!'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// @route   GET /api/feedback
// @desc    Get all feedback (public feed)
// @access  Private (all authenticated users)
router.get('/', protect, async (req, res) => {
    try {
        const { category, status, sort = 'latest', search } = req.query;

        let query = {};

        // Filter by category
        if (category && category !== 'All') {
            query.category = category;
        }

        // Filter by status
        if (status && status !== 'All') {
            query.status = status;
        }

        // Search in subject and message
        if (search) {
            query.$or = [
                { subject: { $regex: search, $options: 'i' } },
                { message: { $regex: search, $options: 'i' } }
            ];
        }

        // Determine sort order
        let sortOption = {};
        switch (sort) {
            case 'latest':
                sortOption = { createdAt: -1 };
                break;
            case 'popular':
                // Sort by number of reactions (descending)
                sortOption = { 'reactions': -1, createdAt: -1 };
                break;
            case 'discussed':
                // Sort by number of comments (descending)
                sortOption = { 'comments': -1, createdAt: -1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        const feedbacks = await Feedback.find(query)
            .sort(sortOption)
            .populate('submittedBy', 'username email role')
            .populate('employeeId', 'firstName lastName employeeId')
            .populate('comments.userId', 'username email')
            .populate('reactions.userId', 'username email')
            .populate('officialResponse.respondedBy', 'username email');

        res.json(feedbacks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/feedback/:id
// @desc    Get single feedback with all details
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id)
            .populate('submittedBy', 'username email role')
            .populate('employeeId', 'firstName lastName employeeId')
            .populate('comments.userId', 'username email')
            .populate('reactions.userId', 'username email')
            .populate('officialResponse.respondedBy', 'username email');

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        res.json(feedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/feedback
// @desc    Create new feedback with media uploads
// @access  Private
router.post('/', protect, upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'videos', maxCount: 5 }
]), async (req, res) => {
    try {
        const { subject, message, category, tags } = req.body;

        const feedbackData = {
            submittedBy: req.user._id,
            employeeId: req.user.employeeId,
            subject,
            message,
            category: category || 'General',
            tags: tags ? JSON.parse(tags) : [],
            images: [],
            videos: []
        };

        // Handle uploaded images
        if (req.files && req.files.images) {
            feedbackData.images = req.files.images.map(file => `/${file.path.replace(/\\/g, '/')}`);
        }

        // Handle uploaded videos
        if (req.files && req.files.videos) {
            feedbackData.videos = req.files.videos.map(file => `/${file.path.replace(/\\/g, '/')}`);
        }

        const feedback = await Feedback.create(feedbackData);

        const populatedFeedback = await Feedback.findById(feedback._id)
            .populate('submittedBy', 'username email role')
            .populate('employeeId', 'firstName lastName employeeId');

        res.status(201).json(populatedFeedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/feedback/:id
// @desc    Update feedback (only own feedback or HR)
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        // Check if user owns the feedback or is HR
        const isOwner = feedback.submittedBy.toString() === req.user._id.toString();
        const isHRUser = req.user.role === 'HR';

        if (!isOwner && !isHRUser) {
            return res.status(403).json({ message: 'Not authorized to update this feedback' });
        }

        const { subject, message, category, tags } = req.body;

        if (subject) feedback.subject = subject;
        if (message) feedback.message = message;
        if (category) feedback.category = category;
        if (tags) feedback.tags = tags;

        await feedback.save();

        const updatedFeedback = await Feedback.findById(feedback._id)
            .populate('submittedBy', 'username email role')
            .populate('employeeId', 'firstName lastName employeeId');

        res.json(updatedFeedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/feedback/:id
// @desc    Delete feedback (only own feedback or HR)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        // Check if user owns the feedback or is HR
        const isOwner = feedback.submittedBy.toString() === req.user._id.toString();
        const isHRUser = req.user.role === 'HR';

        if (!isOwner && !isHRUser) {
            return res.status(403).json({ message: 'Not authorized to delete this feedback' });
        }

        await Feedback.findByIdAndDelete(req.params.id);

        res.json({ message: 'Feedback deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/feedback/:id/react
// @desc    Add or remove reaction to feedback
// @access  Private
router.post('/:id/react', protect, async (req, res) => {
    try {
        const { type } = req.body;
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        // Check if user already reacted
        const existingReactionIndex = feedback.reactions.findIndex(
            r => r.userId.toString() === req.user._id.toString()
        );

        if (existingReactionIndex > -1) {
            // If same type, remove reaction (toggle off)
            if (feedback.reactions[existingReactionIndex].type === type) {
                feedback.reactions.splice(existingReactionIndex, 1);
            } else {
                // If different type, update reaction
                feedback.reactions[existingReactionIndex].type = type;
                feedback.reactions[existingReactionIndex].createdAt = new Date();
            }
        } else {
            // Add new reaction
            feedback.reactions.push({
                userId: req.user._id,
                type,
                createdAt: new Date()
            });
        }

        await feedback.save();

        const updatedFeedback = await Feedback.findById(feedback._id)
            .populate('reactions.userId', 'username email');

        res.json(updatedFeedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/feedback/:id/comment
// @desc    Add comment to feedback
// @access  Private
router.post('/:id/comment', protect, async (req, res) => {
    try {
        const { text } = req.body;
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        feedback.comments.push({
            userId: req.user._id,
            text,
            createdAt: new Date()
        });

        await feedback.save();

        const updatedFeedback = await Feedback.findById(feedback._id)
            .populate('comments.userId', 'username email');

        res.json(updatedFeedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/feedback/:id/comment/:commentId
// @desc    Update comment (only own comment)
// @access  Private
router.put('/:id/comment/:commentId', protect, async (req, res) => {
    try {
        const { text } = req.body;
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        const comment = feedback.comments.id(req.params.commentId);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Check if user owns the comment
        if (comment.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this comment' });
        }

        comment.text = text;
        comment.updatedAt = new Date();

        await feedback.save();

        res.json(feedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/feedback/:id/comment/:commentId
// @desc    Delete comment (only own comment or HR)
// @access  Private
router.delete('/:id/comment/:commentId', protect, async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        const comment = feedback.comments.id(req.params.commentId);

        if (!comment) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Check if user owns the comment or is HR
        const isOwner = comment.userId.toString() === req.user._id.toString();
        const isHRUser = req.user.role === 'HR';

        if (!isOwner && !isHRUser) {
            return res.status(403).json({ message: 'Not authorized to delete this comment' });
        }

        comment.remove();
        await feedback.save();

        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/feedback/:id/view
// @desc    Increment view count
// @access  Private
router.post('/:id/view', protect, async (req, res) => {
    try {
        const feedback = await Feedback.findByIdAndUpdate(
            req.params.id,
            { $inc: { viewCount: 1 } },
            { new: true }
        );

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        res.json({ viewCount: feedback.viewCount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PATCH /api/feedback/:id/status
// @desc    Update feedback status (HR only)
// @access  Private/HR
router.patch('/:id/status', protect, isHR, async (req, res) => {
    try {
        const { status } = req.body;
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        feedback.status = status;
        await feedback.save();

        res.json(feedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/feedback/:id/official-response
// @desc    Add official HR response (HR only)
// @access  Private/HR
router.post('/:id/official-response', protect, isHR, async (req, res) => {
    try {
        const { text } = req.body;
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ message: 'Feedback not found' });
        }

        feedback.officialResponse = {
            text,
            respondedBy: req.user._id,
            respondedAt: new Date()
        };

        await feedback.save();

        const updatedFeedback = await Feedback.findById(feedback._id)
            .populate('officialResponse.respondedBy', 'username email');

        res.json(updatedFeedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
