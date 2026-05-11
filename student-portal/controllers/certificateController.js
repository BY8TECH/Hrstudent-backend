const Certificate = require("../models/Certificate");
const CertificateRequest = require("../models/CertificateRequest");
const User = require("../models/User");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

/**
 * GET /api/sp/certificates/dashboard
 */
exports.getDashboard = async (req, res, next) => {
    try {
        const totalRequests = await CertificateRequest.countDocuments();
        const pendingRequests = await CertificateRequest.countDocuments({ status: "Pending" });
        const completedCertificates = await Certificate.countDocuments();

        res.json({
            success: true,
            data: {
                totalRequests,
                pendingRequests,
                completedCertificates
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/sp/certificates/student-details/:userId
 */
exports.getStudentDetails = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.userId).select("name email courseName studentId");
        if (!user) return res.status(404).json({ success: false, message: "Student not found" });

        let courseName = user.courseName || "";
        
        // 1. Fallback: Check Enrollments in Student Portal DB
        if (!courseName) {
            const Enrollment = require("../models/Enrollment");
            const enrollment = await Enrollment.findOne({ userId: user._id }).populate("courseId");
            if (enrollment && enrollment.courseId) {
                courseName = enrollment.courseId.name || enrollment.courseId.courseName || enrollment.courseId.title || "";
            }
        }

        // 2. Fallback: Check HR Database (Student record)
        if (!courseName && user.email) {
            const hrMongoose = require("mongoose");
            const Student = hrMongoose.models.Student || hrMongoose.model("Student", require("../../hr/models/Student").schema);
            const StudentCourse = hrMongoose.models.StudentCourse || hrMongoose.model("StudentCourse", require("../../hr/models/StudentCourse").schema);
            
            const hrStudent = await Student.findOne({ email: user.email }).populate("course");
            if (hrStudent && hrStudent.course) {
                courseName = hrStudent.course.courseName || "";
            }
        }

        // 3. Fallback: Check HR Database (Admission record)
        if (!courseName && user.email) {
            const hrMongoose = require("mongoose");
            const StudentAdmission = hrMongoose.models.StudentAdmission || hrMongoose.model("StudentAdmission", require("../../hr/models/StudentAdmission").schema);
            const admission = await StudentAdmission.findOne({ email: user.email }).populate("appliedCourse");
            if (admission && admission.appliedCourse) {
                courseName = admission.appliedCourse.courseName || "";
            }
        }

        res.json({
            success: true,
            data: {
                name: user.name,
                email: user.email,
                courseName: courseName,
                studentId: user.studentId || ""
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/sp/certificates/requests
 */
exports.getRequests = async (req, res, next) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const requests = await CertificateRequest.find(filter)
            .populate("userId", "name email courseName mobile")
            .sort({ requestedAt: -1 });

        res.json({ success: true, data: requests });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/sp/certificates/generate
 */
exports.generateCertificate = async (req, res, next) => {
    try {
        const { requestId, userId, courseName, content, duration, isManual, studentName } = req.body;

        if (!isManual && (!requestId && !userId)) {
            return res.status(400).json({ success: false, message: "Please select a student or enable manual mode" });
        }

        if (isManual && !studentName) {
            return res.status(400).json({ success: false, message: "Student Name is required for manual certificates" });
        }

        if (!courseName || !content || !duration) {
            return res.status(400).json({ success: false, message: "Required fields missing (Course, Content, or Duration)" });
        }
        
        // 0. Validate Character Count (Strict 650 character limit)
        if (content.length > 650) {
            return res.status(400).json({ 
                success: false, 
                message: `Content is too long (${content.length} characters). Maximum 650 characters allowed.` 
            });
        }

        let user;
        let request = null;
        let displayName = "";
        let displayId = "manual";

        if (isManual) {
            displayName = studentName;
        } else if (requestId) {
            request = await CertificateRequest.findById(requestId).populate("userId");
            if (!request) return res.status(404).json({ success: false, message: "Certificate request not found" });
            user = request.userId;
            displayName = request.studentName || (user ? user.name : "Student");
            displayId = user ? user._id : "req";
        } else if (userId) {
            user = await User.findById(userId);
            if (!user) return res.status(404).json({ success: false, message: "User not found" });
            displayName = user.name;
            displayId = user._id;
        }

        if (user) {
            displayName = user.name;
            displayId = user._id;
        } else if (request && request.studentName) {
            displayName = request.studentName;
            displayId = request._id;
        }

        if (!displayName) {
            return res.status(400).json({ success: false, message: "Student information missing" });
        }

        // 1. Generate Certificate Number
        const lastCert = await Certificate.findOne().sort({ createdAt: -1 });
        let nextNum = 1001;
        if (lastCert && lastCert.certificateNumber) {
            const match = lastCert.certificateNumber.match(/B8LAB(\d+)/);
            if (match) nextNum = parseInt(match[1]) + 1;
        }
        const certNumber = `B8LAB${nextNum}`;

        const fileName = `certificate_${displayId}_${Date.now()}.pdf`;
        const dirPath = path.join(__dirname, "../uploads/certificates");
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(dirPath, fileName);
        const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 0 });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // ── PDF Design with Template ──
        const W = doc.page.width;
        const H = doc.page.height;

        // Draw Template Image as Background
        const templatePath = path.join(__dirname, '..', 'course certificate.jpeg');
        if (fs.existsSync(templatePath)) {
            doc.image(templatePath, 0, 0, { width: W, height: H });
        } else {
            // Fallback border if template is missing
            doc.rect(20, 20, W - 40, H - 40).lineWidth(10).stroke("#1a3c6e");
        }

        // Top-Left: Certificate Number (Moved down from top)
        doc.fillColor("#1a3c6e").fontSize(11).font("Helvetica-Bold").text(`No: ${certNumber}`, 60, 70);

        // Top-Right: Date (Moved down from top)
        const currentDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        doc.text(`Date: ${currentDate}`, W - 160, 70, { align: 'right', width: 100 });

        // Header: BY8LABS (Optional based on template, added for branding)
        // doc.fillColor("#1a3c6e").fontSize(32).font("Helvetica-Bold").text("BY8LABS", 0, 110, { align: "center" });
        doc.fillColor("#1a3c6e").fontSize(12).font("Helvetica").text(" Training & Development & Placement", 0, 100, { align: "center" });

        // Certificate Title
        doc.moveDown(1.5);
        doc.fillColor("#1a3c6e").fontSize(38).font("Helvetica-Bold").text("CERTIFICATE", 0, 130, { align: "center" });
   
        //of completion
          doc.fillColor("#1a3c6e").fontSize(15).font("Helvetica").text("of excellence", 0, 180, { align: "center" });
            doc.fillColor("#1a3c6e").fontSize(15).font("Helvetica").text("This certificate is awarded to", 0, 200, { align: "center" });
        // Student Name
        doc.moveDown(2);
        doc.fillColor("#1a3c6e").fontSize(38).font("Helvetica-Bold").text(displayName.toUpperCase(), 0, 240, { align: "center" });

        // Course Name
        doc.moveDown(0.5);
        doc.fillColor("#374151").fontSize(23).font("Helvetica-Bold").text(courseName.toUpperCase(), 0, 280, { align: "center" });

        // Description/Content
        const contentBoxY = 320; 
        const sideMargin = 120; 
        const contentBoxWidth = W - (sideMargin * 2);

        doc.fillColor("#000000").fontSize(17).font("Helvetica").text(content, sideMargin, contentBoxY, {
            align: "center",
            width: contentBoxWidth,
            lineGap: 4, 
        });

        // Duration (Balanced at bottom, moved slightly to avoid content box)
        

        doc.end();

        await new Promise((resolve) => stream.on("finish", resolve));

        const certificate = await Certificate.create({
            userId: user ? user._id : null,
            studentName: displayName,
            certificateNumber: certNumber,
            requestId: request ? request._id : null,
            courseName,
            content,
            duration,
            fileUrl: `uploads/certificates/${fileName}`
        });

        if (request) {
            request.status = "Approved";
            await request.save();
        }

        res.json({
            success: true,
            message: "Certificate generated successfully",
            data: certificate
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/sp/certificates/request
 */
exports.requestCertificate = async (req, res, next) => {
    try {
        const { courseName, duration } = req.body;
        const userId = req.user._id;

        if (!courseName || !duration) {
            return res.status(400).json({ success: false, message: "Course Name and Duration are required" });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const request = await CertificateRequest.create({
            userId,
            studentName: user.name,
            studentEmail: user.email,
            courseName,
            duration,
            status: "Pending"
        });

        // Notify HR about new certificate request
        try {
            const hrMongoose = require("mongoose");
            const HRUser = hrMongoose.model("User");
            const HRNotification = hrMongoose.model("Notification");

            const hrUsers = await HRUser.find({ role: "HR" });
            
            const notificationPromises = hrUsers.map(hr => 
                HRNotification.create({
                    recipientId: hr._id,
                    type: "CertificateRequest",
                    title: "New Certificate Request",
                    message: `${user.name} has requested a certificate for ${courseName}.`,
                    priority: "Medium",
                    actionUrl: "/certificates"
                })
            );

            await Promise.all(notificationPromises);
        } catch (notifyError) {
            console.error("Failed to notify HR about certificate request:", notifyError.message);
        }

        res.status(201).json({
            success: true,
            message: "Certificate request submitted successfully",
            data: request
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/sp/certificates/all
 */
exports.getAllCertificates = async (req, res, next) => {
    try {
        const certificates = await Certificate.find()
            .populate("userId", "name email courseName studentId")
            .sort({ issuedAt: -1 });

        res.json({ success: true, data: certificates });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/sp/certificates/user/:userId
 */
exports.getCertificatesByUserId = async (req, res, next) => {
    try {
        const certificates = await Certificate.find({ userId: req.params.userId })
            .sort({ issuedAt: -1 });

        res.json({ success: true, data: certificates });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/sp/certificates/download/:id
 */
exports.downloadCertificate = async (req, res, next) => {
    try {
        const certificate = await Certificate.findById(req.params.id);
        if (!certificate) return res.status(404).json({ success: false, message: "Certificate not found" });

        const filePath = path.join(__dirname, "..", certificate.fileUrl);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: "File not found on server" });
        }

        res.download(filePath, `Certificate_${certificate.courseName.replace(/\s/g, "_")}.pdf`);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/sp/certificates/view/:id
 */
exports.viewCertificate = async (req, res, next) => {
    try {
        const certificate = await Certificate.findById(req.params.id);
        if (!certificate) return res.status(404).json({ success: false, message: "Certificate not found" });

        const filePath = path.join(__dirname, "..", certificate.fileUrl);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: "File not found on server" });
        }

        res.contentType("application/pdf");
        fs.createReadStream(filePath).pipe(res);
    } catch (err) {
        next(err);
    }
};
