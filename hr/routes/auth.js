const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');
const sendEmail = require('../utils/sendEmail');
const { 
    otpEmailTemplate, 
    newUserRegistrationAdminTemplate,
    userAccountStatusTemplate 
} = require('../utils/emailTemplates');
const Notification = require('../models/Notification');
const { autoConfigureEmail, getProviderConfig } = require('../utils/emailProviders');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d'
    });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, role, employeeId } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Validate email domain (Hostinger only)
        const providerConfig = getProviderConfig(email);
        if (!providerConfig || providerConfig.name !== 'Hostinger') {
            return res.status(400).json({ 
                message: 'Only business email addresses (Hostinger) are allowed for registration. Gmail, Yahoo, etc. are not supported.' 
            });
        }

        // Validate employee exists
        if (employeeId) {
            const employee = await Employee.findById(employeeId);
            if (!employee) {
                return res.status(404).json({ message: 'Employee not found' });
            }
        }

        // Auto-configure email settings based on email domain
        const emailConfig = autoConfigureEmail(email);

        // Create user (unverified, inactive until email verified)
        const user = await User.create({
            username,
            email,
            password,
            role: role || 'Employee',
            employeeId,
            isActive: false,  // Inactive until email verified
            approvalStatus: 'Pending',  // Will need HR approval after email verification
            isEmailVerified: false,
            hasDataAccess: false,
            emailConfig: emailConfig  // Auto-configured email settings
        });

        // Generate OTP
        const otp = user.generateEmailOTP();
        await user.save();

        // Send OTP email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Verify Your Email - BY8labs',
                html: otpEmailTemplate(user.username, otp)
            });

            res.status(201).json({
                message: 'Registration successful! Please check your email for verification code.',
                userId: user._id,
                email: user.email,
                requiresVerification: true
            });
        } catch (emailError) {
            // If email fails, delete the user and return error
            await User.findByIdAndDelete(user._id);
            throw new Error('Failed to send verification email. Please try again.');
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, identifier, password } = req.body;
        const loginId = email || identifier;

        if (!loginId || !password) {
            return res.status(400).json({ message: 'Please provide email/username and password' });
        }

        // Find user by email OR username with password field
        const user = await User.findOne({
            $or: [{ email: loginId.toLowerCase() }, { username: loginId }]
        }).select('+password').populate('employeeId');

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            return res.status(401).json({
                message: 'Please verify your email before logging in',
                emailNotVerified: true,
                userId: user._id
            });
        }

        // Check if account is active or pending
        // We now allow 'Pending' users to login so they can see their "Waiting for Approval" screen
        if (!user.isActive && user.approvalStatus !== 'Pending') {
            return res.status(401).json({ message: 'Your account is inactive. Please contact HR.' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user._id);

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            employeeId: user.employeeId,
            approvalStatus: user.approvalStatus, // Include status in response
            hasDataAccess: user.hasDataAccess,
            token: token
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
const { protect } = require('../middleware/auth');
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('employeeId');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/auth/pending-users
// @desc    Get all pending user registrations
// @access  Private/HR
const { isHR } = require('../middleware/rbac');
router.get('/pending-users', protect, isHR, async (req, res) => {
    try {
        const pendingUsers = await User.find({ approvalStatus: 'Pending' })
            .select('-password')
            .sort({ createdAt: -1 });

        res.json(pendingUsers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/auth/approve-user/:userId
// @desc    Approve a pending user registration
// @access  Private/HR
router.put('/approve-user/:userId', protect, isHR, async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.approvalStatus !== 'Pending') {
            return res.status(400).json({
                message: `User is already ${user.approvalStatus.toLowerCase()}`
            });
        }

        // Approve the user
        user.approvalStatus = 'Approved';
        user.isActive = true;
        user.approvedBy = req.user._id;
        user.approvedDate = new Date();
        user.hasDataAccess = true; // Auto-grant data access upon HR approval
        await user.save();

        // Send approval email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Account Approved - BY8labs',
                html: userAccountStatusTemplate(user.username, 'Approved')
            });
        } catch (emailError) {
            console.error('Failed to send approval email:', emailError.message);
        }

        res.json({
            message: 'User approved successfully',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                approvalStatus: user.approvalStatus
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/auth/reject-user/:userId
// @desc    Reject a pending user registration
// @access  Private/HR
router.put('/reject-user/:userId', protect, isHR, async (req, res) => {
    try {
        const { reason } = req.body;
        const user = await User.findById(req.params.userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.approvalStatus !== 'Pending') {
            return res.status(400).json({
                message: `User is already ${user.approvalStatus.toLowerCase()}`
            });
        }

        // Reject the user
        user.approvalStatus = 'Rejected';
        user.isActive = false;
        user.approvedBy = req.user._id;
        user.approvedDate = new Date();
        user.rejectionReason = reason || 'No reason provided';
        await user.save();

        // Send rejection email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Account Registration Update - BY8labs',
                html: userAccountStatusTemplate(user.username, 'Rejected', user.rejectionReason)
            });
        } catch (emailError) {
            console.error('Failed to send rejection email:', emailError.message);
        }

        res.json({
            message: 'User registration rejected',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                approvalStatus: user.approvalStatus,
                rejectionReason: user.rejectionReason
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;

// @route   POST /api/auth/verify-otp
// @desc    Verify email with OTP
// @access  Public
router.post('/verify-otp', async (req, res) => {
    try {
        const { userId, otp } = req.body;

        const user = await User.findById(userId).select('+emailOTP');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        if (!user.emailOTP || user.emailOTP !== otp) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        if (user.emailOTPExpires < Date.now()) {
            return res.status(400).json({ message: 'Verification code expired. Please request a new one.' });
        }

        // Mark as verified but keep inactive until HR approval
        user.isEmailVerified = true;
        user.isActive = false;  // Keep inactive until HR approval
        user.approvalStatus = 'Pending';
        user.emailOTP = undefined;
        user.emailOTPExpires = undefined;

        await user.save();

        // Notify HR about new registration
        try {
            const hrUsers = await User.find({ role: 'HR' });
            const hrEmails = hrUsers.map(u => u.email).filter(e => e);
            
            // If no HR users in DB, use the official HR email provided by user
            if (hrEmails.length === 0) {
                hrEmails.push('hr@by8labs.com');
            }

            // Send emails to HR
            const emailPromises = hrEmails.map(email => 
                sendEmail({
                    email,
                    subject: 'New User Registration Pending Approval',
                    html: newUserRegistrationAdminTemplate(user.username, user.email)
                })
            );

            // Create in-app notifications for all HR users
            const notificationPromises = hrUsers.map(hr => 
                Notification.create({
                    recipientId: hr._id,
                    type: 'General',
                    title: 'New User Registration',
                    message: `${user.username} has registered and is waiting for approval.`,
                    priority: 'High',
                    actionUrl: '/pending-users'
                })
            );

            await Promise.all([...emailPromises, ...notificationPromises]);
        } catch (notifyError) {
            console.error('Failed to notify HR:', notifyError.message);
            // Don't fail the verification if notification fails
        }

        // Auto-create Employee record if it doesn't exist
        if (!user.employeeId) {
            let employee = await Employee.findOne({ email: user.email });

            if (!employee) {
                // Create basic employee record
                employee = await Employee.create({
                    firstName: user.username.split(' ')[0] || user.username,
                    lastName: user.username.split(' ')[1] || 'User',
                    email: user.email,
                    employeeId: 'EMP' + Math.floor(1000 + Math.random() * 9000),
                    department: 'IT', // Default department
                    position: 'Employee', // Default position
                    designation: 'Employee',
                    joiningDate: new Date(),
                    status: 'Active',
                    phone: '0000000000',
                    address: {
                        city: 'Not Provided',
                        state: 'Not Provided'
                    }
                });
            }

            user.employeeId = employee._id;
            user.hasDataAccess = true;
        }

        await user.save();

        res.json({
            message: 'Email verified successfully! You can now login.',
            verified: true
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP verification code
// @access  Public
router.post('/resend-otp', async (req, res) => {
    try {
        const { userId } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        // Generate new OTP
        const otp = user.generateEmailOTP();
        await user.save();

        // Resend email
        await sendEmail({
            email: user.email,
            subject: 'Verify Your Email - BY8labs',
            html: otpEmailTemplate(user.username, otp)
        });

        res.json({ message: 'Verification code sent to your email!' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
