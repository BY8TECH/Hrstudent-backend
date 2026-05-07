const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const Employee = require('../models/Employee');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');

// ── Multer Config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/documents';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'doc-' + unique + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = /pdf|doc|docx|jpg|jpeg|png/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed'));
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ── Helper: resolve employee from logged-in user ──────────────────────────────
const getMyEmployee = async (user) => {
    return Employee.findOne({ email: user.email });
};

// ── Routes ────────────────────────────────────────────────────────────────────

// @route   GET /api/documents
// @desc    HR: all documents; Employee: own documents only
router.get('/', protect, async (req, res) => {
    try {
        let docs;
        if (req.user.role === 'HR' || req.user.role === 'Manager') {
            docs = await Document.find()
                .populate('employeeId', 'firstName lastName employeeId department designation')
                .populate('uploadedBy', 'email')
                .sort({ createdAt: -1 });
        } else {
            const emp = await getMyEmployee(req.user);
            if (!emp) return res.json([]);
            docs = await Document.find({ employeeId: emp._id })
                .populate('employeeId', 'firstName lastName employeeId department designation')
                .populate('uploadedBy', 'email')
                .sort({ createdAt: -1 });
        }
        res.json(docs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/documents/employee/:employeeId
// @desc    Get documents for a specific employee (HR only)
router.get('/employee/:employeeId', protect, isHR, async (req, res) => {
    try {
        const docs = await Document.find({ employeeId: req.params.employeeId })
            .populate('employeeId', 'firstName lastName employeeId department designation')
            .populate('uploadedBy', 'email')
            .sort({ createdAt: -1 });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/documents/upload
// @desc    Upload a document (HR only)
router.post('/upload', protect, isHR, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        const { employeeId, documentType, title, description } = req.body;
        if (!employeeId || !title) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'employeeId and title are required' });
        }

        const doc = await Document.create({
            employeeId,
            documentType: documentType || 'Other',
            title,
            description,
            fileName: req.file.filename,
            originalName: req.file.originalname,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedBy: req.user._id || req.user.id
        });

        const populated = await doc.populate('employeeId', 'firstName lastName employeeId department designation');
        res.status(201).json(populated);
    } catch (err) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: err.message });
    }
});

// @route   PUT /api/documents/:id
// @desc    Update document metadata (HR only)
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        const { title, description, documentType, isVerified } = req.body;
        const doc = await Document.findByIdAndUpdate(
            req.params.id,
            { $set: { title, description, documentType, isVerified } },
            { new: true }
        ).populate('employeeId', 'firstName lastName employeeId department designation');
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        res.json(doc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   GET /api/documents/:id/download
// @desc    Download a document (HR: any; Employee: own only)
router.get('/:id/download', protect, async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id)
            .populate('employeeId', 'firstName lastName email');
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        // RBAC: employees can only download their own docs
        if (req.user.role !== 'HR' && req.user.role !== 'Manager') {
            const emp = await getMyEmployee(req.user);
            if (!emp || doc.employeeId._id.toString() !== emp._id.toString()) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        if (!fs.existsSync(doc.filePath)) {
            return res.status(404).json({ message: 'File not found on server' });
        }

        res.download(doc.filePath, doc.originalName);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   DELETE /api/documents/:id
// @desc    Delete document + file (HR only)
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        // Remove physical file
        if (doc.filePath && fs.existsSync(doc.filePath)) {
            fs.unlinkSync(doc.filePath);
        }

        await Document.findByIdAndDelete(req.params.id);
        res.json({ message: 'Document deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
