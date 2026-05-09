const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const documentController = require("../controllers/documentController");

// ── Multer Configuration (Memory Storage for Cloudinary) ──────────────────────
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'), false);
        }
    }
});
// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/documents/upload
router.post("/upload", upload.single("file"), documentController.uploadDocument);

// GET /api/documents/admin/all (For Admin panel)
router.get("/admin/all", documentController.getAllDocuments);

// GET /api/documents/:userId
router.get("/:userId", documentController.getDocuments);

// GET /api/documents/download/:documentId
router.get("/download/:documentId", documentController.downloadDocument);

module.exports = router;
