const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const StudentAssignment = require('../models/StudentAssignment');
const Student = require('../models/Student');

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') return res.status(403).json({ message: 'Access denied. HR only.' });
    next();
};

// GET all assignments
router.get('/', protect, hrOnly, async (req, res) => {
    try {
        const { course, search } = req.query;
        const query = {};
        if (course) query.course = course;
        if (search) query.title = { $regex: search, $options: 'i' };
        const assignments = await StudentAssignment.find(query)
            .populate('course', 'courseName courseCode')
            .populate('uploadedBy', 'name')
            .populate('submittedStudents.student', 'name studentId')
            .sort({ dueDate: 1 });
        res.json(assignments);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET single assignment
router.get('/:id', protect, hrOnly, async (req, res) => {
    try {
        const assignment = await StudentAssignment.findById(req.params.id)
            .populate('course', 'courseName enrolledStudents')
            .populate('uploadedBy', 'name')
            .populate('submittedStudents.student', 'name studentId');
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
        res.json(assignment);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST create assignment
router.post('/', protect, hrOnly, async (req, res) => {
    try {
        const assignment = new StudentAssignment({ ...req.body, uploadedBy: req.user._id });
        await assignment.save();
        await assignment.populate('course', 'courseName');
        res.status(201).json(assignment);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update assignment
router.put('/:id', protect, hrOnly, async (req, res) => {
    try {
        const assignment = await StudentAssignment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
            .populate('course', 'courseName');
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
        res.json(assignment);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE assignment
router.delete('/:id', protect, hrOnly, async (req, res) => {
    try {
        await StudentAssignment.findByIdAndDelete(req.params.id);
        res.json({ message: 'Assignment deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT update submission status for a student
router.put('/:id/submission/:studentId', protect, hrOnly, async (req, res) => {
    try {
        const { status, marksObtained, notes, submittedAt } = req.body;
        const assignment = await StudentAssignment.findById(req.params.id);
        if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

        const subIndex = assignment.submittedStudents.findIndex(
            s => String(s.student) === req.params.studentId
        );
        if (subIndex >= 0) {
            assignment.submittedStudents[subIndex] = {
                ...assignment.submittedStudents[subIndex].toObject(),
                status, marksObtained, notes, submittedAt: submittedAt || new Date(),
            };
        } else {
            assignment.submittedStudents.push({
                student: req.params.studentId,
                status, marksObtained, notes,
                submittedAt: submittedAt || new Date(),
            });
        }
        await assignment.save();
        res.json(assignment);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
