const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const StudentCourse = require('../models/StudentCourse');
const Student = require('../models/Student');

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') return res.status(403).json({ message: 'Access denied. HR only.' });
    next();
};

// GET all courses
router.get('/', protect, hrOnly, async (req, res) => {
    try {
        const { status, search } = req.query;
        const query = {};
        if (status) query.status = status;
        if (search) query.$or = [
            { courseName: { $regex: search, $options: 'i' } },
            { courseCode: { $regex: search, $options: 'i' } },
            { faculty: { $regex: search, $options: 'i' } },
        ];
        const courses = await StudentCourse.find(query)
            .populate('enrolledStudents', 'name studentId')
            .sort({ createdAt: -1 });
        res.json(courses);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET single course
router.get('/:id', protect, hrOnly, async (req, res) => {
    try {
        const course = await StudentCourse.findById(req.params.id)
            .populate('enrolledStudents', 'name studentId email status');
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json(course);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST create course
router.post('/', protect, hrOnly, async (req, res) => {
    try {
        const course = new StudentCourse(req.body);
        await course.save();
        res.status(201).json(course);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'Course code already exists' });
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update course
router.put('/:id', protect, hrOnly, async (req, res) => {
    try {
        const course = await StudentCourse.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json(course);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE course
router.delete('/:id', protect, hrOnly, async (req, res) => {
    try {
        const course = await StudentCourse.findByIdAndDelete(req.params.id);
        if (!course) return res.status(404).json({ message: 'Course not found' });
        res.json({ message: 'Course deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST enroll student in course
router.post('/:id/enroll', protect, hrOnly, async (req, res) => {
    try {
        const { studentId } = req.body;
        const course = await StudentCourse.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { enrolledStudents: studentId } },
            { new: true }
        ).populate('enrolledStudents', 'name studentId');
        if (!course) return res.status(404).json({ message: 'Course not found' });
        // Update student's course reference
        await Student.findByIdAndUpdate(studentId, { course: req.params.id });
        res.json(course);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE remove student from course
router.delete('/:id/enroll/:studentId', protect, hrOnly, async (req, res) => {
    try {
        await StudentCourse.findByIdAndUpdate(req.params.id, {
            $pull: { enrolledStudents: req.params.studentId },
        });
        await Student.findByIdAndUpdate(req.params.studentId, { $unset: { course: '' } });
        res.json({ message: 'Student removed from course' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
