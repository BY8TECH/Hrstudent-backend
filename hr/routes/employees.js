const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Employee = require('../models/Employee');
const { protect } = require('../middleware/auth');
const { isHR, isSelfOrHR } = require('../middleware/rbac');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/documents');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// @route   GET /api/employees
// @desc    Get all employees
// @access  Private/HR
router.get('/', protect, isHR, async (req, res) => {
    try {
        const employees = await Employee.find({ isActive: true }).sort({ createdAt: -1 });
        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/employees/me
// @desc    Get current user's employee profile
// @access  Private (Employee/HR)
router.get('/me', protect, async (req, res) => {
    try {
        const employee = await Employee.findOne({ email: req.user.email });

        if (!employee) {
            return res.status(404).json({ message: 'Employee record not found' });
        }

        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/employees/:id
// @desc    Get single employee
// @access  Private (Own data or HR)
router.get('/:id', protect, isSelfOrHR, async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post('/', protect, isHR, async (req, res) => {
    try {
        console.log('📝 Creating employee with data:', req.body);
        const employee = await Employee.create(req.body);
        console.log('✅ Employee created successfully:', employee.employeeId);
        res.status(201).json(employee);
    } catch (error) {
        console.error('❌ Employee creation error:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            keyPattern: error.keyPattern,
            keyValue: error.keyValue
        });

        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                message: `${field} already exists: ${error.keyValue[field]}`
            });
        }

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: messages.join(', ') });
        }

        res.status(500).json({ message: error.message || 'Failed to create employee' });
    }
});

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private/HR
router.put('/:id', protect, isHR, async (req, res) => {
    try {
        console.log('📝 Updating employee:', req.params.id);
        console.log('📦 Update data received:', JSON.stringify(req.body, null, 2));

        const employee = await Employee.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: false, strict: false }
        );

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        console.log('✅ Employee updated:', employee.employeeId, '| category:', employee.employeeCategory);
        res.json(employee);
    } catch (error) {
        console.error('❌ Employee update error:', error.message);
        console.error('Full error:', error);

        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                message: `${field} already exists: ${error.keyValue[field]}`
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ message: messages.join(', ') });
        }

        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/employees/:id
// @desc    Delete employee (soft delete)
// @access  Private/HR
router.delete('/:id', protect, isHR, async (req, res) => {
    try {
        const employee = await Employee.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/employees/:id/documents
// @desc    Upload employee document
// @access  Private/HR
router.post('/:id/documents', protect, isHR, upload.single('document'), async (req, res) => {
    try {
        const { type, name } = req.body;

        const employee = await Employee.findById(req.params.id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        employee.documents.push({
            name: name || req.file.originalname,
            type,
            filePath: req.file.path
        });

        await employee.save();
        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
