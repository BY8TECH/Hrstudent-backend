const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Student = require('../models/Student');
const StudentCourse = require('../models/StudentCourse');

// HR-only middleware
const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') {
        return res.status(403).json({ message: 'Access denied. HR only.' });
    }
    next();
};

// GET all students (with search/filter)
router.get('/', protect, hrOnly, async (req, res) => {
    try {
        const { search, status, course, page = 1, limit = 50 } = req.query;
        const query = {};
        if (status) query.status = status;
        if (course) query.course = course;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { studentId: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }
        const students = await Student.find(query)
            .populate('course', 'courseName courseCode fees')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));
        const total = await Student.countDocuments(query);
        res.json({ students, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET single student
router.get('/:id', protect, hrOnly, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).populate('course', 'courseName courseCode faculty fees');
        if (!student) return res.status(404).json({ message: 'Student not found' });
        res.json(student);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST create student
router.post('/', protect, hrOnly, async (req, res) => {
    try {
        const student = new Student(req.body);
        await student.save();
        // If course provided, add to course enrolled list
        if (student.course) {
            await StudentCourse.findByIdAndUpdate(student.course, {
                $addToSet: { enrolledStudents: student._id },
            });
        }
        await student.populate('course', 'courseName courseCode fees');
        res.status(201).json(student);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Student ID or email already exists' });
        }
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update student
router.put('/:id', protect, hrOnly, async (req, res) => {
    try {
        const existing = await Student.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: 'Student not found' });

        // Handle course change - remove from old course, add to new
        if (req.body.course && String(existing.course) !== String(req.body.course)) {
            if (existing.course) {
                await StudentCourse.findByIdAndUpdate(existing.course, {
                    $pull: { enrolledStudents: existing._id },
                });
            }
            await StudentCourse.findByIdAndUpdate(req.body.course, {
                $addToSet: { enrolledStudents: existing._id },
            });
        }

        const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
            .populate('course', 'courseName courseCode fees');
        res.json(student);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE student
router.delete('/:id', protect, hrOnly, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        // Remove from course
        if (student.course) {
            await StudentCourse.findByIdAndUpdate(student.course, {
                $pull: { enrolledStudents: student._id },
            });
        }
        await Student.findByIdAndDelete(req.params.id);
        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update student status
router.put('/:id/status', protect, hrOnly, async (req, res) => {
    try {
        const { status } = req.body;
        const student = await Student.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!student) return res.status(404).json({ message: 'Student not found' });
        res.json(student);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST add document
router.post('/:id/documents', protect, hrOnly, async (req, res) => {
    try {
        const { name, url } = req.body;
        const student = await Student.findByIdAndUpdate(
            req.params.id,
            { $push: { documents: { name, url } } },
            { new: true }
        );
        if (!student) return res.status(404).json({ message: 'Student not found' });
        res.json(student);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET dashboard stats
router.get('/stats/summary', protect, hrOnly, async (req, res) => {
    try {
        const total = await Student.countDocuments();
        const active = await Student.countDocuments({ status: 'Active' });
        const inactive = await Student.countDocuments({ status: 'Inactive' });

        // Course-wise count
        const courseStats = await Student.aggregate([
            { $group: { _id: '$course', count: { $sum: 1 } } },
            { $lookup: { from: 'studentcourses', localField: '_id', foreignField: '_id', as: 'courseInfo' } },
            { $unwind: { path: '$courseInfo', preserveNullAndEmptyArrays: true } },
            { $project: { courseName: '$courseInfo.courseName', count: 1 } },
        ]);

        res.json({ total, active, inactive, courseStats });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
