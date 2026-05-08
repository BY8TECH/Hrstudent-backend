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
        const { requestId, userId, courseName, content, duration } = req.body;

        if ((!requestId && !userId) || !courseName || !content || !duration) {
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        let user;
        let request = null;
        let displayName = "";
        let displayId = "guest";

        if (requestId) {
            request = await CertificateRequest.findById(requestId).populate("userId");
            if (!request) return res.status(404).json({ success: false, message: "Certificate request not found" });
            user = request.userId;
            displayName = request.studentName || (user ? user.name : "Student");
        }
        
        // If still no user, and userId was provided in body, fetch it
        if (!user && userId) {
            user = await User.findById(userId);
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

        const fileName = `certificate_${displayId}_${Date.now()}.pdf`;
        const dirPath = path.join(__dirname, "../uploads/certificates");
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        const filePath = path.join(dirPath, fileName);
        const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 50 });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // ── PDF Design ──
        const W = doc.page.width;
        const H = doc.page.height;

        // Border
        doc.rect(20, 20, W - 40, H - 40).lineWidth(10).stroke("#1a3c6e");
        doc.rect(30, 30, W - 60, H - 60).lineWidth(2).stroke("#c5a059");

        // Logo / Title
        doc.fillColor("#1a3c6e").fontSize(40).font("Helvetica-Bold").text("BY8LABS", 0, 80, { align: "center" });
        doc.fillColor("#374151").fontSize(15).font("Helvetica").text("Technology Learning & Innovation Center", 0, 130, { align: "center" });

        doc.moveDown(2);
        doc.fillColor("#c5a059").fontSize(30).font("Helvetica-Bold").text("CERTIFICATE OF COMPLETION", 0, 180, { align: "center" });

        doc.moveDown(1);
        doc.fillColor("#374151").fontSize(18).font("Helvetica").text("This is to certify that", 0, 230, { align: "center" });

        doc.moveDown(0.5);
        doc.fillColor("#1a3c6e").fontSize(35).font("Helvetica-Bold").text(displayName.toUpperCase(), 0, 260, { align: "center" });

        doc.moveDown(0.5);
        doc.fillColor("#374151").fontSize(18).font("Helvetica").text(`has successfully completed the course in`, 0, 310, { align: "center" });

        doc.moveDown(0.5);
        doc.fillColor("#1a3c6e").fontSize(28).font("Helvetica-Bold").text(courseName.toUpperCase(), 0, 340, { align: "center" });

        doc.moveDown(1);
        doc.fillColor("#374151").fontSize(14).font("Helvetica").text(content, 50, 390, { align: "center", width: W - 100 });

        doc.moveDown(1);
        doc.text(`Duration: ${duration}`, 0, 440, { align: "center" });

        // Footer
        const footerY = H - 120;
        doc.lineCap("butt").moveTo(100, footerY).lineTo(250, footerY).lineWidth(1).stroke("#374151");
        doc.lineCap("butt").moveTo(W - 250, footerY).lineTo(W - 100, footerY).lineWidth(1).stroke("#374151");

        doc.fontSize(12).text("Authorized Signatory", 100, footerY + 10, { width: 150, align: "center" });
        doc.text("Date of Issue", W - 250, footerY + 10, { width: 150, align: "center" });
        doc.text(new Date().toLocaleDateString("en-IN"), W - 250, footerY + 25, { width: 150, align: "center" });

        doc.end();

        await new Promise((resolve) => stream.on("finish", resolve));

        const certificate = await Certificate.create({
            userId: user ? user._id : null,
            studentName: displayName,
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
