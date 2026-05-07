const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const StudentAdmission = require('../models/StudentAdmission');
const Student = require('../models/Student');
const StudentCourse = require('../models/StudentCourse');

// HR-only middleware
const hrOnly = (req, res, next) => {
    if (req.user.role !== 'HR') {
        return res.status(403).json({ message: 'Access denied. HR only.' });
    }
    next();
};

// ─── GET all admissions (with search/filter) ────────────────────────────────
router.get('/', protect, hrOnly, async (req, res) => {
    try {
        const { search, status, course, page = 1, limit = 50 } = req.query;
        const query = {};
        if (status) query.status = status;
        if (course) query.appliedCourse = course;
        if (search) {
            query.$or = [
                { applicantName: { $regex: search, $options: 'i' } },
                { admissionId: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }
        const admissions = await StudentAdmission.find(query)
            .populate('appliedCourse', 'courseName courseCode')
            .populate('student', 'studentId name')
            .populate('processedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));
        const total = await StudentAdmission.countDocuments(query);
        res.json({ admissions, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─── GET single admission ────────────────────────────────────────────────────
router.get('/:id', protect, hrOnly, async (req, res) => {
    try {
        const admission = await StudentAdmission.findById(req.params.id)
            .populate('appliedCourse', 'courseName courseCode faculty')
            .populate('student', 'studentId name email')
            .populate('processedBy', 'name email');
        if (!admission) return res.status(404).json({ message: 'Admission not found' });
        res.json(admission);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─── POST create new admission application ───────────────────────────────────
router.post('/', protect, hrOnly, async (req, res) => {
    try {
        const admission = new StudentAdmission({
            ...req.body,
            processedBy: req.user._id,
        });
        await admission.save();
        await admission.populate('appliedCourse', 'courseName courseCode');
        res.status(201).json(admission);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Admission ID already exists' });
        }
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─── PUT update admission ────────────────────────────────────────────────────
router.put('/:id', protect, hrOnly, async (req, res) => {
    try {
        const existing = await StudentAdmission.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: 'Admission not found' });

        const admission = await StudentAdmission.findByIdAndUpdate(
            req.params.id,
            { ...req.body, processedBy: req.user._id },
            { new: true, runValidators: true }
        )
            .populate('appliedCourse', 'courseName courseCode')
            .populate('student', 'studentId name');
        res.json(admission);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─── PUT update status only ──────────────────────────────────────────────────
router.put('/:id/status', protect, hrOnly, async (req, res) => {
    try {
        const { status, remarks, interviewDate, interviewNotes } = req.body;
        const update = { status, processedBy: req.user._id };
        if (remarks !== undefined) update.remarks = remarks;
        if (interviewDate !== undefined) update.interviewDate = interviewDate;
        if (interviewNotes !== undefined) update.interviewNotes = interviewNotes;

        const admission = await StudentAdmission.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        ).populate('appliedCourse', 'courseName courseCode');
        if (!admission) return res.status(404).json({ message: 'Admission not found' });
        res.json(admission);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─── POST approve and convert to student record ──────────────────────────────
router.post('/:id/convert', protect, hrOnly, async (req, res) => {
    try {
        const admission = await StudentAdmission.findById(req.params.id);
        if (!admission) return res.status(404).json({ message: 'Admission not found' });

        if (admission.status === 'Rejected') {
            return res.status(400).json({ message: 'Cannot convert a rejected admission' });
        }
        if (admission.student) {
            return res.status(400).json({ message: 'Admission already converted to a student record' });
        }

        // Generate unique studentId by finding the highest existing one and incrementing
        const lastStudent = await Student.findOne({}, { studentId: 1 }).sort({ studentId: -1 });
        let nextNum = 1;
        if (lastStudent && lastStudent.studentId) {
            const match = lastStudent.studentId.match(/STU(\d+)/);
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        const studentId = `STU${String(nextNum).padStart(4, '0')}`;

        // Create student from admission
        const student = new Student({
            studentId,
            name: admission.applicantName,
            email: admission.email || undefined,
            phone: admission.phone || undefined,
            dateOfBirth: admission.dateOfBirth || undefined,
            gender: admission.gender || undefined,
            address: admission.address || undefined,
            guardianName: admission.guardianName || undefined,
            guardianPhone: admission.guardianPhone || undefined,
            course: admission.appliedCourse || undefined,
            enrollmentDate: new Date(),
            status: 'Active',
            notes: `Admitted via application ${admission.admissionId}`,
        });

        // Save student - studentId is auto-generated in pre('save')
        await student.save();

        // Update course enrolled list
        if (student.course) {
            await StudentCourse.findByIdAndUpdate(student.course, {
                $addToSet: { enrolledStudents: student._id },
            });
        }

        // Link student to admission & mark as approved
        admission.student = student._id;
        admission.status = 'Approved';
        admission.processedBy = req.user._id;
        await admission.save();

        await admission.populate('appliedCourse', 'courseName courseCode');
        await admission.populate('student', 'studentId name');

        res.json({ message: 'Admission approved and student record created', admission, student });
    } catch (err) {
        console.error('Convert admission error:', err.message, err.stack);
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// ─── DELETE admission ────────────────────────────────────────────────────────
router.delete('/:id', protect, hrOnly, async (req, res) => {
    try {
        const admission = await StudentAdmission.findById(req.params.id);
        if (!admission) return res.status(404).json({ message: 'Admission not found' });
        if (admission.student) {
            return res.status(400).json({ message: 'Cannot delete an admission that has been converted to a student record' });
        }
        await StudentAdmission.findByIdAndDelete(req.params.id);
        res.json({ message: 'Admission deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─── GET stats summary ───────────────────────────────────────────────────────
router.get('/stats/summary', protect, hrOnly, async (req, res) => {
    try {
        const total = await StudentAdmission.countDocuments();
        const pending = await StudentAdmission.countDocuments({ status: 'Pending' });
        const underReview = await StudentAdmission.countDocuments({ status: 'Under Review' });
        const interviewScheduled = await StudentAdmission.countDocuments({ status: 'Interview Scheduled' });
        const approved = await StudentAdmission.countDocuments({ status: 'Approved' });
        const rejected = await StudentAdmission.countDocuments({ status: 'Rejected' });
        const waitlisted = await StudentAdmission.countDocuments({ status: 'Waitlisted' });

        // Recent (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentApplications = await StudentAdmission.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

        res.json({ total, pending, underReview, interviewScheduled, approved, rejected, waitlisted, recentApplications });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
