const express = require('express');
const router = express.Router();
const AccessRequest = require('../models/AccessRequest');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { isHR } = require('../middleware/rbac');
const sendEmail = require('../utils/sendEmail');
const {
    accessApprovedTemplate,
    accessRequestNotificationTemplate,
    accessRejectedTemplate
} = require('../utils/emailTemplates');

// @route   POST /api/access-requests
// @desc    Employee creates data access request
// @access  Private/Employee
router.post('/', protect, async (req, res) => {
    try {
        // Check if user already has access
        if (req.user.hasDataAccess) {
            return res.status(400).json({ message: 'You already have data access' });
        }

        // Check if there's already a pending request
        const existingRequest = await AccessRequest.findOne({
            employeeId: req.user._id,
            status: 'Pending'
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'You already have a pending access request' });
        }

        // Create new request
        const accessRequest = await AccessRequest.create({
            employeeId: req.user._id,
            requestMessage: req.body.message || 'Requesting access to view my attendance and submit leave requests'
        });

        // Notify all HR users
        const hrUsers = await User.find({ role: 'HR' });
        const emailPromises = hrUsers.map(hr => {
            if (hr.email) {
                return sendEmail({
                    email: hr.email,
                    subject: 'New Access Request',
                    html: accessRequestNotificationTemplate(req.user.username, req.user.email, accessRequest.requestMessage)
                }).catch(err => console.error(`Failed to send email to HR ${hr.email}:`, err.message));
            }
        });
        await Promise.all(emailPromises);

        res.status(201).json({
            message: 'Access request submitted successfully. HR will review your request.',
            request: accessRequest
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/access-requests
// @desc    Get all pending access requests (HR) or own requests (Employee)
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        let query = {};

        if (req.user.role === 'HR') {
            // HR sees all pending requests
            query.status = 'Pending';
        } else {
            // Employees see only their own requests
            query.employeeId = req.user._id;
        }

        const requests = await AccessRequest.find(query)
            .populate('employeeId', 'username email role')
            .populate('approvedBy', 'username')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/access-requests/:id/approve
// @desc    Approve access request
// @access  Private/HR
router.put('/:id/approve', protect, isHR, async (req, res) => {
    try {
        const accessRequest = await AccessRequest.findById(req.params.id).populate('employeeId', 'username email');

        if (!accessRequest) {
            return res.status(404).json({ message: 'Access request not found' });
        }

        if (accessRequest.status !== 'Pending') {
            return res.status(400).json({ message: `Request is already ${accessRequest.status.toLowerCase()}` });
        }

        // Update request
        accessRequest.status = 'Approved';
        accessRequest.approvedBy = req.user._id;
        accessRequest.approvedDate = new Date();
        await accessRequest.save();

        // Grant data access to user
        await User.findByIdAndUpdate(accessRequest.employeeId._id, {
            hasDataAccess: true
        });

        // Notify Employee
        if (accessRequest.employeeId && accessRequest.employeeId.email) {
            await sendEmail({
                email: accessRequest.employeeId.email,
                subject: 'Access Request Approved',
                html: accessApprovedTemplate(accessRequest.employeeId.username)
            }).catch(err => console.error('Failed to send approval email:', err.message));
        }

        res.json({
            message: 'Access request approved successfully',
            request: accessRequest
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/access-requests/:id/reject
// @desc    Reject access request
// @access  Private/HR
router.put('/:id/reject', protect, isHR, async (req, res) => {
    try {
        const { reason } = req.body;
        const accessRequest = await AccessRequest.findById(req.params.id).populate('employeeId', 'username email');

        if (!accessRequest) {
            return res.status(404).json({ message: 'Access request not found' });
        }

        if (accessRequest.status !== 'Pending') {
            return res.status(400).json({ message: `Request is already ${accessRequest.status.toLowerCase()}` });
        }

        // Update request
        accessRequest.status = 'Rejected';
        accessRequest.approvedBy = req.user._id;
        accessRequest.approvedDate = new Date();
        accessRequest.rejectionReason = reason || 'No reason provided';
        await accessRequest.save();

        // Notify Employee
        if (accessRequest.employeeId && accessRequest.employeeId.email) {
            await sendEmail({
                email: accessRequest.employeeId.email,
                subject: 'Access Request Rejected',
                html: accessRejectedTemplate(accessRequest.employeeId.username, accessRequest.rejectionReason)
            }).catch(err => console.error('Failed to send rejection email:', err.message));
        }

        res.json({
            message: 'Access request rejected',
            request: accessRequest
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;
