const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const { protect } = require('../middleware/auth');
const { isHR, isSelfOrHR } = require('../middleware/rbac');
const checkDataAccess = require('../middleware/checkDataAccess');

// @route   GET /api/attendance
// @desc    Get all attendance records
// @access  Private/HR
router.get('/', protect, isHR, async (req, res) => {
    try {
        const { startDate, endDate, employeeId } = req.query;
        let query = {};

        if (employeeId) query.employeeId = employeeId;
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const attendance = await Attendance.find(query)
            .populate('employeeId', 'firstName lastName employeeId')
            .sort({ date: -1 });

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/attendance/employee/:employeeId
// @desc    Get employee's attendance records
// @access  Private (Own data or HR)
router.get('/employee/:employeeId', protect, checkDataAccess, isSelfOrHR, async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = { employeeId: req.params.employeeId };

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            query.date = { $gte: startDate, $lte: endDate };
        }

        const attendance = await Attendance.find(query).sort({ date: -1 });
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/attendance/mark
// @desc    Mark own attendance (Employee self-service)
// @access  Private
router.post('/mark', protect, checkDataAccess, async (req, res) => {
    try {
        if (!req.user.employeeId) {
            return res.status(400).json({ message: 'User is not linked to an employee record' });
        }

        const { status, permissionFrom, permissionTo } = req.body;

        // ALWAYS use today's date - cannot mark for past or future
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // DEBUG: Log marking attempt
        console.log('📝 [/attendance/mark] Attempting to mark attendance');
        console.log('📝 [/attendance/mark] Date:', today);
        console.log('📝 [/attendance/mark] Employee ID:', req.user.employeeId);
        console.log('📝 [/attendance/mark] Status:', status);

        // Check if attendance already marked for today using date range
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const existingAttendance = await Attendance.findOne({
            employeeId: req.user.employeeId,
            date: {
                $gte: todayStart,
                $lt: todayEnd
            }
        });

        if (existingAttendance) {
            return res.status(400).json({
                message: `Attendance already marked as "${existingAttendance.status}" for today. You can only mark attendance once per day.`,
                alreadyMarked: true,
                status: existingAttendance.status
            });
        }

        // Create attendance record for TODAY only
        const attendanceData = {
            employeeId: req.user.employeeId,
            date: today,
            status: status || 'Present',
            checkIn: new Date(),
            markedBy: req.user._id,
            ...(status === 'Permission' && {
                permissionFrom: permissionFrom || '',
                permissionTo: permissionTo || ''
            })
        };

        const attendance = await Attendance.create(attendanceData);
        const populatedAttendance = await Attendance.findById(attendance._id)
            .populate('employeeId', 'firstName lastName employeeId');

        // DEBUG: Log successful creation
        console.log('✅ [/attendance/mark] Attendance created/updated successfully');
        console.log('✅ [/attendance/mark] ID:', attendance._id);
        console.log('✅ [/attendance/mark] Saved date:', attendance.date);
        console.log('✅ [/attendance/mark] Status:', attendance.status);

        res.status(201).json(populatedAttendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/attendance/today
// @desc    Get today's attendance status for logged-in employee
// @access  Private
router.get('/today', protect, async (req, res) => {
    try {
        if (!req.user.employeeId) {
            return res.status(400).json({ message: 'User is not linked to an employee record' });
        }

        // Use date range for today instead of exact match
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // DEBUG: Log the query parameters
        console.log('🔍 [/attendance/today] Query date range:', todayStart, 'to', todayEnd);
        console.log('🔍 [/attendance/today] Employee ID:', req.user.employeeId);

        const attendance = await Attendance.findOne({
            employeeId: req.user.employeeId,
            date: {
                $gte: todayStart,
                $lt: todayEnd
            }
        }).populate('employeeId', 'firstName lastName employeeId');

        // DEBUG: Log the result
        console.log('🔍 [/attendance/today] Found attendance:', attendance ? `ID: ${attendance._id}, Status: ${attendance.status}, Date: ${attendance.date}` : 'null');

        res.json(attendance);
    } catch (error) {
        console.error('❌ [/attendance/today] Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/attendance/my-stats
// @desc    Get attendance and leave stats for logged-in employee
// @access  Private
router.get('/my-stats', protect, checkDataAccess, async (req, res) => {
    try {
        const Employee = require('../models/Employee');
        const { Leave } = require('../models/Leave');

        const employee = await Employee.findOne({ email: req.user.email });
        if (!employee) {
            return res.status(404).json({ message: 'Employee record not found' });
        }

        // Get current month attendance
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        const attendance = await Attendance.find({
            employeeId: employee._id,
            date: { $gte: startOfMonth, $lte: endOfMonth }
        });

        // Calculate attendance stats for current month
        const attendanceStats = {
            present: attendance.filter(a => a.status === 'Present').length,
            absent: attendance.filter(a => a.status === 'Absent').length,
            permission: attendance.filter(a => a.status === 'Permission').length,
            halfDay: attendance.filter(a => a.status === 'Half Day').length,
        };

        // Get approved leaves for current year
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        const endOfYear = new Date(new Date().getFullYear(), 11, 31);

        const approvedLeaves = await Leave.find({
            employeeId: employee._id,
            status: 'Approved',
            startDate: { $gte: startOfYear, $lte: endOfYear }
        });

        // Calculate total leave days used this year
        const totalUsedLeave = approvedLeaves.reduce((sum, leave) => sum + (leave.numberOfDays || 0), 0);

        // Fixed leave allocation: 12 days per year
        const TOTAL_ANNUAL_LEAVE = 12;
        const remainingLeave = TOTAL_ANNUAL_LEAVE - totalUsedLeave;

        res.json({
            attendance: attendanceStats,
            leave: {
                totalLeave: TOTAL_ANNUAL_LEAVE,
                usedLeave: totalUsedLeave,
                remainingLeave: remainingLeave > 0 ? remainingLeave : 0
            }
        });
    } catch (error) {
        console.error('❌ [/attendance/my-stats] Error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/attendance
// @desc    Create attendance record
// @access  Private/HR
router.post('/', protect, isHR, async (req, res) => {
    try {
        // If no date provided, use today
        if (!req.body.date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            req.body.date = today;
        } else {
            // Validate provided date - only allow today's date
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const providedDate = new Date(req.body.date);
            providedDate.setHours(0, 0, 0, 0);

            // Only allow creating attendance for today
            if (providedDate.getTime() !== today.getTime()) {
                return res.status(403).json({
                    message: 'Attendance can only be created for today\'s date',
                    providedDate: providedDate.toISOString().split('T')[0],
                    today: today.toISOString().split('T')[0]
                });
            }
        }

        req.body.markedBy = req.user._id;
        const attendance = await Attendance.create(req.body);
        const populatedAttendance = await Attendance.findById(attendance._id)
            .populate('employeeId', 'firstName lastName employeeId');

        res.status(201).json(populatedAttendance);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Attendance already marked for this date' });
        }
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private/HR
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        // Find the existing attendance record
        const existingAttendance = await Attendance.findById(req.params.id);

        if (!existingAttendance) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        // Check if the attendance date is today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendanceDate = new Date(existingAttendance.date);
        attendanceDate.setHours(0, 0, 0, 0);

        // Only allow updates on the same day
        if (attendanceDate.getTime() !== today.getTime()) {
            return res.status(403).json({
                message: 'Attendance can only be updated on the same day it was marked',
                attendanceDate: attendanceDate.toISOString().split('T')[0],
                today: today.toISOString().split('T')[0]
            });
        }

        const attendance = await Attendance.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('employeeId', 'firstName lastName employeeId');

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PATCH /api/attendance/hr-edit/:id
// @desc    Edit attendance record (HR only - can edit any date)
// @access  Private/HR
router.patch('/hr-edit/:id', protect, isHR, async (req, res) => {
    try {
        const existingAttendance = await Attendance.findById(req.params.id);

        if (!existingAttendance) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        // HR can update any field, including status
        const updateData = {
            ...req.body,
            editedBy: req.user._id,
            editedAt: new Date()
        };

        const attendance = await Attendance.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('employeeId', 'firstName lastName employeeId');

        res.json(attendance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private/HR
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const attendance = await Attendance.findByIdAndDelete(req.params.id);

        if (!attendance) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        res.json({ message: 'Attendance record deleted successfully' });
    } catch (error) {
    }
});

// @route   POST /api/attendance/bulk-mark
// @desc    Bulk mark attendance for multiple employees
// @access  Private/HR
router.post('/bulk-mark', protect, isHR, async (req, res) => {
    try {
        const { attendanceRecords } = req.body; // Array of { employeeId, status, date }

        if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
            return res.status(400).json({ message: 'Please provide attendance records array' });
        }

        const results = {
            success: [],
            failed: [],
            skipped: []
        };

        for (const record of attendanceRecords) {
            const { employeeId, status, date, permissionFrom, permissionTo } = record;

            // Validate date
            const attendanceDate = date ? new Date(date) : new Date();
            attendanceDate.setHours(0, 0, 0, 0);

            try {
                // Check if attendance already exists
                const existingAttendance = await Attendance.findOne({
                    employeeId,
                    date: attendanceDate
                });

                if (existingAttendance) {
                    results.skipped.push({
                        employeeId,
                        reason: 'Attendance already marked for this date'
                    });
                    continue;
                }

                // Create attendance record
                const attendance = await Attendance.create({
                    employeeId,
                    date: attendanceDate,
                    status: status || 'Present',
                    checkIn: new Date(),
                    markedBy: req.user._id,
                    ...(status === 'Permission' && {
                        permissionFrom: permissionFrom || '',
                        permissionTo: permissionTo || ''
                    })
                });

                results.success.push(attendance);
            } catch (error) {
                results.failed.push({
                    employeeId,
                    error: error.message
                });
            }
        }

        res.status(201).json({
            message: `Successfully marked ${results.success.length} attendance records`,
            results
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/attendance/export
// @desc    Export attendance data as Excel file
// @access  Private/HR
router.get('/export', protect, isHR, async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const { startDate, endDate, employeeId } = req.query;

        let query = {};

        if (employeeId) query.employeeId = employeeId;
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const attendance = await Attendance.find(query)
            .populate('employeeId', 'employeeId firstName lastName department')
            .sort({ date: -1, employeeId: 1 });

        if (attendance.length === 0) {
            return res.status(404).json({ message: 'No attendance records found for the selected criteria' });
        }

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance Records');

        // Define columns
        worksheet.columns = [
            { header: 'Employee ID', key: 'empId', width: 15 },
            { header: 'Employee Name', key: 'name', width: 25 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Check-in Time', key: 'checkIn', width: 18 },
            { header: 'Total Hours', key: 'totalHours', width: 12 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add data rows
        attendance.forEach(record => {
            worksheet.addRow({
                empId: record.employeeId?.employeeId || 'N/A',
                name: record.employeeId ? `${record.employeeId.firstName} ${record.employeeId.lastName}` : 'N/A',
                department: record.employeeId?.department || 'N/A',
                date: new Date(record.date).toLocaleDateString('en-IN'),
                status: record.status,
                checkIn: record.checkIn ? new Date(record.checkIn).toLocaleString('en-IN') : '-',
                totalHours: record.totalHours || 0
            });
        });

        // Add summary sheet
        const summarySheet = workbook.addWorksheet('Summary');

        // Calculate summary statistics
        const employeeStats = {};
        attendance.forEach(record => {
            const empId = record.employeeId?._id.toString();
            if (!empId) return;

            if (!employeeStats[empId]) {
                employeeStats[empId] = {
                    empId: record.employeeId.employeeId,
                    name: `${record.employeeId.firstName} ${record.employeeId.lastName}`,
                    totalDays: 0,
                    present: 0,
                    absent: 0
                };
            }

            employeeStats[empId].totalDays++;
            if (record.status === 'Present') employeeStats[empId].present++;
            if (record.status === 'Absent') employeeStats[empId].absent++;
        });

        // Define summary columns
        summarySheet.columns = [
            { header: 'Employee ID', key: 'empId', width: 15 },
            { header: 'Employee Name', key: 'name', width: 25 },
            { header: 'Total Days', key: 'totalDays', width: 12 },
            { header: 'Present', key: 'present', width: 12 },
            { header: 'Absent', key: 'absent', width: 12 },
            { header: 'Attendance %', key: 'percentage', width: 15 }
        ];

        // Style summary header
        summarySheet.getRow(1).font = { bold: true };
        summarySheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF70AD47' }
        };
        summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Add summary data
        Object.values(employeeStats).forEach(stat => {
            const percentage = stat.totalDays > 0
                ? ((stat.present / stat.totalDays) * 100).toFixed(2)
                : 0;
            summarySheet.addRow({
                empId: stat.empId,
                name: stat.name,
                totalDays: stat.totalDays,
                present: stat.present,
                absent: stat.absent,
                percentage: `${percentage}%`
            });
        });

        // Set response headers for file download
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=attendance-report-${Date.now()}.xlsx`
        );

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/attendance/monthly-summary
// @desc    Get monthly attendance summary
// @access  Private/HR
router.get('/monthly-summary', protect, isHR, async (req, res) => {
    try {
        const { month, year } = req.query;

        if (!month || !year) {
            return res.status(400).json({ message: 'Please provide month and year' });
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const attendance = await Attendance.find({
            date: { $gte: startDate, $lte: endDate }
        }).populate('employeeId', 'employeeId firstName lastName department');

        // Group by employee
        const summary = {};
        attendance.forEach(record => {
            const empId = record.employeeId?._id.toString();
            if (!empId) return;

            if (!summary[empId]) {
                summary[empId] = {
                    employeeId: record.employeeId.employeeId,
                    firstName: record.employeeId.firstName,
                    lastName: record.employeeId.lastName,
                    department: record.employeeId.department,
                    totalDays: 0,
                    present: 0,
                    absent: 0,
                    halfDay: 0,
                    workFromHome: 0,
                    onLeave: 0,
                    attendanceRecords: []
                };
            }

            summary[empId].totalDays++;
            summary[empId].attendanceRecords.push({
                date: record.date,
                status: record.status,
                checkIn: record.checkIn,
                totalHours: record.totalHours
            });

            switch (record.status) {
                case 'Present': summary[empId].present++; break;
                case 'Absent': summary[empId].absent++; break;
                case 'Half Day': summary[empId].halfDay++; break;
                case 'Work From Home': summary[empId].workFromHome++; break;
                case 'On Leave': summary[empId].onLeave++; break;
            }
        });

        // Calculate percentages
        Object.values(summary).forEach(emp => {
            emp.attendancePercentage = emp.totalDays > 0
                ? ((emp.present + emp.workFromHome) / emp.totalDays * 100).toFixed(2)
                : 0;
        });

        res.json({
            month: parseInt(month),
            year: parseInt(year),
            totalEmployees: Object.keys(summary).length,
            summary: Object.values(summary)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
