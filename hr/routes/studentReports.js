const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Student = require('../models/Student');
const StudentCourse = require('../models/StudentCourse');
const StudentAttendance = require('../models/StudentAttendance');
const StudentFee = require('../models/StudentFee');
const StudentLeave = require('../models/StudentLeave');
const StudentAssignment = require('../models/StudentAssignment');

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') return res.status(403).json({ message: 'Access denied. HR only.' });
    next();
};

// GET student list report
router.get('/students', protect, hrOnly, async (req, res) => {
    try {
        const { status, course } = req.query;
        const query = {};
        if (status) query.status = status;
        if (course) query.course = course;
        const students = await Student.find(query)
            .populate('course', 'courseName courseCode')
            .sort({ name: 1 });
        res.json({ type: 'students', data: students, generatedAt: new Date() });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET attendance report
router.get('/attendance', protect, hrOnly, async (req, res) => {
    try {
        const { startDate, endDate, course } = req.query;
        const matchStage = {};
        if (startDate && endDate) {
            matchStage.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        const report = await StudentAttendance.aggregate([
            { $match: matchStage },
            { $group: { _id: '$student', total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } }, late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } } } },
            { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'studentInfo' } },
            { $unwind: '$studentInfo' },
            { $project: { name: '$studentInfo.name', studentId: '$studentInfo.studentId', total: 1, present: 1, absent: 1, late: 1, percentage: { $round: [{ $multiply: [{ $divide: ['$present', { $max: ['$total', 1] }] }, 100] }, 1] } } },
            { $sort: { name: 1 } },
        ]);
        res.json({ type: 'attendance', data: report, generatedAt: new Date() });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET fee report
router.get('/fees', protect, hrOnly, async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status) query.status = status;
        const fees = await StudentFee.find(query)
            .populate('student', 'name studentId')
            .populate('course', 'courseName')
            .sort({ dueDate: 1 });
        const totalAmount = fees.reduce((sum, f) => sum + f.amount, 0);
        const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
        const totalPending = totalAmount - totalPaid;
        res.json({ type: 'fees', data: fees, summary: { totalAmount, totalPaid, totalPending }, generatedAt: new Date() });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET leave report
router.get('/leaves', protect, hrOnly, async (req, res) => {
    try {
        const { status, startDate, endDate } = req.query;
        const query = {};
        if (status) query.status = status;
        if (startDate && endDate) {
            query.startDate = { $gte: new Date(startDate) };
            query.endDate = { $lte: new Date(endDate) };
        }
        const leaves = await StudentLeave.find(query)
            .populate('student', 'name studentId')
            .sort({ startDate: -1 });
        res.json({ type: 'leaves', data: leaves, generatedAt: new Date() });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET course report
router.get('/courses', protect, hrOnly, async (req, res) => {
    try {
        const courses = await StudentCourse.find()
            .populate('enrolledStudents', 'name studentId status')
            .sort({ courseName: 1 });
        res.json({ type: 'courses', data: courses, generatedAt: new Date() });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET overall performance report
router.get('/performance', protect, hrOnly, async (req, res) => {
    try {
        const students = await Student.find({ status: 'Active' }).populate('course', 'courseName');

        const performanceData = await Promise.all(students.map(async (s) => {
            const attTotal = await StudentAttendance.countDocuments({ student: s._id });
            const attPresent = await StudentAttendance.countDocuments({ student: s._id, status: 'Present' });
            const feesPending = await StudentFee.countDocuments({ student: s._id, status: { $in: ['Pending', 'Overdue', 'Partial'] } });
            const leavesTotal = await StudentLeave.countDocuments({ student: s._id, status: 'Approved' });
            return {
                studentId: s.studentId,
                name: s.name,
                course: s.course?.courseName || '—',
                attendancePercentage: attTotal ? Math.round((attPresent / attTotal) * 100) : 0,
                feesPending,
                leavesApproved: leavesTotal,
            };
        }));

        res.json({ type: 'performance', data: performanceData, generatedAt: new Date() });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
