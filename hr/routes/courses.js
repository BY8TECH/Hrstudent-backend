const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const CourseCategory = require('../models/CourseCategory');
const { uploadCourseCategory } = require('../middleware/uploadMiddleware');

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') return res.status(403).json({ message: 'Access denied. HR only.' });
    next();
};

// POST create course (Handles both JSON and FormData)
// Alias: /categories/list to match frontend courseAPI.addCategory
router.post(['/categories', '/categories/list', '/'], protect, hrOnly, uploadCourseCategory, async (req, res) => {
    try {
        const { name, description, imageUrl, fees, categoryId } = req.body;

        if (!name || !categoryId) {
            return res.status(400).json({ success: false, message: 'name and categoryId are required' });
        }
        
        const courseData = { name, description, imageUrl, fees, categoryId };

        // If a file was uploaded, construct its path. This overrides a text imageUrl if provided.
        if (req.file) {
            courseData.imageUrl = `uploads/courses/categories/${req.file.filename}`;
        }

        const course = new CourseCategory(courseData);
        await course.save();
        res.status(201).json({ success: true, data: course });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'Course already exists' });
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// GET all courses
// Alias: /categories/list to match frontend courseAPI.getAllCourses
router.get(['/categories', '/categories/list'], protect, async (req, res) => {
    try {
        const courses = await CourseCategory.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: courses
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// GET category names for dropdown
router.get('/categories/names', protect, async (req, res) => {
    try {
        res.json({
            success: true,
            data: ["AI", "Web Development"]
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
