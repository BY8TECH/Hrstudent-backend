const Document = require("../models/Document");
const cloudinary = require("../config/cloudinary");
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');

// ── Upload Document ──────────────────────────────────────────────────────────
exports.uploadDocument = async (req, res, next) => {
    try {
        let { courseName } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload a PDF file" });
        }

        if (!courseName) {
            return res.status(400).json({ success: false, message: "courseName is required" });
        }

        // Clean courseName
        courseName = courseName.trim().replace(/^"(.*)"$/, "$1");

        // Upload to Cloudinary using buffer stream
        const uploadToCloudinary = (buffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "student_portal/docs",
                        resource_type: "raw", // use raw for PDF
                        public_id: `doc-${Date.now()}`
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                Readable.from(buffer).pipe(stream);
            });
        };

        const result = await uploadToCloudinary(req.file.buffer);

        const document = await Document.create({
            courseName: courseName.trim(),
            fileName: req.file.originalname,
            fileUrl: result.secure_url,
            cloudinaryId: result.public_id
        });

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully to Cloudinary",
            data: {
                courseName: document.courseName,
                fileUrl: document.fileUrl,
            },
        });
    } catch (err) {
        console.error('Cloudinary Upload Error:', err);
        next(err);
    }
};

// ── Get All Documents (Admin) ────────────────────────────────────────────────
exports.getAllDocuments = async (req, res, next) => {
    try {
        const documents = await Document.find({}).sort({ uploadedAt: -1 });

        const data = documents.map((doc) => ({
            documentId: doc._id,
            courseName: doc.courseName,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            uploadedAt: doc.uploadedAt,
        }));

        res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        next(err);
    }
};

// ── Get Documents by User (Fetches Course-wide Documents) ────────────────────
exports.getDocuments = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const User = require("../models/User");

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const courseName = user.courseName ? user.courseName.trim() : null;
        if (!courseName) {
            return res.json({ success: true, data: [] });
        }

        // Fetch all documents matching this user's courseName (case-insensitive)
        const documents = await Document.find({ 
            courseName: { $regex: new RegExp("^" + courseName + "$", "i") } 
        }).sort({ uploadedAt: -1 });

        const data = documents.map((doc) => ({
            documentId: doc._id,
            courseName: doc.courseName,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName,
            uploadedAt: doc.uploadedAt.toISOString().split("T")[0],
        }));

        res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        next(err);
    }
};

// ── Download Document ────────────────────────────────────────────────────────
exports.downloadDocument = async (req, res, next) => {
    // Support both /download/:documentId and /download/:userId/:documentId
    const documentId = req.params.documentId || req.params[0];
    console.log('--- Download Request ---');
    console.log('Params:', req.params, '→ documentId:', documentId);
    try {
        const document = await Document.findById(documentId);

        if (!document) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }

        const fileUrl = document.fileUrl || '';

        // ── Case 1: Cloudinary URL ─────────────────────────────────────────
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            let downloadUrl = fileUrl;
            // Add fl_attachment so Cloudinary forces a download instead of inline view
            if (downloadUrl.includes('/upload/') && !downloadUrl.includes('fl_attachment')) {
                downloadUrl = downloadUrl.replace('/upload/', '/upload/fl_attachment/');
            }
            return res.redirect(downloadUrl);
        }

        // ── Case 2: Legacy local file path (e.g. uploads/docs/file-....pdf) ─
        // Resolve against the student-portal root directory
        const spRoot = path.join(__dirname, '..'); // student-portal/
        const absolutePath = path.resolve(spRoot, fileUrl);

        if (!fs.existsSync(absolutePath)) {
            console.error(`Local file not found: ${absolutePath}`);
            return res.status(404).json({
                success: false,
                message: "File not found on server. It may have been uploaded before cloud storage was configured. Please re-upload the document.",
                fileName: document.fileName,
            });
        }

        res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
        res.setHeader('Content-Type', 'application/pdf');
        return res.sendFile(absolutePath);

    } catch (err) {
        console.error('Download error:', err);
        res.status(500).json({ success: false, message: "Error processing download" });
    }
};
