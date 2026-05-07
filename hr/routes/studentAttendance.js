const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const { protect } = require('../middleware/auth');
const StudentAttendance = require('../models/StudentAttendance');

// ─── Nodemailer transporter (re-uses existing SMTP env vars) ───────────────
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER || process.env.FROM_EMAIL,
        pass: process.env.SMTP_PASS,
    },
});

const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') return res.status(403).json({ message: 'Access denied. HR only.' });
    next();
};

// Helper: UTC date range for a given date string (e.g., '2026-03-02')
const dayStart = (d) => new Date(d + 'T00:00:00.000Z');
const dayEnd   = (d) => new Date(d + 'T23:59:59.999Z');

// ─── GET overall summary for dashboard (Total stats) ───────────────────────
router.get('/summary', protect, async (req, res) => {
    try {
        const records = await StudentAttendance.find({});
        
        // Group by user ID
        const userSummary = {};
        records.forEach(r => {
            const userId = r.student.toString();
            if (!userSummary[userId]) {
                userSummary[userId] = {
                    totalDays: 0,
                    presentCount: 0,
                    absentCount: 0,
                    holidayCount: 0,
                };
            }
            userSummary[userId].totalDays++;
            if (r.status === 'Present') userSummary[userId].presentCount++;
            if (r.status === 'Absent') userSummary[userId].absentCount++;
            if (r.status === 'Holiday') userSummary[userId].holidayCount++;
        });
        
        // Calculate percentages
        const finalSummary = Object.keys(userSummary).map(userId => {
            const data = userSummary[userId];
            data.attendancePercentage = data.totalDays > 0 
                ? (data.presentCount / data.totalDays) * 100 
                : 0;
            return {
                userId,
                ...data
            };
        });

        res.json({
            success: true,
            data: finalSummary
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET all attendance records (with filters) ─────────────────────────────
router.get('/', protect, hrOnly, async (req, res) => {
    try {
        const { date, course, student, startDate, endDate } = req.query;
        const query = {};
        if (student) query.student = new mongoose.Types.ObjectId(student);
        if (course)  query.course  = new mongoose.Types.ObjectId(course);
        if (date) {
            query.date = { $gte: dayStart(date), $lte: dayEnd(date) };
        } else if (startDate && endDate) {
            query.date = { $gte: dayStart(startDate), $lte: dayEnd(endDate) };
        }
        const records = await StudentAttendance.find(query)
            .populate('student', 'name studentId')
            .populate('course', 'courseName courseCode')
            .sort({ date: -1 });
        res.json(records);
    } catch (err) {
        console.error('GET attendance error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /bulk — save attendance for a date ───────────────────────────────
router.post('/bulk', protect, hrOnly, async (req, res) => {
    try {
        const { date, course, records } = req.body;
        if (!date || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ message: 'date and records are required' });
        }

        const storedDate = dayStart(date);                              // UTC midnight
        const courseId   = course ? new mongoose.Types.ObjectId(course) : null;
        const savedBy    = req.user._id;

        let saved = 0;
        for (const r of records) {
            if (!r.student) continue;
            const studentId = new mongoose.Types.ObjectId(r.student);  // explicit cast

            await StudentAttendance.findOneAndUpdate(
                { student: studentId, date: storedDate },               // match filter
                {
                    $set: {
                        status:   r.status || 'Absent',
                        course:   courseId,
                        notes:    r.notes  || '',
                        markedBy: savedBy,
                    },
                },
                { upsert: true, new: true }
            );
            saved++;
        }

        console.log(`[Attendance] Saved ${saved} records for ${date} (stored as ${storedDate.toISOString()})`);
        res.json({ message: `Attendance saved for ${saved} students`, saved });
    } catch (err) {
        console.error('[Attendance] Bulk save error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── POST / — mark single student attendance ───────────────────────────────
router.post('/', protect, hrOnly, async (req, res) => {
    try {
        const { student, date, status, course, notes } = req.body;
        const record = await StudentAttendance.findOneAndUpdate(
            { student: new mongoose.Types.ObjectId(student), date: dayStart(date) },
            { $set: { status, course: course || null, notes: notes || '', markedBy: req.user._id } },
            { upsert: true, new: true }
        ).populate('student', 'name studentId');
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Mark Attendance by User ID (POST /:userId) ───────────────────────────
router.post('/:userId', protect, hrOnly, async (req, res) => {
    try {
        const { date, status, courseId, remarks } = req.body;
        const userId = req.params.userId;

        if (!date || !status) {
            return res.status(400).json({ message: 'Date and status are required' });
        }

        // Normalize status
        let normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        if (!['Present', 'Absent', 'Holiday'].includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Status must be one of: present, absent, holiday' });
        }

        // Check if already marked — return 409 so UI can show the right message
        const existing = await StudentAttendance.findOne({
            student: new mongoose.Types.ObjectId(userId),
            date: dayStart(date)
        });
        if (existing) {
            return res.status(409).json({ message: 'Attendance already marked. Use Edit option.' });
        }

        const record = await StudentAttendance.create({
            student: new mongoose.Types.ObjectId(userId),
            date: dayStart(date),
            status: normalizedStatus,
            course: courseId || null,
            notes: remarks || '',
            markedBy: req.user._id
        });

        const populated = await record.populate('student', 'name studentId');
        res.json(populated);
    } catch (err) {
        console.error('Mark attendance error:', err.message);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation Error', errors: err.errors });
        }
        res.status(500).json({ message: err.message });
    }
});

// ─── Request Edit (OTP) ─ POST /:userId/request-edit ──────────────────────
router.post('/:userId/request-edit', protect, async (req, res) => {
    try {
        const { date, courseId } = req.body;
        const userId = req.params.userId;

        if (!date) return res.status(400).json({ message: 'Date is required' });

        const record = await StudentAttendance.findOne({
            student: new mongoose.Types.ObjectId(userId),
            date: dayStart(date)
        });
        if (!record) {
            return res.status(404).json({ message: 'No attendance record found for this date. Mark attendance first.' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        record.otp = otp;
        record.otpExpiry = otpExpiry;
        if (courseId) record.pendingEdit = { courseId };
        await record.save();

        // Send OTP email to HR
        const hrEmail = process.env.SMTP_USER || process.env.FROM_EMAIL || 'hr@by8labs.com';
        await transporter.sendMail({
            from: `"HR System" <${hrEmail}>`,
            to: hrEmail,
            subject: '🔐 Attendance Edit OTP',
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:auto;border:1px solid #e0e0e0;overflow:hidden">
                    <div style="background:#1976d2;padding:20px;color:#fff">
                        <h2 style="margin:0">Attendance Edit Request</h2>
                    </div>
                    <div style="padding:24px">
                        <p>An edit has been requested for student attendance on <strong>${date}</strong>.</p>
                        <p>Your OTP is:</p>
                        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1976d2;text-align:center;padding:16px;background:#f0f7ff">${otp}</div>
                        <p style="color:#888;font-size:13px;margin-top:16px">This OTP expires in <strong>10 minutes</strong>.</p>
                    </div>
                </div>
            `
        });

        res.json({ success: true, message: 'OTP sent to HR email' });
    } catch (err) {
        console.error('Request edit error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── Verify Edit (OTP) ─ PUT /:userId/verify-edit ─────────────────────────
router.put('/:userId/verify-edit', protect, async (req, res) => {
    try {
        const { otp, date, status, remarks, courseId } = req.body;
        const userId = req.params.userId;

        if (!otp || !date || !status) {
            return res.status(400).json({ message: 'otp, date, and status are required' });
        }

        const record = await StudentAttendance.findOne({
            student: new mongoose.Types.ObjectId(userId),
            date: dayStart(date)
        });
        if (!record) return res.status(404).json({ message: 'Attendance record not found' });
        if (!record.otp || record.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }
        if (!record.otpExpiry || new Date() > record.otpExpiry) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        // Normalize status
        let normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        if (!['Present', 'Absent', 'Holiday'].includes(normalizedStatus)) {
            return res.status(400).json({ message: 'Status must be one of: Present, Absent, Holiday' });
        }

        record.status = normalizedStatus;
        record.notes = remarks || record.notes;
        if (courseId) record.course = courseId;
        record.markedBy = req.user._id;
        // Clear OTP fields
        record.otp = undefined;
        record.otpExpiry = undefined;
        record.pendingEdit = undefined;
        await record.save();

        const populated = await record.populate('student', 'name studentId');
        res.json({ success: true, message: 'Attendance updated successfully', data: populated });
    } catch (err) {
        console.error('Verify edit error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// ─── Get Student Full Attendance List by ID (GET /:userId) ────────────────
router.get('/:userId', protect, async (req, res) => {
    try {
        const { date, startDate, endDate } = req.query;
        const userId = req.params.userId;
        const query = { student: new mongoose.Types.ObjectId(userId) };

        if (date) {
            query.date = { $gte: dayStart(date), $lte: dayEnd(date) };
        } else if (startDate && endDate) {
            query.date = { $gte: dayStart(startDate), $lte: dayEnd(endDate) };
        }

        const records = await StudentAttendance.find(query)
            .populate('course', 'courseName courseCode')
            .sort({ date: -1 });

        res.json({
            success: true,
            total: records.length,
            data: records
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── Get Student Attendance Summary by ID (GET /summary/:userId) ──────────
router.get('/summary/:userId', protect, async (req, res) => {
    try {
        const userId = req.params.userId;
        const records = await StudentAttendance.find({ student: new mongoose.Types.ObjectId(userId) });

        const summary = {
            totalDays: records.length,
            presentCount: records.filter(r => r.status === 'Present').length,
            absentCount: records.filter(r => r.status === 'Absent').length,
            holidayCount: records.filter(r => r.status === 'Holiday').length,
            attendancePercentage: 0
        };

        if (summary.totalDays > 0) {
            summary.attendancePercentage = (summary.presentCount / summary.totalDays) * 100;
        }

        res.json(summary);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── PUT /:id — edit existing attendance record ────────────────────────────
router.put('/:id', protect, hrOnly, async (req, res) => {
    try {
        const record = await StudentAttendance.findByIdAndUpdate(
            req.params.id,
            { $set: { ...req.body, markedBy: req.user._id } },
            { new: true }
        ).populate('student', 'name studentId').populate('course', 'courseName');
        if (!record) return res.status(404).json({ message: 'Record not found' });
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── GET /report/summary — aggregated attendance report ────────────────────
router.get('/report/summary', protect, hrOnly, async (req, res) => {
    try {
        const { startDate, endDate, course } = req.query;
        const matchStage = {};

        if (startDate && endDate) {
            matchStage.date = { $gte: dayStart(startDate), $lte: dayEnd(endDate) };
        }
        if (course) {
            matchStage.course = new mongoose.Types.ObjectId(course);
        }

        const summary = await StudentAttendance.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$student',
                    total:   { $sum: 1 },
                    present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
                    absent:  { $sum: { $cond: [{ $eq: ['$status', 'Absent']  }, 1, 0] } },
                    late:    { $sum: { $cond: [{ $eq: ['$status', 'Late']    }, 1, 0] } },
                },
            },
            {
                $lookup: {
                    from: 'students',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'studentInfo',
                },
            },
            { $unwind: { path: '$studentInfo', preserveNullAndEmptyArrays: false } },
            {
                $project: {
                    name:       '$studentInfo.name',
                    studentId:  '$studentInfo.studentId',
                    total: 1, present: 1, absent: 1, late: 1,
                    percentage: {
                        $multiply: [
                            { $divide: ['$present', { $max: ['$total', 1] }] },
                            100,
                        ],
                    },
                },
            },
            { $sort: { name: 1 } },
        ]);

        res.json(summary);
    } catch (err) {
        console.error('[Attendance] Report error:', err.message);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
