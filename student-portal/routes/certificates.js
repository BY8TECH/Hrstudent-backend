const express = require("express");
const router = express.Router();
const {
    getDashboard,
    getRequests,
    generateCertificate,
    getAllCertificates,
    getCertificatesByUserId,
    downloadCertificate,
    viewCertificate
} = require("../controllers/certificateController");
const { protect, isAdmin } = require("../middlewares/auth");

// ── Shared Routes ─────────────────────────────────────────────────────────────
router.get("/download/:id", downloadCertificate);
router.get("/view/:id", viewCertificate);

// ── Student/Admin Protected Routes ─────────────────────────────────────────────
router.get("/user/:userId", protect, getCertificatesByUserId);

// ── Admin Only Routes ─────────────────────────────────────────────────────────
router.get("/dashboard", protect, isAdmin, getDashboard);
router.get("/requests", protect, isAdmin, getRequests);
router.post("/generate", protect, isAdmin, generateCertificate);
router.get("/all", protect, isAdmin, getAllCertificates);

module.exports = router;
