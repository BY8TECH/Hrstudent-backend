const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');
const Employee = require('../models/Employee');
const { Leave } = require('../models/Leave');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const StudentCourse = require('../models/StudentCourse');
const StudentAttendance = require('../models/StudentAttendance');
const StudentLeave = require('../models/StudentLeave');
const StudentAssignment = require('../models/StudentAssignment');

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
    try {
        const stats = {};

        // Total Employees
        const totalEmployees = await Employee.countDocuments({ isActive: true });
        stats.totalEmployees = totalEmployees;

        // Pending Leaves (only for HR/Manager)
        if (req.user.role === 'HR' || req.user.role === 'Manager') {
            const pendingLeaves = await Leave.countDocuments({ status: 'Pending' });
            stats.pendingLeaves = pendingLeaves;
        } else {
            stats.pendingLeaves = 0;
        }

        // Attendance Rate (for current month)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const workingDays = endOfMonth.getDate();

        const totalAttendance = await Attendance.countDocuments({
            date: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $in: ['Present', 'Work From Home'] }
        });

        const expectedAttendance = totalEmployees * workingDays;
        const attendanceRate = expectedAttendance > 0
            ? ((totalAttendance / expectedAttendance) * 100).toFixed(1)
            : 0;

        stats.attendanceRate = attendanceRate;

        // Monthly Payroll (placeholder - will be real when payroll is processed)
        stats.monthlyPayroll = '0';

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/dashboard/admin/overall
// @desc    Get overall student portal dashboard stats
// @access  Private (Admin/HR)
router.get('/admin/overall', protect, async (req, res) => {
    try {
        const [
            totalStudents,
            pendingApprovals,
            totalCourses,
            totalAttendance,
            presentCount,
            totalLeaves,
            pendingLeaves,
            approvedLeaves,
            totalTasks
        ] = await Promise.all([
            Student.countDocuments({ isApproved: true }),
            Student.countDocuments({ isApproved: false }),
            StudentCourse.countDocuments(),
            StudentAttendance.countDocuments(),
            StudentAttendance.countDocuments({ status: 'Present' }),
            StudentLeave.countDocuments(),
            StudentLeave.countDocuments({ status: 'Pending' }),
            StudentLeave.countDocuments({ status: 'Approved' }),
            StudentAssignment.countDocuments()
        ]);

        res.json({
            success: true,
            data: {
                users: {
                    totalStudents,
                    pendingApprovals
                },
                courses: {
                    total: totalCourses
                },
                attendance: {
                    totalRecords: totalAttendance,
                    averagePercentage: totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0
                },
                leave: {
                    total: totalLeaves,
                    pending: pendingLeaves,
                    approved: approvedLeaves
                },
                tasks: {
                    total: totalTasks
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
