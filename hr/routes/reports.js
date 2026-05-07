const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const Candidate = require('../models/Candidate');
const Interview = require('../models/Interview');
const Performance = require('../models/Performance');

// Middleware to check report access
const checkReportAccess = (reportType) => {
    return async (req, res, next) => {
        const { role, department, employeeId } = req.user;

        // HR has full access to all reports
        if (role === 'HR') {
            return next();
        }

        // Check report-specific access
        switch (reportType) {
            case 'employee':
                // Manager: department only, Employee: no access
                if (role === 'Manager') {
                    req.departmentFilter = department;
                    return next();
                }
                return res.status(403).json({ message: 'Access denied' });

            case 'attendance':
            case 'payroll':
            case 'performance':
                // Manager: department, Employee: own only
                if (role === 'Manager') {
                    req.departmentFilter = department;
                    return next();
                }
                if (role === 'Employee') {
                    req.employeeFilter = employeeId;
                    return next();
                }
                return res.status(403).json({ message: 'Access denied' });

            case 'recruitment':
                // HR only
                return res.status(403).json({ message: 'Access denied to recruitment reports' });

            default:
                return res.status(403).json({ message: 'Invalid report type' });
        }
    };
};

// ==================== EMPLOYEE REPORTS ====================

// @route   GET /api/reports/employees/list
// @desc    Get employee list with filters
// @access  Private (HR, Manager-department)
router.get('/employees/list', protect, checkReportAccess('employee'), async (req, res) => {
    try {
        const { department, status, search } = req.query;
        let query = {};

        // Apply department filter for managers
        if (req.departmentFilter) {
            query.department = req.departmentFilter;
        } else if (department) {
            query.department = department;
        }

        // Status filter
        if (status) {
            query.status = status;
        }

        // Search by name or employee ID
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { employeeId: { $regex: search, $options: 'i' } }
            ];
        }

        const employees = await Employee.find(query)
            .select('employeeId firstName lastName email department designation joiningDate status salary')
            .sort({ employeeId: 1 });

        res.json({
            success: true,
            count: employees.length,
            data: employees
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/reports/employees/department-wise
// @desc    Get employee count by department
// @access  Private (HR, Manager-department)
router.get('/employees/department-wise', protect, checkReportAccess('employee'), async (req, res) => {
    try {
        let matchStage = { status: 'Active' };

        // Apply department filter for managers
        if (req.departmentFilter) {
            matchStage.department = req.departmentFilter;
        }

        const departmentWise = await Employee.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 },
                    avgSalary: { $avg: '$salary' }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            success: true,
            data: departmentWise.map(d => ({
                department: d._id,
                employeeCount: d.count,
                averageSalary: Math.round(d.avgSalary || 0)
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/reports/employees/status
// @desc    Get active/inactive employee counts
// @access  Private (HR, Manager-department)
router.get('/employees/status', protect, checkReportAccess('employee'), async (req, res) => {
    try {
        let matchStage = {};

        // Apply department filter for managers
        if (req.departmentFilter) {
            matchStage.department = req.departmentFilter;
        }

        const statusCounts = await Employee.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            active: 0,
            inactive: 0,
            total: 0
        };

        statusCounts.forEach(s => {
            if (s._id === 'Active') result.active = s.count;
            else result.inactive += s.count;
            result.total += s.count;
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== ATTENDANCE REPORTS ====================

// @route   GET /api/reports/attendance/daily
// @desc    Get daily attendance report
// @access  Private (HR-all, Manager-dept, Employee-own)
router.get('/attendance/daily', protect, checkReportAccess('attendance'), async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ message: 'Date is required (YYYY-MM-DD)' });
        }

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        let query = {
            date: { $gte: startDate, $lte: endDate }
        };

        // Apply filters based on role
        if (req.employeeFilter) {
            query.employeeId = req.employeeFilter;
        }

        const attendance = await Attendance.find(query)
            .populate('employeeId', 'employeeId firstName lastName department')
            .sort({ 'employeeId.employeeId': 1 });

        // Get all employees for comparison
        let employeeQuery = { status: 'Active' };
        if (req.departmentFilter) {
            employeeQuery.department = req.departmentFilter;
        }
        if (req.employeeFilter) {
            employeeQuery._id = req.employeeFilter;
        }

        const allEmployees = await Employee.find(employeeQuery).select('_id employeeId firstName lastName department');
        const presentEmployeeIds = attendance.map(a => a.employeeId._id.toString());
        const absentEmployees = allEmployees.filter(e => !presentEmployeeIds.includes(e._id.toString()));

        // Count by status
        const presentCount = attendance.filter(a => a.status === 'Present').length;
        const lateCount = attendance.filter(a => a.status === 'Late').length;
        const halfDayCount = attendance.filter(a => a.status === 'Half Day').length;

        res.json({
            success: true,
            date,
            summary: {
                total: allEmployees.length,
                present: presentCount,
                late: lateCount,
                halfDay: halfDayCount,
                absent: absentEmployees.length
            },
            attendance: attendance.map(a => ({
                employeeId: a.employeeId.employeeId,
                name: `${a.employeeId.firstName} ${a.employeeId.lastName}`,
                department: a.employeeId.department,
                checkIn: a.checkIn,
                checkOut: a.checkOut,
                status: a.status,
                workHours: a.workHours
            })),
            absent: absentEmployees.map(e => ({
                employeeId: e.employeeId,
                name: `${e.firstName} ${e.lastName}`,
                department: e.department
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/reports/attendance/monthly
// @desc    Get monthly attendance summary
// @access  Private (HR-all, Manager-dept, Employee-own)
router.get('/attendance/monthly', protect, checkReportAccess('attendance'), async (req, res) => {
    try {
        const { month } = req.query; // Format: YYYY-MM
        if (!month) {
            return res.status(400).json({ message: 'Month is required (YYYY-MM)' });
        }

        const [year, monthNum] = month.split('-');
        const startDate = new Date(year, parseInt(monthNum) - 1, 1);
        const endDate = new Date(year, parseInt(monthNum), 0, 23, 59, 59);

        let matchStage = {
            date: { $gte: startDate, $lte: endDate }
        };

        // Build aggregation pipeline
        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'employees',
                    localField: 'employeeId',
                    foreignField: '_id',
                    as: 'employee'
                }
            },
            { $unwind: '$employee' }
        ];

        // Apply department filter for managers
        if (req.departmentFilter) {
            pipeline.push({
                $match: { 'employee.department': req.departmentFilter }
            });
        }

        // Apply employee filter for employees
        if (req.employeeFilter) {
            pipeline.push({
                $match: { 'employee._id': req.employeeFilter }
            });
        }

        pipeline.push({
            $group: {
                _id: '$employeeId',
                employeeId: { $first: '$employee.employeeId' },
                name: { $first: { $concat: ['$employee.firstName', ' ', '$employee.lastName'] } },
                department: { $first: '$employee.department' },
                totalDays: { $sum: 1 },
                presentDays: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'Present'] }, 1, 0]
                    }
                },
                lateDays: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'Late'] }, 1, 0]
                    }
                },
                halfDays: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'Half Day'] }, 1, 0]
                    }
                },
                totalWorkHours: { $sum: '$workHours' }
            }
        });

        pipeline.push({ $sort: { employeeId: 1 } });

        const monthlySummary = await Attendance.aggregate(pipeline);

        res.json({
            success: true,
            month,
            data: monthlySummary.map(s => ({
                employeeId: s.employeeId,
                name: s.name,
                department: s.department,
                totalDays: s.totalDays,
                presentDays: s.presentDays,
                lateDays: s.lateDays,
                halfDays: s.halfDays,
                totalWorkHours: Math.round(s.totalWorkHours * 10) / 10
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/reports/attendance/absent-late
// @desc    Get absent and late employees report
// @access  Private (HR-all, Manager-dept, Employee-own)
router.get('/attendance/absent-late', protect, checkReportAccess('attendance'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start date and end date are required' });
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        let matchStage = {
            date: { $gte: start, $lte: end },
            status: { $in: ['Late', 'Absent'] }
        };

        const pipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'employees',
                    localField: 'employeeId',
                    foreignField: '_id',
                    as: 'employee'
                }
            },
            { $unwind: '$employee' }
        ];

        if (req.departmentFilter) {
            pipeline.push({
                $match: { 'employee.department': req.departmentFilter }
            });
        }

        if (req.employeeFilter) {
            pipeline.push({
                $match: { 'employee._id': req.employeeFilter }
            });
        }

        pipeline.push({
            $project: {
                date: 1,
                employeeId: '$employee.employeeId',
                name: { $concat: ['$employee.firstName', ' ', '$employee.lastName'] },
                department: '$employee.department',
                status: 1,
                checkIn: 1
            }
        });

        pipeline.push({ $sort: { date: -1 } });

        const absentLate = await Attendance.aggregate(pipeline);

        res.json({
            success: true,
            startDate,
            endDate,
            count: absentLate.length,
            data: absentLate
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== PAYROLL REPORTS ====================

// @route   GET /api/reports/payroll/monthly
// @desc    Get monthly salary report
// @access  Private (HR-all, Manager-dept, Employee-own)
router.get('/payroll/monthly', protect, checkReportAccess('payroll'), async (req, res) => {
    try {
        const { month } = req.query; // Format: YYYY-MM
        if (!month) {
            return res.status(400).json({ message: 'Month is required (YYYY-MM)' });
        }

        const [year, monthNum] = month.split('-');
        let query = {
            month: parseInt(monthNum),
            year: parseInt(year)
        };

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'employeeId firstName lastName department bankAccount')
            .sort({ 'employeeId.employeeId': 1 });

        // Apply filters
        let filtered = payrolls;
        if (req.departmentFilter) {
            filtered = payrolls.filter(p => p.employeeId.department === req.departmentFilter);
        }
        if (req.employeeFilter) {
            filtered = payrolls.filter(p => p.employeeId._id.toString() === req.employeeFilter.toString());
        }

        res.json({
            success: true,
            month,
            totalRecords: filtered.length,
            totalGross: filtered.reduce((sum, p) => sum + p.grossSalary, 0),
            totalNet: filtered.reduce((sum, p) => sum + p.netSalary, 0),
            data: filtered.map(p => ({
                employeeId: p.employeeId.employeeId,
                name: `${p.employeeId.firstName} ${p.employeeId.lastName}`,
                department: p.employeeId.department,
                basicSalary: p.basicSalary,
                allowances: p.allowances,
                deductions: p.deductions,
                grossSalary: p.grossSalary,
                netSalary: p.netSalary,
                status: p.status
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/reports/payroll/lop
// @desc    Get Loss of Pay (LOP) report
// @access  Private (HR-all, Manager-dept, Employee-own)
router.get('/payroll/lop', protect, checkReportAccess('payroll'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate) : new Date();

        let query = {
            createdAt: { $gte: start, $lte: end },
            'deductions.lop': { $gt: 0 }
        };

        const lopPayrolls = await Payroll.find(query)
            .populate('employeeId', 'employeeId firstName lastName department')
            .sort({ createdAt: -1 });

        // Apply filters
        let filtered = lopPayrolls;
        if (req.departmentFilter) {
            filtered = lopPayrolls.filter(p => p.employeeId.department === req.departmentFilter);
        }
        if (req.employeeFilter) {
            filtered = lopPayrolls.filter(p => p.employeeId._id.toString() === req.employeeFilter.toString());
        }

        res.json({
            success: true,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            totalLOPAmount: filtered.reduce((sum, p) => sum + (p.deductions?.lop || 0), 0),
            data: filtered.map(p => ({
                employeeId: p.employeeId.employeeId,
                name: `${p.employeeId.firstName} ${p.employeeId.lastName}`,
                department: p.employeeId.department,
                month: `${p.year}-${p.month.toString().padStart(2, '0')}`,
                lopDays: p.lopDays || 0,
                lopAmount: p.deductions?.lop || 0,
                netSalary: p.netSalary
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/reports/payroll/bank-payment
// @desc   Get bank payment report for salary transfer
// @access  Private (HR only)
router.get('/payroll/bank-payment', protect, checkReportAccess('payroll'), async (req, res) => {
    try {
        const { month } = req.query;
        if (!month) {
            return res.status(400).json({ message: 'Month is required (YYYY-MM)' });
        }

        const [year, monthNum] = month.split('-');
        const payrolls = await Payroll.find({
            month: parseInt(monthNum),
            year: parseInt(year),
            status: 'Approved'
        }).populate('employeeId', 'employeeId firstName lastName bankAccount');

        res.json({
            success: true,
            month,
            totalAmount: payrolls.reduce((sum, p) => sum + p.netSalary, 0),
            data: payrolls.map(p => ({
                employeeId: p.employeeId.employeeId,
                name: `${p.employeeId.firstName} ${p.employeeId.lastName}`,
                accountNumber: p.employeeId.bankAccount?.accountNumber || 'N/A',
                ifscCode: p.employeeId.bankAccount?.ifscCode || 'N/A',
                bankName: p.employeeId.bankAccount?.bankName || 'N/A',
                amount: p.netSalary
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ==================== RECRUITMENT REPORTS ====================

// @route   GET /api/reports/recruitment/candidates
// @desc    Get candidate list with filters
// @access  Private (HR only)
router.get('/recruitment/candidates', protect, checkReportAccess('recruitment'), async (req, res) => {
    try {
        const { status, jobId, source } = req.query;
        let query = {};

        if (status) query.status = status;
        if (jobId) query.jobId = jobId;
        if (source) query.source = source;

        const candidates = await Candidate.find(query)
            .populate('jobId', 'jobId title department')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: candidates.length,
            data: candidates.map(c => ({
                candidateId: c.candidateId,
                name: `${c.firstName} ${c.lastName}`,
                email: c.email,
                phone: c.phone,
                jobTitle: c.jobId?.title || 'N/A',
                experience: c.experience,
                status: c.status,
                source: c.source,
                appliedDate: c.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/reports/recruitment/interviews
// @desc    Get interview schedule report
// @access  Private (HR only)
router.get('/recruitment/interviews', protect, checkReportAccess('recruitment'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = {};

        if (startDate && endDate) {
            query.scheduledDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const interviews = await Interview.find(query)
            .populate('candidateId', 'candidateId firstName lastName email phone')
            .populate('jobId', 'title')
            .populate('assignedInterviewer', 'firstName lastName')
            .sort({ scheduledDate: 1 });

        res.json({
            success: true,
            count: interviews.length,
            data: interviews.map(i => ({
                candidateName: `${i.candidateId.firstName} ${i.candidateId.lastName}`,
                jobTitle: i.jobId.title,
                round: i.round,
                scheduledDate: i.scheduledDate,
                scheduledTime: i.scheduledTime,
                mode: i.mode,
                interviewer: i.assignedInterviewer ? `${i.assignedInterviewer.firstName} ${i.assignedInterviewer.lastName}` : 'Not Assigned',
                status: i.status
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/reports/recruitment/selections
// @desc    Get selected/rejected candidates report
// @access  Private (HR only)
router.get('/recruitment/selections', protect, checkReportAccess('recruitment'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = {
            status: { $in: ['Hired', 'Rejected', 'Offered'] }
        };

        if (startDate && endDate) {
            query.updatedAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const candidates = await Candidate.find(query)
            .populate('jobId', 'title department')
            .sort({ updatedAt: -1 });

        const summary = {
            hired: candidates.filter(c => c.status === 'Hired').length,
            offered: candidates.filter(c => c.status === 'Offered').length,
            rejected: candidates.filter(c => c.status === 'Rejected').length
        };

        res.json({
            success: true,
            summary,
            data: candidates.map(c => ({
                candidateId: c.candidateId,
                name: `${c.firstName} ${c.lastName}`,
                jobTitle: c.jobId?.title || 'N/A',
                department: c.jobId?.department || 'N/A',
                status: c.status,
                experience: c.experience,
                decidedDate: c.updatedAt
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/reports/recruitment/interviewer-wise
// @desc    Get interviewer-wise report
// @access  Private (HR only)
router.get('/recruitment/interviewer-wise', protect, checkReportAccess('recruitment'), async (req, res) => {
    try {
        const interviewerStats = await Interview.aggregate([
            {
                $match: {
                    assignedInterviewer: { $exists: true, $ne: null }
                }
            },
            {
                $lookup: {
                    from: 'employees',
                    localField: 'assignedInterviewer',
                    foreignField: '_id',
                    as: 'interviewer'
                }
            },
            { $unwind: '$interviewer' },
            {
                $group: {
                    _id: '$assignedInterviewer',
                    interviewerName: {
                        $first: { $concat: ['$interviewer.firstName', ' ', '$interviewer.lastName'] }
                    },
                    department: { $first: '$interviewer.department' },
                    totalInterviews: { $sum: 1 },
                    completed: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0]
                        }
                    },
                    pending: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'Scheduled'] }, 1, 0]
                        }
                    }
                }
            },
            { $sort: { totalInterviews: -1 } }
        ]);

        res.json({
            success: true,
            data: interviewerStats
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
