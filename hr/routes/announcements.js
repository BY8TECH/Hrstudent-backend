const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');
const { uploadAnnouncementFiles } = require('../middleware/uploadMiddleware');

// Helper function to send notifications to all employees
const notifyAllEmployees = async (title, message, actionUrl) => {
    try {
        // Get all active users who are not HR
        const employees = await User.find({
            isApproved: true,
            role: { $in: ['Employee', 'Manager'] }
        });

        // Create notifications for all employees
        const notifications = employees.map(employee => ({
            recipientId: employee._id,
            type: 'Announcement',
            title: title,
            message: message,
            priority: 'Medium',
            actionUrl: actionUrl
        }));

        await Notification.insertMany(notifications);
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
};

// @route   GET /api/announcements
// @desc    Get all active announcements
// @access  Private (All authenticated users)
router.get('/', protect, async (req, res) => {
    try {
        const announcements = await Announcement.find({ isActive: true })
            .populate('createdBy', 'firstName lastName email')
            .sort({ createdAt: -1 });

        res.json(announcements);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/announcements/:id
// @desc    Get single announcement
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id)
            .populate('createdBy', 'firstName lastName email');

        if (!announcement || !announcement.isActive) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        res.json(announcement);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/announcements
// @desc    Create new announcement
// @access  Private/HR
router.post('/', protect, isHR, uploadAnnouncementFiles, async (req, res) => {
    try {
        const { title, message } = req.body;

        // Validate that at least title is provided
        if (!title || title.trim() === '') {
            return res.status(400).json({ message: 'Title is required' });
        }

        // Get uploaded file paths
        const images = req.files?.images?.map(file => file.path) || [];
        const videos = req.files?.videos?.map(file => file.path) || [];

        // Create announcement
        const announcement = await Announcement.create({
            title: title.trim(),
            message: message?.trim() || '',
            images,
            videos,
            createdBy: req.user._id
        });

        // Populate creator info
        await announcement.populate('createdBy', 'firstName lastName email');

        // Send notifications to all employees
        await notifyAllEmployees(
            'New Announcement',
            `${title}`,
            '/announcements'
        );

        res.status(201).json(announcement);
    } catch (error) {
        console.error('[Announcement POST] Error:', error.name, error.message, error.stack);
        res.status(500).json({ message: error.message, detail: error.name });
    }
});

// @route   PUT /api/announcements/:id
// @desc    Update announcement
// @access  Private/HR
router.put('/:id', protect, isHR, uploadAnnouncementFiles, async (req, res) => {
    try {
        const { title, message, removedImages, removedVideos } = req.body;

        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        // Update fields
        if (title) announcement.title = title.trim();
        if (message !== undefined) announcement.message = message.trim();

        // Handle removed files
        if (removedImages) {
            const toRemove = JSON.parse(removedImages);
            announcement.images = announcement.images.filter(img => !toRemove.includes(img));
        }

        if (removedVideos) {
            const toRemove = JSON.parse(removedVideos);
            announcement.videos = announcement.videos.filter(vid => !toRemove.includes(vid));
        }

        // Add new uploaded files
        if (req.files?.images) {
            const newImages = req.files.images.map(file => file.path);
            announcement.images.push(...newImages);
        }

        if (req.files?.videos) {
            const newVideos = req.files.videos.map(file => file.path);
            announcement.videos.push(...newVideos);
        }

        await announcement.save();
        await announcement.populate('createdBy', 'firstName lastName email');

        // Send update notification to all employees
        await notifyAllEmployees(
            'Announcement Updated',
            `${announcement.title}`,
            '/announcements'
        );

        res.json(announcement);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/announcements/:id
// @desc    Soft delete announcement
// @access  Private/HR
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        // Soft delete
        announcement.isActive = false;
        await announcement.save();

        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
