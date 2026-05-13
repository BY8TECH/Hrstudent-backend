/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BY8Labs Unified Server — HR + Student Portal
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Single Express server that hosts both modules:
 *   - HR routes:             /api/hr/...
 *   - Student Portal routes: /api/sp/...
 * 
 * Each module connects to its own MongoDB database on the same Atlas cluster.
 */

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const socket = require('./socket');

// Load environment variables
dotenv.config();

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ 
    limit: '50mb',
    verify: (req, res, buf) => {
        if (req.originalUrl && req.originalUrl.includes('/webhook')) {
            req.rawBody = buf;
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static folders for uploads (both modules)
// Map /uploads to multiple locations to ensure files are found regardless of where they were uploaded
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'hr/uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'student-portal/uploads')));

// Legacy/Module-specific static routes
app.use('/uploads/hr', express.static(path.join(__dirname, 'hr/uploads')));
app.use('/uploads/sp', express.static(path.join(__dirname, 'student-portal/uploads')));
app.use('/sp/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Database Connection Check Middleware ──────────────────────────────────────
app.use((req, res, next) => {
    // Only check for API routes (not static files or frontend)
    if (!req.path.startsWith('/api/')) return next();
    if (req.path.includes('/test') || req.path === '/') return next();

    const isHRRoute = req.path.startsWith('/api/hr/');
    const isSPRoute = req.path.startsWith('/api/sp/');

    if (isHRRoute) {
        const isConnected = mongoose.connection.readyState === 1;
        if (!isConnected) {
            return res.status(503).json({
                message: 'HR Database connection is currently unavailable.',
                error: 'Database connection failed. Please try again later.',
                status: 'disconnected'
            });
        }
    }

    if (isSPRoute) {
        const { getSPConnection } = require('./config/db');
        const spConn = getSPConnection();
        if (!spConn || spConn.readyState !== 1) {
            return res.status(503).json({
                message: 'Student Portal Database connection is currently unavailable.',
                error: 'Database connection failed. Please try again later.',
                status: 'disconnected'
            });
        }
    }

    next();
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOOT SEQUENCE — connect DBs, then mount routes
// ═══════════════════════════════════════════════════════════════════════════════
const boot = async () => {
    const { connectHRDB, connectSPDB } = require('./config/db');

    // 1. Connect HR Database (default mongoose connection)
    await connectHRDB();

    // 2. Connect Student Portal Database (separate connection)
    await connectSPDB();

    // ── HR Routes (/api/hr/...) ──────────────────────────────────────────────
    // Auth & Core
    app.use('/api/hr/auth', require('./hr/routes/auth'));
    app.use('/api/hr/employees', require('./hr/routes/employees'));
    app.use('/api/hr/attendance', require('./hr/routes/attendance'));
    app.use('/api/hr/leaves', require('./hr/routes/leaves'));
    app.use('/api/hr/payroll', require('./hr/routes/payroll'));
    app.use('/api/hr/dashboard', require('./hr/routes/dashboard'));
    app.use('/api/hr/access-requests', require('./hr/routes/accessRequests'));
    app.use('/api/hr/announcements', require('./hr/routes/announcements'));
    app.use('/api/hr/holidays', require('./hr/routes/holidays'));
    app.use('/api/hr/feedback', require('./hr/routes/feedback'));
    app.use('/api/hr/emails', require('./hr/routes/emails'));
    app.use('/api/hr/email-config', require('./hr/routes/emailConfig'));
    app.use('/api/hr', require('./hr/routes/testImap'));

    // Recruitment
    app.use('/api/hr/recruitment/jobs', require('./hr/routes/recruitment-jobs'));
    app.use('/api/hr/recruitment/candidates', require('./hr/routes/recruitment-candidates'));
    app.use('/api/hr/recruitment/interviews', require('./hr/routes/recruitment-interviews'));
    app.use('/api/hr/recruitment/offers', require('./hr/routes/recruitment-offers'));

    // Reports & Performance
    app.use('/api/hr/reports', require('./hr/routes/reports'));
    app.use('/api/hr/performance', require('./hr/routes/performance'));

    // Documents
    app.use('/api/hr/documents', require('./hr/routes/documents'));

    // Student management from HR side
    app.use('/api/hr/students', require('./hr/routes/students'));
    app.use('/api/hr/student-courses', require('./hr/routes/studentCourses'));
    app.use('/api/hr/attendance', require('./hr/routes/studentAttendance'));
    app.use('/api/hr/student-attendance', require('./hr/routes/studentAttendance'));
    app.use('/api/hr/student-fees', require('./hr/routes/studentFees'));
    app.use('/api/hr/student-leaves', require('./hr/routes/studentLeaves'));
    app.use('/api/hr/student-assignments', require('./hr/routes/studentAssignments'));
    app.use('/api/hr/student-reports', require('./hr/routes/studentReports'));
    app.use('/api/hr/student-admissions', require('./hr/routes/studentAdmissions'));
    app.use('/api/hr/courses', require('./hr/routes/courses'));
    app.use('/api/hr/payments', require('./hr/routes/payments'));

    // HR Certificates
    app.use('/api/hr/experience-letters', require('./hr/routes/experienceLetters'));
    app.use('/api/hr/offer-letters-hr', require('./hr/routes/offerLettersHR'));
    app.use('/api/hr/notifications', require('./hr/routes/notification'));

    // ── Student Portal Routes (/api/sp/...) ──────────────────────────────────
    app.use('/api/sp/payments', require('./student-portal/routes/payments'));
    app.use('/api/sp/auth', require('./student-portal/routes/auth'));
    app.use('/api/sp/dashboard', require('./student-portal/routes/dashboard'));
    app.use('/api/sp/notifications', require('./student-portal/routes/notifications'));
    app.use('/api/sp/enrollments', require('./student-portal/routes/enrollments'));
    app.use('/api/sp/leaderboard', require('./student-portal/routes/leaderboard'));
    app.use('/api/sp/courses', require('./student-portal/routes/courses'));
    app.use('/api/sp/attendance', require('./student-portal/routes/attendance'));
    app.use('/api/sp/admin', require('./student-portal/routes/admin'));
    app.use('/api/sp/upload', require('./student-portal/routes/upload'));
    app.use('/api/sp/leave', require('./student-portal/routes/leave'));
    app.use('/api/sp/tasks', require('./student-portal/routes/task'));
    app.use('/api/sp/users', require('./student-portal/routes/users'));
    app.use('/api/sp/documents', require('./student-portal/routes/documentRoutes'));
    app.use('/api/sp/certificates', require('./student-portal/routes/certificates'));
    app.use('/api/sp/stripe', require('./student-portal/routes/stripeRoutes'));
    app.use('/api/stripe', require('./student-portal/routes/stripeRoutes')); // Keep for webhooks compatibility

    // ── Student Portal Cron Jobs ─────────────────────────────────────────────
    try {
        const { initCronJobs } = require('./student-portal/config/cron');
        initCronJobs();
    } catch (err) {
        console.error('⚠️ Student Portal Cron init failed:', err.message);
    }

    // ── Health Check ─────────────────────────────────────────────────────────
    app.get('/', (req, res) => {
        res.json({
            message: 'BY8Labs Unified API 🚀',
            modules: {
                hr: '/api/hr',
                studentPortal: '/api/sp'
            }
        });
    });

    // ── Serve Static Frontend Files ──────────────────────────────────────────
    app.use(express.static(path.join(__dirname, '../frontend/dist')));

    // Catch-all route to serve React's index.html for SPA routing
    app.get('*', (req, res) => {
        // Skip for API routes that weren't caught
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ message: `API route not found: ${req.path}` });
        }

        const indexPath = path.join(__dirname, '../frontend/dist/index.html');
        res.sendFile(indexPath, (err) => {
            if (err) {
                console.error('Frontend build error:', err.path);
                res.status(404).json({ 
                    message: 'Frontend build not found or API route invalid', 
                    requestedPath: req.path,
                    buildPath: indexPath,
                    hint: 'Make sure the frontend is built (npm run build) and the dist folder is in the correct location.'
                });
            }
        });
    });

    // ── Error Handling ───────────────────────────────────────────────────────
    app.use((err, req, res, next) => {
        console.error(err.stack);
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({
            message: err.message || 'Something went wrong!',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
    });

    // ── Start Server ─────────────────────────────────────────────────────────
    const PORT = process.env.PORT || 5000;
    const server = http.createServer(app);
    
    // Initialize Socket.io
    socket.init(server);
    
    server.listen(PORT, () => {
        console.log(`\n🚀 BY8Labs Unified Server running on port ${PORT}`);
        console.log(`   HR Module:             http://localhost:${PORT}/api/hr`);
        console.log(`   Student Portal Module: http://localhost:${PORT}/api/sp\n`);
    });
};

// Start the application
boot().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
