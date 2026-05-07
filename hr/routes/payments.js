const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const StudentFee = require('../models/StudentFee');
const Student = require('../models/Student');
const StudentCourse = require('../models/StudentCourse');
const ExcelJS = require('exceljs');

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR' && req.user.role !== 'Manager') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    next();
};

// @route   POST /api/payments/admin/add
// @desc    Record manual payment
router.post('/admin/add', protect, hrOnly, async (req, res) => {
    try {
        const { userId, courseId, amount, method, type } = req.body;
        
        // Normalize courseId: Mongoose fails if it's an empty string ""
        const normalizedCourseId = (courseId && courseId.trim() !== '') ? courseId : null;

        if (!userId || !amount || !method) {
            return res.status(400).json({ success: false, message: 'Please provide student, amount and method' });
        }

        // Calculate total previously paid
        const previousFees = await StudentFee.find({ student: userId, course: normalizedCourseId });
        const totalPaidPreviously = previousFees.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
        const currentTotalPaid = totalPaidPreviously + parseFloat(amount);
        
        // Get course fees for status check
        const course = await StudentCourse.findById(normalizedCourseId);
        const totalFees = course?.fees || 0;
        
        const status = (currentTotalPaid >= totalFees) ? 'Paid' : 'Partial';

        const payment = new StudentFee({
            student: userId,
            course: normalizedCourseId,
            amount: parseFloat(amount),
            paidAmount: parseFloat(amount),
            feeType: 'Tuition',
            installment: type || 'One-time',
            paymentMode: method.charAt(0).toUpperCase() + method.slice(1).toLowerCase(),
            status: status,
            paidDate: new Date()
        });

        await payment.save();

        // Update student status if needed (optional)
        const student = await Student.findById(userId);
        if (student && student.status !== 'Active') {
            student.status = 'Active';
            await student.save();
        }

        res.status(201).json({ success: true, data: payment });
    } catch (err) {
        console.error('Error in /admin/add:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// @route   GET /api/payments/admin/student-course/:userId
// @desc    Get student course and fee details for auto-fill
router.get('/admin/student-course/:userId', protect, hrOnly, async (req, res) => {
    try {
        const student = await Student.findById(req.params.userId).populate('course');
        
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        if (!student.course) {
            return res.status(404).json({ success: false, message: 'Student is not enrolled in any course' });
        }

        // Calculate total paid and remaining balance
        const fees = await StudentFee.find({ student: student._id, course: student.course._id });
        const paidAmount = fees.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
        const totalFees = student.course.fees || 0;
        const remainingAmount = Math.max(0, totalFees - paidAmount);

        res.json({
            success: true,
            data: {
                userId: student._id,
                courseId: student.course._id,
                courseTitle: student.course.courseName,
                fees: totalFees,
                paidAmount: paidAmount,
                remainingAmount: remainingAmount
            }
        });
    } catch (err) {
        console.error('Error in /admin/student-course:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// @route   GET /api/payments/admin/list
// @desc    Get all payments with filters
router.get('/admin/list', protect, hrOnly, async (req, res) => {
    try {
        const { status, month, year } = req.query;
        let query = {};

        // Filtering by Status
        if (status && status !== 'all') {
            // For listing, we might need to aggregate by student if we want one row per student
            // But the UI shows "Student List" in payments, suggesting "Payment Records"
            // If the UI shows "Remaining", it implies we might be calculating per student/course
        }

        // Date Filtering
        if (month || year) {
            const m = month ? parseInt(month) - 1 : 0;
            const y = year ? parseInt(year) : new Date().getFullYear();
            const start = new Date(y, m, 1);
            const end = month 
                ? new Date(y, m + 1, 0, 23, 59, 59) 
                : new Date(y, 11, 31, 23, 59, 59);
            
            query.paidDate = { $gte: start, $lte: end };
        }

        const payments = await StudentFee.find(query)
            .populate('student', 'name studentId')
            .populate('course', 'courseName fees duration')
            .sort({ paidDate: -1 });

        // Map to UI format
        const data = payments.map(p => {
            const total = p.course?.fees || 0;
            const paid = p.paidAmount || 0;
            const status = (p.status || 'Partial').toLowerCase();
            const method = (p.paymentMode || 'Cash').toLowerCase();

            // Formatted values for the UI
            const statusLabel = status === 'paid' ? '✅ Paid' : '⚠️ Partial';
            const methodLabel = method === 'cash' ? '💵 Cash' : method === 'upi' ? '📱 UPI' : '💳 Card';

            return {
                _id: p._id,
                name: p.student?.name || 'Unknown',
                course: p.course?.courseName || 'N/A',
                duration: p.course?.duration || '90 Days',
                totalFees: total,
                paidAmount: paid,
                pendingAmount: Math.max(0, total - paid),
                status: statusLabel,
                method: methodLabel,
                date: p.paidDate ? new Intl.DateTimeFormat('en-GB', { 
                    day: 'numeric', month: 'short', year: 'numeric', 
                    hour: 'numeric', minute: 'numeric', hour12: true 
                }).format(p.paidDate) : 'N/A'
            };
        });

        res.json({ success: true, count: data.length, data });
    } catch (err) {
        console.error('Error in /admin/list:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// @route   GET /api/payments/admin/report
// @desc    Advanced collection summary and transaction list
router.get('/admin/report', protect, hrOnly, async (req, res) => {
    try {
        const { month, year, startDate, endDate, userId, status } = req.query;
        let query = {};

        // 1. Date Filtering
        if (startDate || endDate) {
            query.paidDate = {};
            if (startDate) query.paidDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.paidDate.$lte = end;
            }
        } else if (month || year) {
            const m = month ? parseInt(month) - 1 : new Date().getMonth();
            const y = year ? parseInt(year) : new Date().getFullYear();
            const start = new Date(y, m, 1);
            const end = new Date(y, m + 1, 0, 23, 59, 59);
            query.paidDate = { $gte: start, $lte: end };
        }

        // 2. User ID Filtering
        if (userId && userId.trim() !== '') {
            query.student = userId;
        }

        // 3. Status Filtering
        if (status && status !== 'all') {
            query.status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        }

        const payments = await StudentFee.find(query)
            .populate('student', 'name studentId email')
            .populate('course', 'courseName fees duration')
            .sort({ paidDate: -1 });

        // Summary Stats
        const totalCollection = payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
        const totalStudents = await Student.countDocuments({ status: 'Active' });
        const paidStudentsSet = new Set(payments.map(p => p.student?._id?.toString()).filter(id => id));
        
        // Detailed Data for Table (Unified with /admin/list)
        const transactions = payments.map(p => {
            const total = p.course?.fees || 0;
            const paid = p.paidAmount || 0;
            const status = (p.status || 'Partial').toLowerCase();
            const method = (p.paymentMode || 'Cash').toLowerCase();

            // Formatted values for the UI
            const statusLabel = status === 'paid' ? '✅ Paid' : '⚠️ Partial';
            const methodLabel = method === 'cash' ? '💵 Cash' : method === 'upi' ? '📱 UPI' : '💳 Card';

            return {
                _id: p._id,
                name: p.student?.name || 'N/A',
                course: p.course?.courseName || 'N/A',
                duration: p.course?.duration || '90 Days',
                totalFees: total,
                paidAmount: paid,
                pendingAmount: Math.max(0, total - paid),
                status: statusLabel,
                method: methodLabel,
                date: p.paidDate ? new Intl.DateTimeFormat('en-GB', { 
                    day: 'numeric', month: 'short', year: 'numeric', 
                    hour: 'numeric', minute: 'numeric', hour12: true 
                }).format(p.paidDate) : 'N/A'
            };
        });

        res.json({ 
            success: true, 
            data: {
                totalStudents,
                paidStudents: paidStudentsSet.size,
                unpaidStudents: Math.max(0, totalStudents - paidStudentsSet.size),
                totalCollection,
                transactions: list
            } 
        });
    } catch (err) {
        console.error('Error in /admin/report:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// @route   GET /api/payments/admin/report/download
// @desc    Download payment report as Excel
router.get('/admin/report/download', protect, hrOnly, async (req, res) => {
    try {
        const { month, year, startDate, endDate, userId, status } = req.query;
        let query = {};
        
        // 1. Date Filtering
        if (startDate || endDate) {
            query.paidDate = {};
            if (startDate) query.paidDate.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.paidDate.$lte = end;
            }
        } else if (month || year) {
            const m = month ? parseInt(month) - 1 : 0;
            const y = year ? parseInt(year) : new Date().getFullYear();
            const start = new Date(y, m, 1);
            const end = month 
                ? new Date(y, m + 1, 0, 23, 59, 59) 
                : new Date(y, 11, 31, 23, 59, 59);
            query.paidDate = { $gte: start, $lte: end };
        }

        // 2. User ID Filtering
        if (userId && userId.trim() !== '') {
            query.student = userId;
        }

        // 3. Status Filtering
        if (status && status !== 'all') {
            query.status = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        }

        const payments = await StudentFee.find(query)
            .populate('student', 'name studentId email')
            .populate('course', 'courseName fees')
            .sort({ paidDate: -1 });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payment Report');

        worksheet.columns = [
            { header: 'Student Name', key: 'name', width: 25 },
            { header: 'Student ID', key: 'studentId', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Course', key: 'course', width: 25 },
            { header: 'Total Fees', key: 'total', width: 15 },
            { header: 'Amount Paid', key: 'paid', width: 15 },
            { header: 'Remaining', key: 'remaining', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Method', key: 'method', width: 15 },
            { header: 'Installment', key: 'installment', width: 20 },
            { header: 'Date', key: 'date', width: 15 }
        ];

        payments.forEach(p => {
            const total = p.course?.fees || 0;
            const paid = p.paidAmount || 0;
            worksheet.addRow({
                name: p.student?.name || 'N/A',
                studentId: p.student?.studentId || 'N/A',
                email: p.student?.email || 'N/A',
                course: p.course?.courseName || 'N/A',
                total: total,
                paid: paid,
                remaining: Math.max(0, total - paid),
                status: p.status,
                method: p.paymentMode,
                installment: p.installment || 'N/A',
                date: p.paidDate ? p.paidDate.toLocaleDateString() : 'N/A'
            });
        });

        // Styling the header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Payment_Report_${month || 'All'}_${year || 'All'}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Error in /admin/report/download:', err);
        res.status(500).json({ success: false, message: 'Download failed', error: err.message });
    }
});

module.exports = router;
