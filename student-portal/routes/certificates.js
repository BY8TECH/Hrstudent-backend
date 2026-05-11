const express = require("express");
const router = express.Router();
const {
    getDashboard,
    getRequests,
    generateCertificate,
    getAllCertificates,
    getCertificatesByUserId,
    downloadCertificate,
    viewCertificate,
    getStudentDetails,
    requestCertificate
} = require("../controllers/certificateController");
const { protect, isAdmin } = require("../middlewares/auth");

// ── Shared Routes ─────────────────────────────────────────────────────────────
router.get("/download/:id", downloadCertificate);
router.get("/view/:id", viewCertificate);

// ── Student/Admin Protected Routes ─────────────────────────────────────────────
router.get("/user/:userId", protect, getCertificatesByUserId);
router.post("/request", protect, requestCertificate);

// ── Admin Only Routes ─────────────────────────────────────────────────────────
router.get("/dashboard", protect, isAdmin, getDashboard);
router.get("/requests", protect, isAdmin, getRequests);
router.get("/student-details/:userId", protect, isAdmin, getStudentDetails);
router.post("/generate", protect, isAdmin, generateCertificate);
router.get("/all", protect, isAdmin, getAllCertificates);

module.exports = router;
